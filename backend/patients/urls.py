"""
Patient URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PatientViewSet

router = DefaultRouter()
router.register(r'', PatientViewSet, basename='patient')

app_name = 'patients'

urlpatterns = [
    path('', include(router.urls)),
]
