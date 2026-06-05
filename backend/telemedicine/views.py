import secrets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TeleSession


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_session(request):
    code = secrets.token_urlsafe(8)[:12]
    session = TeleSession.objects.create(
        room_code=code,
        created_by=request.user,
        patient_label=request.data.get('patient_label', ''),
    )
    return Response({'success': True, 'data': {'room_code': code, 'session_id': session.id}})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def signal(request, room_code: str):
    session = TeleSession.objects.filter(room_code=room_code, active=True).first()
    if not session:
        return Response({'success': False, 'error': 'Sessiya topilmadi'}, status=404)

    if request.method == 'GET':
        return Response({
            'success': True,
            'data': {
                'offer_sdp': session.offer_sdp,
                'answer_sdp': session.answer_sdp,
                'ice_candidates': session.ice_candidates,
            },
        })

    msg_type = request.data.get('type')
    if msg_type == 'offer':
        session.offer_sdp = request.data.get('sdp', '')
    elif msg_type == 'answer':
        session.answer_sdp = request.data.get('sdp', '')
    elif msg_type == 'ice':
        candidates = list(session.ice_candidates or [])
        candidates.append(request.data.get('candidate'))
        session.ice_candidates = candidates[-20:]
    session.save()
    return Response({'success': True})
