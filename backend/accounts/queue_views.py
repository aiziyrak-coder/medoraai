"""
Navbat API — barcha qurilmalarda sinxron (telefon/kompyuter).
"""
import logging
from django.db import models
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import User, QueueItem

logger = logging.getLogger(__name__)


def _get_queue_owner(request):
    """Navbat egasi: shifokor o'zi yoki registrator uchun bog'langan shifokor."""
    user = request.user
    if user.role == 'doctor':
        return user
    if user.role == 'staff' and user.linked_doctor_id:
        return user.linked_doctor
    return None


def _item_to_frontend(item):
    """QueueItem -> frontend PatientQueueItem format."""
    return {
        'id': str(item.id),
        'firstName': item.first_name,
        'lastName': item.last_name,
        'patientName': f"{item.last_name} {item.first_name}",
        'age': item.age,
        'address': item.address or '',
        'complaints': item.complaints or '',
        'status': item.status,
        'ticketNumber': item.ticket_number,
        'arrivalTime': item.arrival_time or timezone.now().strftime('%H:%M'),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def queue_list(request):
    """Navbat ro'yxati — joriy shifokor (yoki registratorning shifokori) uchun."""
    owner = _get_queue_owner(request)
    if not owner:
        return Response(
            {'success': False, 'error': {'code': 403, 'message': 'Navbat faqat shifokor yoki registrator uchun'}},
            status=status.HTTP_403_FORBIDDEN
        )
    items = QueueItem.objects.filter(doctor=owner).order_by('ticket_number', 'created_at')
    data = [_item_to_frontend(item) for item in items]
    return Response({'success': True, 'data': data})


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
    max_ticket = QueueItem.objects.filter(doctor=owner).aggregate(
        max_ticket=models.Max('ticket_number')
    )['max_ticket'] or 0
    next_ticket = max_ticket + 1
    arrival_time = request.data.get('arrivalTime') or timezone.now().strftime('%H:%M')
    item = QueueItem.objects.create(
        doctor=owner,
        first_name=first_name,
        last_name=last_name,
        age=age,
        address=(request.data.get('address') or '').strip(),
        complaints=(request.data.get('complaints') or '').strip(),
        status='waiting',
        ticket_number=next_ticket,
        arrival_time=arrival_time,
    )
    return Response({'success': True, 'data': _item_to_frontend(item)}, status=status.HTTP_201_CREATED)


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
