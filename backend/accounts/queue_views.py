"""
Navbat API — barcha qurilmalarda sinxron (telefon/kompyuter).
"""
import logging
from django.conf import settings
from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import User, QueueItem

logger = logging.getLogger(__name__)


def _get_queue_owner(request):
    """Navbat egasi: shifokor o'zi yoki registrator uchun bog'langan shifokor."""
    try:
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', True) or not user.is_authenticated:
            return None
        role = getattr(user, 'role', None)
        if role == 'doctor':
            return user if getattr(user, 'pk', None) else None
        if role == 'staff':
            try:
                linked = getattr(user, 'linked_doctor', None)
                if linked is not None and getattr(linked, 'pk', None):
                    return linked
            except Exception:
                pass
        return None
    except Exception as e:
        logger.warning("_get_queue_owner: %s", e)
        return None


def _item_to_frontend(item):
    """QueueItem -> frontend PatientQueueItem format."""
    try:
        at = item.arrival_time
        arrival_time = at.strftime('%H:%M') if at else timezone.now().strftime('%H:%M')
    except Exception:
        arrival_time = timezone.now().strftime('%H:%M')
    return {
        'id': str(item.id),
        'firstName': getattr(item, 'first_name', '') or '',
        'lastName': getattr(item, 'last_name', '') or '',
        'patientName': f"{getattr(item, 'last_name', '')} {getattr(item, 'first_name', '')}".strip() or '-',
        'age': getattr(item, 'age', '') or '',
        'address': getattr(item, 'address', '') or '',
        'complaints': getattr(item, 'complaints', '') or '',
        'status': getattr(item, 'status', 'waiting') or 'waiting',
        'ticketNumber': getattr(item, 'ticket_number', 0) or 0,
        'arrivalTime': arrival_time,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def queue_list(request):
    """Navbat ro'yxati — shifokor/registrator uchun; boshqalar bo'sh ro'yxat oladi (sahifa xatosiz ishlashi uchun)."""
    try:
        owner = _get_queue_owner(request)
        if not owner:
            return Response({'success': True, 'data': []})
        items = QueueItem.objects.filter(doctor_id=owner.pk).order_by('ticket_number', 'created_at')
        data = []
        for item in items:
            try:
                data.append(_item_to_frontend(item))
            except Exception as e:
                logger.warning("queue_list _item_to_frontend skip item %s: %s", getattr(item, 'pk', item), e)
        return Response({'success': True, 'data': data})
    except Exception as e:
        logger.exception("queue_list error: %s", e)
        err_detail = {'detail': str(e)} if getattr(settings, 'DEBUG', False) else {}
        return Response(
            {'success': False, 'error': {'code': 500, 'message': 'Server xatosi', **err_detail}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def queue_add(request):
    """Navbatga bemor qo'shish."""
    owner = _get_queue_owner(request)
    if not owner:
        return Response(
            {'success': False, 'error': {'code': 403, 'message': 'Navbat faqat shifokor yoki registrator uchun'}},
            status=status.HTTP_403_FORBIDDEN
        )
    first_name = (request.data.get('firstName') or '').strip()
    last_name = (request.data.get('lastName') or '').strip()
    age = str(request.data.get('age') or '').strip()
    if not first_name or not last_name or not age:
        return Response(
            {'success': False, 'error': {'code': 400, 'message': 'Ism, familiya va yosh majburiy'}},
            status=status.HTTP_400_BAD_REQUEST
        )
    try:
        max_ticket = QueueItem.objects.filter(doctor_id=owner.pk).aggregate(
            max_ticket=Max('ticket_number')
        ).get('max_ticket') or 0
        next_ticket = max_ticket + 1
        arrival_time = request.data.get('arrivalTime') or timezone.now().strftime('%H:%M')
        if not isinstance(arrival_time, str):
            arrival_time = str(arrival_time) if arrival_time else timezone.now().strftime('%H:%M')
        item = QueueItem.objects.create(
            doctor_id=owner.pk,
            first_name=first_name,
            last_name=last_name,
            age=age,
            address=(request.data.get('address') or '').strip(),
            complaints=(request.data.get('complaints') or '').strip(),
            status='waiting',
            ticket_number=next_ticket,
            arrival_time=arrival_time[:20],
        )
        return Response({'success': True, 'data': _item_to_frontend(item)}, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.exception("queue_add error: %s", e)
        err_detail = {'detail': str(e)} if getattr(settings, 'DEBUG', False) else {}
        return Response(
            {'success': False, 'error': {'code': 500, 'message': 'Navbatga qo\'shishda xatolik', **err_detail}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def queue_item_detail(request, item_id):
    """Navbat elementini yangilash (PATCH) yoki o'chirish (DELETE)."""
    owner = _get_queue_owner(request)
    if not owner:
        return Response(
            {'success': False, 'error': {'code': 403, 'message': 'Ruxsat yo\'q'}},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        item = QueueItem.objects.get(id=item_id, doctor=owner)
    except QueueItem.DoesNotExist:
        return Response(
            {'success': False, 'error': {'code': 404, 'message': 'Topilmadi'}},
            status=status.HTTP_404_NOT_FOUND
        )
    if request.method == 'DELETE':
        item.delete()
        return Response({'success': True})
    # PATCH
    if 'status' in request.data:
        item.status = request.data['status']
    if 'firstName' in request.data:
        item.first_name = str(request.data['firstName']).strip()
    if 'lastName' in request.data:
        item.last_name = str(request.data['lastName']).strip()
    if 'age' in request.data:
        item.age = str(request.data['age']).strip()
    if 'address' in request.data:
        item.address = str(request.data['address']).strip()
    if 'complaints' in request.data:
        item.complaints = str(request.data['complaints']).strip()
    item.save()
    return Response({'success': True, 'data': _item_to_frontend(item)})
