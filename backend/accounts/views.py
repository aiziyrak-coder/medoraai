"""
Authentication and User Management Views
"""
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from django.db import IntegrityError
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import requests
from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Sum, DecimalField
from django.db.models.functions import Coalesce
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


def _redact_phone(phone):
    """Return redacted phone for logging (last 4 digits only)."""
    if not phone or not isinstance(phone, str):
        return "***"
    s = phone.strip()
    if len(s) <= 4:
        return "****"
    return "***" + s[-4:]


# Login rate limit
LOGIN_RATE_LIMIT_KEY = "login_attempts:{phone}"
LOGIN_RATE_LIMIT_MAX = getattr(settings, 'LOGIN_RATE_LIMIT_MAX', 5)
LOGIN_RATE_LIMIT_WINDOW = getattr(settings, 'LOGIN_RATE_LIMIT_WINDOW', 60 * 15)


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


def _revoke_all_sessions_for_user(user):
    """
    Foydalanuvchining barcha refresh-sessiyalarini bekor qiladi (JWT blacklist + ActiveSession).
    Yangi kirishda faqat joriy qurilma qolishi uchun chaqiriladi.
    """
    sessions = list(ActiveSession.objects.filter(user=user))
    if not sessions:
        return
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    except ImportError:
        ActiveSession.objects.filter(user=user).delete()
        return
    for session in sessions:
        ot = OutstandingToken.objects.filter(jti=session.refresh_jti).first()
        if ot:
            BlacklistedToken.objects.get_or_create(token=ot)
        session.delete()


def _extract_device_context(request, fallback_data=None):
    """Extract normalized device info from request body/headers."""
    source = fallback_data if isinstance(fallback_data, dict) else {}
    device_id = str(source.get('device_id') or '').strip()
    if not device_id:
        device_id = str(request.headers.get('X-Device-Id') or '').strip()
    device_id = device_id[:128]

    device_info = str(source.get('device_info') or '').strip()
    if not device_info:
        ua = request.headers.get('User-Agent') or ''
        device_info = ua[:255]
    return device_id, device_info[:255]


def _jwt_refresh_lifetime() -> timedelta:
    td = getattr(settings, 'SIMPLE_JWT', {}).get('REFRESH_TOKEN_LIFETIME')
    return td if isinstance(td, timedelta) else timedelta(days=7)


def _refresh_session_still_valid(sess) -> bool:
    """
    ActiveSession hali "tizimga kirgan" holatda deb hisoblansinmi.
    OutstandingToken bo'lmasa ham (DB/migratsiya yoki get_or_create xatosi) login bloklanishi
    buzilib ketmasin — refresh token umumiy muddaticha ActiveSession ishonchli qoladi.
    """
    jti = (sess.refresh_jti or '').strip()
    if not jti:
        return False

    now = timezone.now()
    refresh_max = _jwt_refresh_lifetime()
    # Sessiya juda eski bo'lsa (refresh muddatidan oshgan) — faol emas
    if now - sess.created_at > refresh_max + timedelta(minutes=5):
        return False

    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    except ImportError:
        return True

    ot = OutstandingToken.objects.filter(jti=jti).first()
    if ot:
        if BlacklistedToken.objects.filter(token=ot).exists():
            return False
        exp = getattr(ot, 'expires_at', None)
        if exp is not None and now >= exp:
            return False
        return True

    # OutstandingToken yo'q — lekin ActiveSession yangi: foydalanuvchi hali chiqmagan, ikkinchi qurilmani bloklash kerak
    return True


def _cleanup_invalid_active_sessions(user):
    """Muddati o'tgan yoki bekor qilingan sessiyalar uchun ActiveSession qatorlarini olib tashlaydi."""
    for sess in list(ActiveSession.objects.filter(user=user)):
        if not _refresh_session_still_valid(sess):
            sess.delete()


