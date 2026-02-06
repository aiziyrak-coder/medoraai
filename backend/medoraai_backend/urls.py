"""
URL configuration for medoraai_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from .health import health_check, health_detailed

schema_view = get_schema_view(
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

urlpatterns = [
    # Health checks
    path('health/', health_check, name='health_check'),
    path('health/detailed/', health_detailed, name='health_detailed'),
    
    # Admin
    path('admin/', admin.site.urls),
    
    # API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('api/docs/', schema_view.with_ui('swagger', cache_timeout=0), name='api-docs'),
    
    # API Endpoints
    path('api/auth/', include('accounts.urls')),
    path('api/patients/', include('patients.urls')),
    path('api/analyses/', include('analyses.urls')),
    path('api/ai/', include('ai_services.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
