"""
Custom exception handlers for REST Framework
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    from django.conf import settings
    debug = getattr(settings, 'DEBUG', True)
    safe_message = 'Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.'

    # Customize the response
    if response is not None:
        err_body = response.data if isinstance(response.data, dict) else {'detail': response.data}
        # 4xx: foydalanuvchiga validation xabari; 5xx production: umumiy xabar
        if response.status_code >= 500 and not debug:
            msg, details = safe_message, {}
        else:
            detail_val = err_body.get('detail')
            if isinstance(detail_val, list) and detail_val:
                msg = detail_val[0] if isinstance(detail_val[0], str) else str(detail_val[0])
            elif isinstance(detail_val, str):
                msg = detail_val
            else:
                msg = err_body.get('message') or str(exc)
            details = err_body if debug else {k: v for k, v in err_body.items() if k in ('detail', 'message')}
        custom_response_data = {
            'success': False,
            'error': {'code': response.status_code, 'message': msg, 'details': details}
        }
        response.data = custom_response_data
        logger.error("API Error: %s", exc, exc_info=True)
    else:
        # Handle unexpected errors (500)
        custom_response_data = {
            'success': False,
            'error': {
                'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                'message': safe_message,
                'details': {}
            }
        }
        response = Response(custom_response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        logger.error("Unexpected Error: %s", exc, exc_info=True)

    return response