def _other_device_blocks_login(user, current_device_id: str) -> tuple[bool, str]:
    """
    Boshqa qurilmada yaroqli sessiya bo'lsa (logout qilinmaguncha) yangi qurilmadan login rad etiladi.
    Bir xil device_id bilan qayta kirish ruxsat etiladi (token yangilanadi).
    """
    if not getattr(settings, 'ENFORCE_SINGLE_DEVICE_LOGIN', True):
        return False, ''
    if getattr(user, 'is_superuser', False) and getattr(
        settings, 'SINGLE_DEVICE_LOGIN_EXEMPT_SUPERUSER', True
    ):
        return False, ''

    cur = (current_device_id or '').strip()[:128]
    _cleanup_invalid_active_sessions(user)

    for sess in ActiveSession.objects.filter(user=user).order_by('-created_at'):
        sd = (sess.device_id or '').strip()[:128]
        if not sd or sd == cur:
            continue
        if _refresh_session_still_valid(sess):
            return True, (
                "Bu hisob boshqa qurilmada ochiq. Avval u yerda tizimdan chiqing, "
                "keyin bu qurilmada qayta kiring."
            )
        sess.delete()
    return False, ''


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token view: sessiya limiti va login rate limit."""
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        data = {}
        try:
            raw = getattr(request, 'data', None)
            if raw and (isinstance(raw, dict) or hasattr(raw, 'keys')):
                data = dict(raw) if not isinstance(raw, dict) else raw.copy()
            if not data and getattr(request, 'body', None):
                try:
                    body = request.body.decode('utf-8') if isinstance(request.body, bytes) else str(request.body)
                    if body.strip():
                        data = json.loads(body)
                except Exception:
                    pass
            phone = (data.get('phone') or '').strip() if isinstance(data, dict) else ''
        except Exception:
            phone = ''
        if not phone:
            return Response({
                'success': False,
                'error': {'code': 400, 'message': 'Telefon raqami kiritilishi shart'}
            }, status=400, content_type='application/json')
        device_id, device_info = _extract_device_context(request, data)
        if not device_id:
            return Response({
                'success': False,
                'error': {'code': 400, 'message': 'Qurilma identifikatori topilmadi. Iltimos, ilovani yangilang.'}
            }, status=400, content_type='application/json')

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
            }, status=429, content_type='application/json')

        auth_data = {'phone': phone, 'password': data.get('password')}
        serializer = self.get_serializer(data=auth_data)
        try:
            serializer.is_valid(raise_exception=True)
        except drf_serializers.ValidationError as e:
            cache.set(cache_key, attempts + 1, LOGIN_RATE_LIMIT_WINDOW)
            error_message = e.detail[0] if isinstance(e.detail, list) and len(e.detail) > 0 else str(e.detail) if hasattr(e, 'detail') else 'Telefon raqami yoki parol noto\'g\'ri'
            logger.warning("Login validation error for %s: %s", _redact_phone(phone), error_message)
            return Response({
                'success': False,
                'error': {'code': 400, 'message': error_message},
            }, status=400, content_type='application/json')
        except (ValueError, TypeError) as e:
            cache.set(cache_key, attempts + 1, LOGIN_RATE_LIMIT_WINDOW)
            logger.error("Login error for %s: %s", _redact_phone(phone), e)
            return Response({
                'success': False,
                'error': {'code': 400, 'message': 'Telefon raqami yoki parol noto\'g\'ri'},
            }, status=400, content_type='application/json')

        user = serializer.validated_data['user']

        blocked, block_msg = _other_device_blocks_login(user, device_id)
        if blocked:
            logger.info(
                "Login rad: boshqa qurilmada sessiya (user=%s, device=%s...)",
                _redact_phone(getattr(user, 'phone', '')),
                (device_id or '')[:12],
            )
            return Response(
                {
                    'success': False,
                    'error': {'code': 403, 'message': block_msg},
                },
                status=403,
                content_type='application/json',
            )

        # Shu qurilmadan kirish: avvalgi tokenlarni bekor qilish, keyin yangi juftlik.
        _revoke_all_sessions_for_user(user)

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

        ActiveSession.objects.filter(user=user, device_id=device_id).exclude(refresh_jti=jti).delete()
        ActiveSession.objects.create(user=user, refresh_jti=jti, device_id=device_id, device_info=device_info)
        max_sessions = user.max_concurrent_sessions()
        _revoke_oldest_sessions(user, max_sessions)

        # Muvaffaqiyatli login - rate limit hisobini tozalash
        cache.delete(cache_key)

        # Select related data for serializer to avoid N+1
        user = User.objects.select_related('subscription_plan', 'linked_doctor').get(pk=user.pk)
        return Response({
            'success': True,
            'data': {
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }
        }, content_type='application/json')


def _register_session_for_tokens(user, refresh, device_id='', device_info=''):
    """OutstandingToken va ActiveSession yozadi, limitdan ortiq sessiyalarni bekor qiladi."""
    try:
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
        if device_id:
            ActiveSession.objects.filter(user=user, device_id=device_id).exclude(refresh_jti=jti).delete()
        ActiveSession.objects.create(
            user=user,
            refresh_jti=jti,
            device_id=(device_id or '')[:128],
            device_info=(device_info or '')[:255],
        )
        _revoke_oldest_sessions(user, user.max_concurrent_sessions())
    except Exception as ex:
        logger.warning("Session registration failed (user created): %s", ex)


class CustomTokenRefreshView(TokenRefreshView):
    """Refresh: refresh token aylanishi bilan ActiveSession va device_id mos saqlanadi (bitta qurilma)."""
    def post(self, request, *args, **kwargs):
        data = {}
        try:
            raw = getattr(request, 'data', None)
            if raw and isinstance(raw, dict):
                data = raw.copy()
        except Exception:
            pass

        device_id, device_info = _extract_device_context(request, data)
        old_refresh = (data.get('refresh') or '').strip()

        old_jti = None
        old_session = None
        if old_refresh:
            try:
                from rest_framework_simplejwt.settings import api_settings as jwt_settings
                old_payload = jwt_decode(
                    old_refresh,
                    jwt_settings.SIGNING_KEY,
                    algorithms=[jwt_settings.ALGORITHM],
                )
                old_jti = str(old_payload.get('jti') or '')
                if old_jti:
                    old_session = ActiveSession.objects.filter(refresh_jti=old_jti).select_related('user').first()
            except Exception:
                pass

        if old_session:
            sd = (old_session.device_id or '').strip()
            if sd and device_id and sd != device_id[:128]:
                return Response({
                    'success': False,
                    'error': {'code': 401, 'message': "Sessiya boshqa qurilmada. Qayta kiring."}
                }, status=401, content_type='application/json')
            if not device_id:
                device_id = (old_session.device_id or '')[:128]
            if not device_info and old_session.device_info:
                device_info = (old_session.device_info or '')[:255]

        if not device_id:
            return Response({
                'success': False,
                'error': {'code': 400, 'message': "Qurilma identifikatori topilmadi. Iltimos, ilovani yangilang."}
            }, status=400, content_type='application/json')

        response = super().post(request, *args, **kwargs)
        if response.status_code != 200:
            return response

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
            if user_id and new_jti:
                user = User.objects.filter(pk=user_id).first()
                if user:
                    jtis = [j for j in (old_jti, new_jti) if j]
                    if jtis:
                        ActiveSession.objects.filter(user=user, refresh_jti__in=jtis).delete()
                    ActiveSession.objects.create(
                        user=user,
                        refresh_jti=new_jti,
                        device_id=device_id[:128],
                        device_info=device_info[:255],
                    )
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
        except Exception as ex:
            logger.warning("CustomTokenRefreshView session update: %s", ex)
        return response


def _parse_register_body(request):
    """Parse POST body manually to avoid DRF parser 400 with empty body. Always returns dict."""
    raw = getattr(request, 'body', None) or b''
    if isinstance(raw, bytes):
        try:
            raw = raw.decode('utf-8')
        except Exception:
            return {}
    text = (raw or '').strip()
    if not text:
        return {}
    try:
        out = json.loads(text)
        return dict(out) if isinstance(out, dict) else {}
    except json.JSONDecodeError:
        return {}


def _json_http_response(payload, status_code, content_type='application/json; charset=utf-8'):
    """Return HttpResponse with JSON body (anig Content-Length)  -  400/201 body yo'qolishini oldini olish."""
    body = json.dumps(payload, ensure_ascii=False)
    r = HttpResponse(body, content_type=content_type, status=status_code)
    r['Content-Length'] = str(len(body.encode('utf-8')))
    return r


