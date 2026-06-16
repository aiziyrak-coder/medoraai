"""
Klinika guruhi admini API — guruh a'zolari, obuna va to'lovlarni boshqarish.
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .clinic_admin import (
    assert_same_clinic_group,
    can_manage_clinic_group,
    clinic_group_members_queryset,
    is_clinic_group_admin,
)
from .models import User, SubscriptionPayment, ActiveSession, ClinicGroup
from .permissions import IsClinicGroupAdmin
from .serializers import (
    ClinicAdminUserSerializer,
    ClinicAdminUserCreateSerializer,
    ClinicAdminUserUpdateSerializer,
    ClinicAdminResetPasswordSerializer,
    SubscriptionPlanSerializer,
)
from .session_utils import revoke_all_sessions_for_user

logger = logging.getLogger(__name__)


def _forbidden(message='Ruxsat yo\'q.'):
    return Response({
        'success': False,
        'error': {'code': status.HTTP_403_FORBIDDEN, 'message': message},
    }, status=status.HTTP_403_FORBIDDEN)


def _get_managed_user(request, user_id):
    """Guruh admini boshqara oladigan foydalanuvchini qaytaradi."""
    if not can_manage_clinic_group(request.user):
        return None, _forbidden()
    try:
        target = User.objects.select_related('subscription_plan', 'clinic_group').get(pk=user_id)
    except User.DoesNotExist:
        return None, Response({
            'success': False,
            'error': {'code': status.HTTP_404_NOT_FOUND, 'message': 'Foydalanuvchi topilmadi.'},
        }, status=status.HTTP_404_NOT_FOUND)
    if not assert_same_clinic_group(request.user, target):
        return None, _forbidden('Bu foydalanuvchi sizning guruhingizga tegishli emas.')
    return target, None


@api_view(['GET'])
@permission_classes([IsClinicGroupAdmin])
def clinic_admin_stats(request):
    """Guruh bo'yicha statistika."""
    user = request.user
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if user.is_superuser and not user.clinic_group_id:
        members = User.objects.all()
        group_name = 'Barcha guruhlar'
    else:
        gid = user.clinic_group_id
        if not gid:
            return Response({
                'success': False,
                'error': {'code': status.HTTP_400_BAD_REQUEST, 'message': 'Klinika guruhi topilmadi.'},
            }, status=status.HTTP_400_BAD_REQUEST)
        members = User.objects.filter(clinic_group_id=gid)
        group = ClinicGroup.objects.filter(pk=gid).first()
        group_name = group.name if group else ''

    member_ids = list(members.values_list('id', flat=True))
    payments_qs = SubscriptionPayment.objects.filter(user_id__in=member_ids)

    role_breakdown = list(
        members.values('role').annotate(count=Count('id')).order_by('role')
    )

    return Response({
        'success': True,
        'data': {
            'group': {
                'id': user.clinic_group_id,
                'name': group_name,
            },
            'members': {
                'total': members.count(),
                'active': members.filter(is_active=True).count(),
                'admins': members.filter(is_clinic_group_admin=True, is_active=True).count(),
                'roles': role_breakdown,
            },
            'subscriptions': {
                'active': members.filter(subscription_status='active').count(),
                'pending': members.filter(subscription_status='pending').count(),
                'inactive': members.filter(subscription_status='inactive').count(),
            },
            'payments': {
                'pending': payments_qs.filter(status='pending').count(),
                'approved': payments_qs.filter(status='approved').count(),
                'rejected': payments_qs.filter(status='rejected').count(),
                'revenue_total_uzs': int(
                    payments_qs.filter(status='approved').aggregate(
                        total=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField(max_digits=12, decimal_places=0))
                    )['total'] or 0
                ),
                'revenue_this_month_uzs': int(
                    payments_qs.filter(status='approved', reviewed_at__gte=month_start).aggregate(
                        total=Coalesce(Sum('amount'), Decimal('0'), output_field=DecimalField(max_digits=12, decimal_places=0))
                    )['total'] or 0
                ),
            },
            'sessions': {
                'active': ActiveSession.objects.filter(user_id__in=member_ids).count(),
            },
            'generated_at': now.isoformat(),
        },
    })


