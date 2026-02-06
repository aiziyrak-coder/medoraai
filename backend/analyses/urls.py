"""
Analysis URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnalysisRecordViewSet

router = DefaultRouter()
router.register(r'', AnalysisRecordViewSet, basename='analysis')

app_name = 'analyses'

urlpatterns = [
    path('', include(router.urls)),
]
