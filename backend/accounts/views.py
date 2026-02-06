"""
Authentication and User Management Views
"""
import logging
from datetime import datetime, timedelta
import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status, generics, permissions, serializers as drf_serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from jwt import decode as jwt_decode
from django.contrib.auth import get_user_model
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    PasswordChangeSerializer, CustomTokenObtainPairSerializer,
    SubscriptionPlanSerializer,
)
from .models import User, SubscriptionPlan, SubscriptionPayment, ActiveSession

User = get_user_model()
logger = logging.getLogger(__name__)

# Login rate limit: 5 urinish / 15 daqiqa per telefon
LOGIN_RATE_LIMIT_KEY = "login_attempts:{phone}"
LOGIN_RATE_LIMIT_MAX = 5
LOGIN_RATE_LIMIT_WINDOW = 60 * 15  # 15 min in seconds


def _revoke_oldest_sessions(user, keep_count):
    """Eng eski sessiyalarni bekor qiladi (blacklist) va ActiveSession o'chiradi."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    except ImportError:
        return
    sessions = ActiveSession.objects.filter(user=user).order_by('created_at')
    to_remove = sessions.count() - keep_count
    if to_remove <= 0:
        return
    for session in sessions[:to_remove]:
        ot = OutstandingToken.objects.filter(jti=session.refresh_jti).first()
        if ot:
            BlacklistedToken.objects.get_or_create(token=ot)
        session.delete()


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token view: sessiya limiti va login rate limit."""
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        phone = (request.data.get('phone') or '').strip()
        if not phone:
            return Response({
                'success': False,
                'error': {'code': 400, 'message': 'Telefon raqami kiritilishi shart'}
            }, status=400)

        # Login rate limit: bir xil telefon uchun juda ko'p urinish
        cache_key = LOGIN_RATE_LIMIT_KEY.format(phone=phone)
        attempts = cache.get(cache_key, 0)
        if attempts >= LOGIN_RATE_LIMIT_MAX:
            return Response({
                'success': False,
                'error': {
                    'code': 429,
                    'message': "Juda ko'p noto'g'ri urinishlar. Iltimos, 15 daqiqadan keyin qayta urinib ko'ring.",
                }
            }, status=429)

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except drf_serializers.ValidationError as e:
            cache.set(cache_key, attempts + 1, LOGIN_RATE_LIMIT_WINDOW)
            error_message = e.detail[0] if isinstance(e.detail, list) and len(e.detail) > 0 else str(e.detail) if hasattr(e, 'detail') else 'Telefon raqami yoki parol noto\'g\'ri'
            return Response({
                'success': False,
                'error': {'code': 400, 'message': error_message},
            }, status=400)
        except Exception as e:
            cache.set(cache_key, attempts + 1, LOGIN_RATE_LIMIT_WINDOW)
            return Response({
                'success': False,
                'error': {'code': 400, 'message': 'Telefon raqami yoki parol noto\'g\'ri'},
            }, status=400)

        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        jti = str(refresh.get('jti'))
        exp = refresh.get('exp')
        expires_at = timezone.make_aware(datetime.utcfromtimestamp(exp)) if exp else timezone.now() + timedelta(days=7)

        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            OutstandingToken.objects.get_or_create(
                jti=jti,
                defaults={
                    'user': user,
                    'token': str(refresh),
                    'created_at': timezone.now(),
                    'expires_at': expires_at,
                }
            )
        except Exception as ex:
            logger.warning("OutstandingToken create: %s", ex)

        ActiveSession.objects.create(user=user, refresh_jti=jti)
        max_sessions = user.max_concurrent_sessions()
        _revoke_oldest_sessions(user, max_sessions)

        # Muvaffaqiyatli login - rate limit hisobini tozalash
        cache.delete(cache_key)

        return Response({
            'success': True,
            'data': {
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }
        })


def _register_session_for_tokens(user, refresh):
    """OutstandingToken va ActiveSession yozadi, limitdan ortiq sessiyalarni bekor qiladi."""
    jti = str(refresh.get('jti'))
    exp = refresh.get('exp')
    expires_at = timezone.make_aware(datetime.utcfromtimestamp(exp)) if exp else timezone.now() + timedelta(days=7)
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
        OutstandingToken.objects.get_or_create(
            jti=jti,
            defaults={
                'user': user,
                'token': str(refresh),
                'created_at': timezone.now(),
                'expires_at': expires_at,
            }
        )
    except Exception as ex:
        logger.warning("OutstandingToken create: %s", ex)
    ActiveSession.objects.create(user=user, refresh_jti=jti)
    _revoke_oldest_sessions(user, user.max_concurrent_sessions())