@csrf_exempt
@require_http_methods(['POST'])
def register(request):
    """User registration  -  body faqat request.body dan, javob har doim HttpResponse (anig JSON body)."""
    try:
        data = _parse_register_body(request)
        if data.get('linked_doctor') in ('', None):
            data.pop('linked_doctor', None)
        if data.get('password') and not data.get('password_confirm'):
            data['password_confirm'] = data['password']
        if 'specialties' not in data or data.get('specialties') is None:
            data['specialties'] = []
        if data.get('phone') is not None:
            data['phone'] = str(data['phone']).strip()
        if data.get('role') is not None:
            data['role'] = str(data['role']).strip().lower()
        if not data:
            return _json_http_response({
                'success': False,
                'error': {'code': 400, 'message': "So'rov tanasi bo'sh yoki noto'g'ri. JSON (phone, name, password, role) yuborilishi kerak.", 'details': {}}
            }, 400)
        logger.info("Register attempt: role=%s, phone=%s, keys=%s", data.get('role'), data.get('phone'), list(data.keys()))
        device_id, device_info = _extract_device_context(request, data)
        if not device_id:
            return _json_http_response({
                'success': False,
                'error': {'code': 400, 'message': "Qurilma identifikatori topilmadi. Iltimos, ilovani yangilang.", 'details': {}}
            }, 400)
        data.pop('device_id', None)
        data.pop('device_info', None)
        serializer = UserCreateSerializer(data=data)
        if serializer.is_valid():
            try:
                user = serializer.save()
            except IntegrityError as e:
                if 'phone' in str(e).lower() or 'unique' in str(e).lower():
                    return _json_http_response({
                        'success': False,
                        'error': {'code': 400, 'message': "Bu telefon raqami allaqachon ro'yxatdan o'tgan.", 'details': {'phone': ["Bu telefon raqami allaqachon ro'yxatdan o'tgan."]}}
                    }, 400)
                raise
            refresh = RefreshToken.for_user(user)
            _register_session_for_tokens(user, refresh, device_id=device_id, device_info=device_info)
            user_data = UserSerializer(user).data
            return _json_http_response({
                'success': True,
                'message': "Ro'yxatdan o'tish muvaffaqiyatli",
                'data': {
                    'user': user_data,
                    'tokens': {'access': str(refresh.access_token), 'refresh': str(refresh)}
                }
            }, 201)
        flat_msg = "Ma'lumotlar noto'g'ri"
        if serializer.errors:
            for field, errs in serializer.errors.items():
                if isinstance(errs, list) and errs:
                    flat_msg = errs[0] if isinstance(errs[0], str) else str(errs[0])
                    break
                if isinstance(errs, str):
                    flat_msg = errs
                    break
        logger.warning("Register validation failed: %s", serializer.errors)
        return _json_http_response({
            'success': False,
            'error': {'code': 400, 'message': flat_msg, 'details': serializer.errors}
        }, 400)
    except Exception as e:
        logger.exception("Register exception: %s", e)
        return _json_http_response({
            'success': False,
            'error': {'code': 500, 'message': "Ro'yxatdan o'tishda server xatoligi. Iltimos, keyinroq urinib ko'ring."}
        }, 500)


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
        queryset = User.objects.select_related('subscription_plan')
        if user.is_clinic or user.is_superuser:
            return queryset.all()
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
    max_size = getattr(settings, 'MAX_FILE_UPLOAD_SIZE', 5 * 1024 * 1024)
    if file.size > max_size:
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': f'Fayl hajmi 5MB dan oshmasligi kerak'
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    allowed_types = getattr(settings, 'ALLOWED_UPLOAD_TYPES', ['image/jpeg', 'image/png', 'image/jpg'])
    allowed_extensions = getattr(settings, 'ALLOWED_UPLOAD_EXTENSIONS', ['.jpg', '.jpeg', '.png'])
    if file.content_type not in allowed_types:
        return Response({
            'success': False,
            'error': {
                'code': status.HTTP_400_BAD_REQUEST,
                'message': 'Faqat rasm fayllari (JPG, PNG) qabul qilinadi'
            }
        }, status=status.HTTP_400_BAD_REQUEST)
    name = getattr(file, 'name', '') or ''
    if not any(name.lower().endswith(ext) for ext in allowed_extensions):
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
        "<b>YANGI TO'LOV (Pending)</b>\n\n"
        f"<b>Foydalanuvchi:</b> {user_name}\n"
        f"<b>Telefon:</b> {user_phone}\n"
        f"<b>Rol:</b> {user_role}\n"
        f"<b>Kutilgan summa:</b> {amount} so'm\n\n"
        "<i>Adminlar, chekni tekshiring va tasdiqlash tugmasini bosing.</i>"
    )

    try:
        # Create subscription payment record (pending) FIRST to get payment ID for buttons
        plan_id = request.data.get('plan_id')
        plan = None
        if plan_id:
            try:
                plan = SubscriptionPlan.objects.get(pk=plan_id, is_active=True)
            except SubscriptionPlan.DoesNotExist:
                pass
        payment = SubscriptionPayment.objects.create(
            user=request.user,
            plan=plan,
            amount=amount,
            status='pending',
            receipt_note='Chek yuborildi',
        )

        # Inline keyboard: Tasdiqlash / Rad etish
        import json as _json
        reply_markup = _json.dumps({
            'inline_keyboard': [
                [
                    {'text': '+ Tasdiqlash', 'callback_data': f'approve_{payment.id}'},
                    {'text': '- Rad etish', 'callback_data': f'reject_{payment.id}'},
                ]
            ]
        })

        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        payload = {
            'chat_id': group_id,
            'caption': caption,
            'parse_mode': 'HTML',
            'reply_markup': reply_markup,
        }
        files = {'photo': (file.name, file, file.content_type)}
        resp = requests.post(url, data=payload, files=files, timeout=30)
        data = resp.json()
        if data.get('ok'):
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


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def telegram_webhook(request):
    """
    Telegram bot webhook  -  inline tugmalar callback'larini qayta ishlaydi.
    Tasdiqlash: obunani 30 kunga faollashtiradi.
    Rad etish: obunani rad etadi.
    """
    import json as _json

    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    if not token:
        return Response({'ok': True})

    body = request.data
    callback_query = body.get('callback_query')
    if not callback_query:
        return Response({'ok': True})

    callback_data = callback_query.get('data', '')
    callback_id = callback_query.get('id')
    message = callback_query.get('message', {})
    chat_id = message.get('chat', {}).get('id')
    message_id = message.get('message_id')

    # Parse action and payment ID
    action = None
    payment_id = None
    if callback_data.startswith('approve_'):
        action = 'approve'
        payment_id = callback_data.replace('approve_', '')
    elif callback_data.startswith('reject_'):
        action = 'reject'
        payment_id = callback_data.replace('reject_', '')

    if not action or not payment_id:
        _answer_callback(token, callback_id, "Noma'lum buyruq")
        return Response({'ok': True})

    try:
        payment = SubscriptionPayment.objects.select_related('user').get(pk=int(payment_id))
    except (SubscriptionPayment.DoesNotExist, ValueError):
        _answer_callback(token, callback_id, "To'lov topilmadi")
        return Response({'ok': True})

    if payment.status != 'pending':
        status_text = 'tasdiqlangan' if payment.status == 'approved' else 'rad etilgan'
        _answer_callback(token, callback_id, f"Bu to'lov allaqachon {status_text}")
        return Response({'ok': True})

    user = payment.user

    if action == 'approve':
        payment.status = 'approved'
        payment.reviewed_at = timezone.now()
        payment.save(update_fields=['status', 'reviewed_at'])

        # Activate subscription for 30 days
        user.subscription_status = 'active'
        user.subscription_expiry = timezone.now() + timedelta(days=30)
        if payment.plan:
            user.subscription_plan = payment.plan
        user.save(update_fields=['subscription_status', 'subscription_expiry', 'subscription_plan'])

        result_text = (
            f"<b>TASDIQLANDI</b>\n\n"
            f"{user.name} ({user.phone})\n"
            f"Obuna: 30 kun ({user.subscription_expiry.strftime('%d.%m.%Y')} gacha)\n"
            f"{payment.amount} so'm"
        )
        _answer_callback(token, callback_id, "+ Tasdiqlandi! Obuna 30 kunga faollashtirildi.")
        logger.info("Payment %s approved for user %s", payment_id, user.phone)

    else:  # reject
        payment.status = 'rejected'
        payment.reviewed_at = timezone.now()
        payment.save(update_fields=['status', 'reviewed_at'])

        user.subscription_status = 'inactive'
        user.save(update_fields=['subscription_status'])

        result_text = (
            f"<b>RAD ETILDI</b>\n\n"
            f"{user.name} ({user.phone})\n"
            f"{payment.amount} so'm"
        )
        _answer_callback(token, callback_id, "- Rad etildi.")
        logger.info("Payment %s rejected for user %s", payment_id, user.phone)

    # Update the original message  -  remove buttons and show result
    if chat_id and message_id:
        try:
            edit_url = f"https://api.telegram.org/bot{token}/editMessageCaption"
            old_caption = message.get('caption', '')
            new_caption = f"{old_caption}\n\n{'в”Ђ' * 20}\n{result_text}"
            requests.post(edit_url, json={
                'chat_id': chat_id,
                'message_id': message_id,
                'caption': new_caption,
                'parse_mode': 'HTML',
            }, timeout=10)
        except Exception as e:
            logger.error("Failed to edit Telegram message: %s", e)

    return Response({'ok': True})


