"""
Patient URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PatientViewSet
from .population_views import PopulationViewSet
from .primary_care_views import (
    DispensaryRecordViewSet,
    FamilyPassportMemberViewSet,
    FamilyPassportViewSet,
    MedicalBrigadeViewSet,
    NetworkPlanViewSet,
    PatronageVisitViewSet,
    PreventiveCheckupViewSet,
    PrimaryCareStatsViewSet,
    ScreeningEnrollmentViewSet,
    ScreeningProgramViewSet,
)

router = DefaultRouter()
router.register(r'', PatientViewSet, basename='patient')

population_router = DefaultRouter()
population_router.register(r'', PopulationViewSet, basename='population')

primary_care_router = DefaultRouter()
primary_care_router.register(r'brigades', MedicalBrigadeViewSet, basename='pc-brigade')
primary_care_router.register(r'family-passports', FamilyPassportViewSet, basename='pc-family')
primary_care_router.register(r'family-members', FamilyPassportMemberViewSet, basename='pc-family-member')
primary_care_router.register(r'checkups', PreventiveCheckupViewSet, basename='pc-checkup')
primary_care_router.register(r'screening-programs', ScreeningProgramViewSet, basename='pc-screening-program')
primary_care_router.register(r'screening-enrollments', ScreeningEnrollmentViewSet, basename='pc-screening-enrollment')
primary_care_router.register(r'patronage', PatronageVisitViewSet, basename='pc-patronage')
primary_care_router.register(r'network-plans', NetworkPlanViewSet, basename='pc-network-plan')
primary_care_router.register(r'dispensary', DispensaryRecordViewSet, basename='pc-dispensary')
primary_care_router.register(r'stats', PrimaryCareStatsViewSet, basename='pc-stats')

app_name = 'patients'

urlpatterns = [
    path('population/', include(population_router.urls)),
    path('primary-care/', include(primary_care_router.urls)),
    path('', include(router.urls)),
]