class ClinicAdminUserListCreateView(generics.ListCreateAPIView):
    """Guruh a'zolarini ro'yxatlash va yangi qo'shish."""
    permission_classes = [IsClinicGroupAdmin]

    def get_queryset(self):
        return clinic_group_members_queryset(self.request.user)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ClinicAdminUserCreateSerializer
        return ClinicAdminUserSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = ClinicAdminUserSerializer(queryset, many=True)
        return Response({'success': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        if not request.user.clinic_group_id and not request.user.is_superuser:
            return Response({
                'success': False,
                'error': {'message': 'Klinika guruhi topilmadi.'},
            }, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'success': True,
            'data': ClinicAdminUserSerializer(user).data,
            'message': 'Foydalanuvchi qo\'shildi.',
        }, status=status.HTTP_201_CREATED)


class ClinicAdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Guruh a'zosini ko'rish, yangilash, o'chirish."""
    permission_classes = [IsClinicGroupAdmin]
    lookup_field = 'id'

    def get_queryset(self):
        return clinic_group_members_queryset(self.request.user)

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ClinicAdminUserUpdateSerializer
        return ClinicAdminUserSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return Response({'success': True, 'data': ClinicAdminUserSerializer(instance).data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        if instance.is_superuser or instance.is_staff:
            return _forbidden('Platforma administratorini o\'zgartirib bo\'lmaydi.')
        serializer = ClinicAdminUserUpdateSerializer(
            instance, data=request.data, partial=partial, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'success': True,
            'data': ClinicAdminUserSerializer(instance).data,
            'message': 'Foydalanuvchi yangilandi.',
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response({
                'success': False,
                'error': {'message': 'O\'zingizni o\'chirib bo\'lmaydi.'},
            }, status=status.HTTP_400_BAD_REQUEST)
        if instance.is_superuser or instance.is_staff:
            return _forbidden('Platforma administratorini o\'chirib bo\'lmaydi.')
        if instance.is_clinic_group_admin:
            admins_left = User.objects.filter(
                clinic_group_id=instance.clinic_group_id,
                is_clinic_group_admin=True,
                is_active=True,
            ).exclude(pk=instance.pk).count()
            if admins_left == 0:
                return Response({
                    'success': False,
                    'error': {'message': 'Oxirgi guruh adminini o\'chirib bo\'lmaydi.'},
                }, status=status.HTTP_400_BAD_REQUEST)
        revoke_all_sessions_for_user(instance)
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            qs_ot = OutstandingToken.objects.filter(user_id=instance.pk)
            BlacklistedToken.objects.filter(token__in=qs_ot).delete()
            qs_ot.delete()
        except Exception as ex:
            logger.warning("Token cleanup before clinic admin user delete: %s", ex)
        instance.delete()
        return Response({'success': True, 'message': 'Foydalanuvchi o\'chirildi.'})


@api_view(['POST'])
@permission_classes([IsClinicGroupAdmin])
def clinic_admin_reset_password(request, user_id):
    """Guruh a'zosi parolini tiklash."""
    target, err = _get_managed_user(request, user_id)
    if err:
        return err
    if target.is_superuser or target.is_staff:
        return _forbidden()
    serializer = ClinicAdminResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    target.set_password(serializer.validated_data['new_password'])
    target.save(update_fields=['password'])
    revoke_all_sessions_for_user(target)
    return Response({'success': True, 'message': 'Parol yangilandi. Foydalanuvchi qayta kira oladi.'})


@api_view(['POST'])
@permission_classes([IsClinicGroupAdmin])
def clinic_admin_logout_user(request, user_id):
    """Guruh a'zosini barcha qurilmalardan chiqarish."""
    target, err = _get_managed_user(request, user_id)
    if err:
        return err
    count = revoke_all_sessions_for_user(target)
    return Response({
        'success': True,
        'data': {'sessions_removed': count},
        'message': f'{target.phone} barcha qurilmalardan chiqarildi.',
    })


@api_view(['POST'])
@permission_classes([IsClinicGroupAdmin])
def clinic_admin_activate_subscription(request, user_id):
    """
    Guruh a'zosi obunasini faollashtirish (to'lov tasdiqlangandan keyin yoki qo'lda).
    Body: plan_id (ixtiyoriy), duration_days (ixtiyoriy, default rejadan).
    """
    target, err = _get_managed_user(request, user_id)
    if err:
        return err
    if target.is_superuser or target.is_staff:
        return _forbidden()

    from .models import SubscriptionPlan
    plan_id = request.data.get('plan_id') or request.data.get('subscription_plan')
    plan = None
    if plan_id:
        try:
            plan = SubscriptionPlan.objects.get(pk=int(plan_id), is_active=True)
        except (SubscriptionPlan.DoesNotExist, TypeError, ValueError):
            return Response({
                'success': False,
                'error': {'message': 'Obuna rejasi topilmadi.'},
            }, status=status.HTTP_400_BAD_REQUEST)

    duration_days = request.data.get('duration_days')
    if duration_days is not None:
        try:
            duration_days = int(duration_days)
        except (TypeError, ValueError):
            duration_days = None

    if plan:
        target.subscription_plan = plan
        days = duration_days or plan.duration_days or 30
    else:
        days = duration_days or 30

    target.subscription_status = 'active'
    target.subscription_expiry = timezone.now() + timedelta(days=days)
    target.trial_ends_at = None
    target.save(update_fields=[
        'subscription_plan', 'subscription_status', 'subscription_expiry', 'trial_ends_at',
    ])

    return Response({
        'success': True,
        'data': ClinicAdminUserSerializer(target).data,
        'message': 'Obuna faollashtirildi.',
    })


@api_view(['GET'])
@permission_classes([IsClinicGroupAdmin])
def clinic_admin_payments(request):
    """Guruh a'zolarining to'lovlari."""
    user = request.user
    members = clinic_group_members_queryset(user)
    member_ids = list(members.values_list('id', flat=True))
    status_filter = request.query_params.get('status')

    qs = SubscriptionPayment.objects.filter(
        user_id__in=member_ids,
    ).select_related('user', 'plan', 'reviewed_by').order_by('-created_at')

    if status_filter in ('pending', 'approved', 'rejected'):
        qs = qs.filter(status=status_filter)

    limit = min(int(request.query_params.get('limit', 50) or 50), 200)
    payments = qs[:limit]

    data = []
    for p in payments:
        data.append({
            'id': p.id,
            'user_id': p.user_id,
            'user_phone': p.user.phone,
            'user_name': p.user.name,
            'plan_id': p.plan_id,
            'plan_name': p.plan.name if p.plan else None,
            'amount': int(p.amount or 0),
            'status': p.status,
            'receipt_note': p.receipt_note,
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'reviewed_at': p.reviewed_at.isoformat() if p.reviewed_at else None,
        })

    return Response({'success': True, 'data': data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def clinic_admin_me(request):
    """Joriy foydalanuvchi guruh admini ekanligini tekshirish."""
    user = request.user
    return Response({
        'success': True,
        'data': {
            'is_clinic_group_admin': is_clinic_group_admin(user),
            'can_manage_clinic_group': can_manage_clinic_group(user),
            'clinic_group_id': user.clinic_group_id,
            'clinic_group_name': user.clinic_group.name if user.clinic_group else None,
        },
    })
