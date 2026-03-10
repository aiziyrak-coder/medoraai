"""
Bulk Device Registration Views
"""
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
import logging

from .models import Device
from .serializers import DeviceRegisterSerializer
from .views import MonitoringPermission

logger = logging.getLogger(__name__)


class DeviceBulkRegister(APIView):
    """POST /api/v1/devices/bulk-register - Ko'p qurilmalarni bir vaqtda qo'shish"""
   permission_classes = [MonitoringPermission]

   def post(self, request):
       devices_data = request.data.get('devices', [])
        
       if not devices_data or not isinstance(devices_data, list):
           return Response({
                'success': False,
                'error': 'devices array required'
            }, status=status.HTTP_400_BAD_REQUEST)

       results = {'success': [], 'failed': []}
        
        for device_data in devices_data:
           try:
                serializer = DeviceRegisterSerializer(data=device_data)
               if serializer.is_valid():
                   device = serializer.save()
                   results['success'].append({
                        'serial_number': device.serial_number,
                        'id': device.id,
                        'status': 'created',
                        'message': f"Device {device.serial_number} created successfully"
                    })
                else:
                   results['failed'].append({
                        'data': device_data,
                        'errors': serializer.errors,
                        'status': 'validation_failed'
                    })
           except Exception as e:
                logger.error(f"Device registration failed: {str(e)}")
               results['failed'].append({
                    'data': device_data,
                    'error': str(e),
                    'status': 'error'
                })

       return Response({
            'success': True,
            'total': len(devices_data),
            'created': len(results['success']),
            'failed': len(results['failed']),
            'results': results
        }, status=status.HTTP_201_CREATED)
