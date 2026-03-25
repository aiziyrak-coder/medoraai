"""
URL configuration for medoraai_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .health import health_check, health_detailed

# Swagger (drf_yasg) optional — may fail if pkg_resources unavailable (e.g. Python 3.14)
_schema_view = None
try:
    from rest_framework import permissions
    from drf_yasg.views import get_schema_view
    from drf_yasg import openapi
    _schema_view = get_schema_view(
        openapi.Info(
            title="MEDORA AI Backend API",
            default_version='v1',
            description="Tibbiy Konsilium Tizimi - Django REST Framework API",
            terms_of_service="https://www.google.com/policies/terms/",
            contact=openapi.Contact(email="contact@medoraai.local"),
            license=openapi.License(name="BSD License"),
        ),
        public=True,
        permission_classes=(permissions.AllowAny,),
    )
except Exception:
    pass


@require_http_methods(["GET"])
def root_view(request):
    """Root endpoint - redirects to API docs"""
    endpoints = {
        'health': '/health/',
        'admin': '/admin/',
        'api': '/api/'
    }
    if _schema_view is not None:
        endpoints['api_docs'] = '/swagger/'
    return JsonResponse({
        'message': 'Farg\'ona JSTI Backend API',
        'version': '1.0.0',
        'endpoints': endpoints,
    })


urlpatterns = [
    path('', root_view, name='root'),
    path('health/', health_check, name='health_check'),
    path('health/detailed/', health_detailed, name='health_detailed'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/patients/', include('patients.urls')),
    path('api/analyses/', include('analyses.urls')),
    path('api/ai/', include('ai_services.urls')),
    path('api/ziyrak/', include('ai_services.ziyrak_urls')),
]
if _schema_view is not None:
    urlpatterns += [
        path('swagger/', _schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
        path('redoc/', _schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
        path('api/docs/', _schema_view.with_ui('swagger', cache_timeout=0), name='api-docs'),
    ]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


def handler404(request, exception=None):
    """404  -  har doim JSON (API va barcha so'rovlar)."""
    return JsonResponse({
        'success': False,
        'error': {'code': 404, 'message': 'Sahifa topilmadi.', 'details': {}}
    }, status=404, content_type='application/json; charset=utf-8')


def handler500(request):
    """500  -  har doim JSON (aslo HTML xato chiqmasin)."""
    return JsonResponse({
        'success': False,
        'error': {'code': 500, 'message': "Server xatoligi. Iltimos, keyinroq urinib ko'ring.", 'details': {}}
    }, status=500, content_type='application/json; charset=utf-8')