def _answer_callback(token: str, callback_id: str, text: str):
    """Answer Telegram callback query"""
    try:
        url = f"https://api.telegram.org/bot{token}/answerCallbackQuery"
        requests.post(url, json={
            'callback_query_id': callback_id,
            'text': text,
            'show_alert': True,
        }, timeout=10)
    except Exception as e:
        logger.error("Failed to answer callback query: %s", e)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_session(request):
    """
    Logout current device session by refresh token or current device_id.
    This releases single-device lock intentionally.
    """
    refresh_token_raw = (request.data.get('refresh') or '').strip()
    device_id = (request.data.get('device_id') or request.headers.get('X-Device-Id') or '').strip()
    removed = 0
    if refresh_token_raw:
        try:
            from rest_framework_simplejwt.settings import api_settings as jwt_settings
            payload = jwt_decode(refresh_token_raw, jwt_settings.SIGNING_KEY, algorithms=[jwt_settings.ALGORITHM])
            jti = str(payload.get('jti') or '')
            if jti:
                removed += ActiveSession.objects.filter(user=request.user, refresh_jti=jti).delete()[0]
        except Exception:
            pass
    if removed == 0 and device_id:
        removed += ActiveSession.objects.filter(user=request.user, device_id=device_id).delete()[0]
    return Response({'success': True, 'data': {'removed_sessions': removed}})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def rector_dashboard_stats(request):
    """High-level business metrics page for rector dashboard."""
    if not (request.user.is_superuser or request.user.is_staff):
        return Response({
            'success': False,
            'error': {'code': status.HTTP_403_FORBIDDEN, 'message': 'Ushbu bo\'lim faqat administratorlar uchun.'}
        }, status=status.HTTP_403_FORBIDDEN)

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_users = User.objects.count()
    active_subscriptions = User.objects.filter(subscription_status='active').count()
    pending_subscriptions = User.objects.filter(subscription_status='pending').count()
    new_users_30d = User.objects.filter(date_joined__gte=now - timedelta(days=30)).count()
    role_breakdown = list(
        User.objects.values('role').annotate(count=Count('id')).order_by('role')
    )

    payments_qs = SubscriptionPayment.objects.all()
    approved_qs = payments_qs.filter(status='approved')
    pending_payments = payments_qs.filter(status='pending').count()
    rejected_payments = payments_qs.filter(status='rejected').count()

    total_revenue = approved_qs.aggregate(
        total=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField(max_digits=12, decimal_places=0))
    )['total']
    monthly_revenue = approved_qs.filter(reviewed_at__gte=month_start).aggregate(
        total=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField(max_digits=12, decimal_places=0))
    )['total']

    plan_breakdown = list(
        SubscriptionPayment.objects.filter(status='approved')
        .values('plan__name')
        .annotate(count=Count('id'), amount=Coalesce(Sum('amount'), Decimal('0')))
        .order_by('-count')
    )

    return Response({
        'success': True,
        'data': {
            'users': {
                'total': total_users,
                'new_last_30_days': new_users_30d,
                'roles': role_breakdown,
            },
            'subscriptions': {
                'active': active_subscriptions,
                'pending': pending_subscriptions,
            },
            'payments': {
                'pending': pending_payments,
                'rejected': rejected_payments,
                'revenue_total_uzs': int(total_revenue or 0),
                'revenue_this_month_uzs': int(monthly_revenue or 0),
                'approved_by_plan': plan_breakdown,
            },
            'generated_at': now.isoformat(),
        }
    })