class CustomTokenRefreshView(TokenRefreshView):
    """Refresh dan keyin ActiveSession yangilash (eski sessiya o'chiriladi, yangisi qo'shiladi)."""
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code != 200:
            return response
        old_refresh = request.data.get('refresh') or ''
        new_refresh = response.data.get('refresh') or ''
        if not new_refresh:
            return response
        try:
            from rest_framework_simplejwt.settings import api_settings as jwt_settings
            payload = jwt_decode(
                new_refresh,
                jwt_settings.SIGNING_KEY,
                algorithms=[jwt_settings.ALGORITHM],
            )
            new_jti = str(payload.get('jti'))
            user_id = payload.get('user_id')
            if user_id:
                ActiveSession.objects.filter(refresh_jti=new_jti).delete()
                user = User.objects.filter(pk=user_id).first()
                if user:
                    ActiveSession.objects.create(user=user, refresh_jti=new_jti)
                    exp = payload.get('exp')
                    expires_at = timezone.make_aware(datetime.utcfromtimestamp(exp)) if exp else timezone.now() + timedelta(days=7)
                    try:
                        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
                        OutstandingToken.objects.get_or_create(
                            jti=new_jti,
                            defaults={
                                'user': user,
                                'token': new_refresh,
                                'created_at': timezone.now(),
                                'expires_at': expires_at,
                            }
                        )
                    except Exception:
                        pass
            if old_refresh:
                try:
                    old_payload = jwt_decode(old_refresh, jwt_settings.SIGNING_KEY, algorithms=[jwt_settings.ALGORITHM])
                    old_jti = str(old_payload.get('jti'))
                    ActiveSession.objects.filter(refresh_jti=old_jti).delete()
                except Exception:
                    pass
        except Exception as ex:
            logger.warning("CustomTokenRefreshView session update: %s", ex)
        return response


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """User registration endpoint"""
    serializer = UserCreateSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        _register_session_for_tokens(user, refresh)
        return Response({
            'success': True,
            'message': 'Ro\'yxatdan o\'tish muvaffaqiyatli',
            'data': {
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }
        }, status=status.HTTP_201_CREATED)
    return Response({
        'success': False,
        'error': {
            'code': status.HTTP_400_BAD_REQUEST,
            'message': 'Ma\'lumotlar noto\'g\'ri',
            'details': serializer.errors
        }
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def profile(request):
    """Get or update user profile"""
    if request.method == 'GET':
        serializer = UserSerializer(request.user)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    elif request.method in ['PUT', 'PATCH']:
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Profil yangilandi',
                'data': UserSerializer(request.user).data
            })
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': 'Ma\'lumotlar noto\'g\'ri',
                'details': serializer.errors
            }
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Change user password"""
    serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({
            'success': True,
            'message': 'Parol muvaffaqiyatli o\'zgartirildi'
        })
    return Response({
        'success': False,
        'error': {
            'code': status.HTTP_400_BAD_REQUEST,
            'message': 'Parol o\'zgartirishda xatolik',
            'details': serializer.errors
        }
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def password_reset_request(request):
    """Request password reset (sends email/SMS)"""
    phone = request.data.get('phone')
    if not phone:
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': 'Telefon raqami kiritilishi shart'
            }
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(phone=phone)
        # TODO: Implement SMS/Email sending
        return Response({
            'success': True,
            'message': 'Agar ushbu raqam uchun hisob mavjud bo\'lsa, tiklash yo\'riqnomasi yuborildi'
        })
    except User.DoesNotExist:
        # Don't reveal if user exists or not (security)
        return Response({
            'success': True,
            'message': 'Agar ushbu raqam uchun hisob mavjud bo\'lsa, tiklash yo\'riqnomasi yuborildi'
        })


class UserListAPIView(generics.ListAPIView):
    """List users (for admin/clinic)"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.select_related('subscription_plan', 'linked_doctor')
        if user.is_clinic or user.is_superuser:
            return queryset.all()
        elif user.is_doctor:
            # Doctors can see their assistants
            return queryset.filter(linked_doctor=user)
        return queryset.none()


class UserDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """User detail, update, delete"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def subscription_plans_list(request):
    """Obuna rejalari ro'yxati - barcha faol rejalar"""
    plans = SubscriptionPlan.objects.filter(is_active=True)
    serializer = SubscriptionPlanSerializer(plans, many=True)
    return Response({'success': True, 'data': serializer.data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_subscription(request):
    """Joriy foydalanuvchi obunasi"""
    user = request.user
    if user.role == 'staff' and user.linked_doctor:
        user = user.linked_doctor
    data = {
        'subscription_status': user.subscription_status,
        'subscription_expiry': user.subscription_expiry.isoformat() if user.subscription_expiry else None,
        'trial_ends_at': user.trial_ends_at.isoformat() if user.trial_ends_at else None,
        'has_active_subscription': user.has_active_subscription,
        'plan': SubscriptionPlanSerializer(user.subscription_plan).data if user.subscription_plan else None,
    }
    return Response({'success': True, 'data': data})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_payment_receipt(request):
    """
    Send payment receipt photo to Telegram (server-side). Keeps BOT_TOKEN secret.
    Expects multipart: file, user_name, user_phone, user_role, amount.
    """
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    group_id = getattr(settings, 'TELEGRAM_PAYMENT_GROUP_ID', None)
    if not token or not group_id:
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_503_SERVICE_UNAVAILABLE,
                'message': 'To\'lov xizmati hozircha sozlanmagan.'
            }
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    file = request.FILES.get('file')
    if not file:
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': 'Chek rasmi yuklanmadi.'
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    # File validation
    max_size = 5 * 1024 * 1024  # 5MB
    if file.size > max_size:
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': f'Fayl hajmi 5MB dan oshmasligi kerak'
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    allowed_types = ['image/jpeg', 'image/png', 'image/jpg']
    if file.content_type not in allowed_types:
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': 'Faqat rasm fayllari (JPG, PNG) qabul qilinadi'
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    user_name = request.data.get('user_name', request.user.name or '')
    user_phone = request.data.get('user_phone', getattr(request.user, 'phone', '') or '')
    user_role = request.data.get('user_role', getattr(request.user, 'role', '') or '')
    try:
        amount = int(request.data.get('amount', 0))
    except (TypeError, ValueError):
        amount = 0

    caption = (
        "🚀 <b>YANGI TO'LOV (Pending)</b>\n\n"
        f"👤 <b>Foydalanuvchi:</b> {user_name}\n"
        f"📱 <b>Telefon:</b> {user_phone}\n"
        f"👨‍⚕️ <b>Rol:</b> {user_role}\n"
        f"💰 <b>Kutilgan summa:</b> {amount:,.0f} so'm\n\n"
        "⚠️ <i>Adminlar, chekni tekshiring va tasdiqlash tugmasini bosing.</i>"
    )

    try:
        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        payload = {
            'chat_id': group_id,
            'caption': caption,
            'parse_mode': 'HTML',
        }
        files = {'photo': (file.name, file, file.content_type)}
        resp = requests.post(url, data=payload, files=files, timeout=30)
        data = resp.json()
        if data.get('ok'):
            # Create subscription payment record (pending) and set user to pending
            plan_id = request.data.get('plan_id')
            plan = None
            if plan_id:
                try:
                    plan = SubscriptionPlan.objects.get(pk=plan_id, is_active=True)
                except SubscriptionPlan.DoesNotExist:
                    pass
            SubscriptionPayment.objects.create(
                user=request.user,
                plan=plan,
                amount=amount,
                status='pending',
                receipt_note='Chek yuborildi',
            )
            request.user.subscription_status = 'pending'
            request.user.save(update_fields=['subscription_status'])
            return Response({'success': True, 'message': 'Chek yuborildi. Admin tasdiqlagach obuna faollashadi.'})
        logger.warning("Telegram API error: %s", data)
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_502_BAD_GATEWAY,
                'message': data.get('description', 'Telegramga yuborishda xatolik.')
            }
        }, status=status.HTTP_502_BAD_GATEWAY)
    except requests.RequestException as e:
        logger.exception("Payment receipt Telegram request failed: %s", e)
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_502_BAD_GATEWAY,
                'message': 'Tashqi xizmatga ulanishda xatolik.'
            }
        }, status=status.HTTP_502_BAD_GATEWAY)
