"""
Authentication URLs
"""
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from .views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    register,
    profile,
    change_password,
    password_reset_request,
    subscription_plans_list,
    my_subscription,
    send_payment_receipt,
    telegram_webhook,
    logout_session,
    rector_dashboard_stats,
    UserListAPIView,
    UserDetailAPIView,
    ClinicRegistrarsAPIView,
)
from .clinic_admin_views import (
    clinic_admin_stats,
    clinic_admin_me,
    clinic_admin_payments,
    ClinicAdminUserListCreateView,
    ClinicAdminUserDetailView,
    clinic_admin_reset_password,
    clinic_admin_logout_user,
    clinic_admin_activate_subscription,
)

app_name = 'accounts'

urlpatterns = [
    # Authentication (CSRF exempt  -  SPA/JWT, body o'qilishi uchun)
    path('login/', csrf_exempt(CustomTokenObtainPairView.as_view()), name='login'),
    path('register/', register, name='register'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    
    # Profile
    path('profile/', profile, name='profile'),
    path('change-password/', change_password, name='change_password'),
    path('password-reset/', password_reset_request, name='password_reset'),
    path('plans/', subscription_plans_list, name='subscription_plans_list'),
    path('subscription/', my_subscription, name='my_subscription'),
    path('send-payment-receipt/', send_payment_receipt, name='send_payment_receipt'),
    path('telegram-webhook/', telegram_webhook, name='telegram_webhook'),
    path('logout-session/', logout_session, name='logout_session'),
    path('rektorga/stats/', rector_dashboard_stats, name='rector_dashboard_stats'),
    
    # User management
    path('users/', UserListAPIView.as_view(), name='user_list'),
    path('users/<int:id>/', UserDetailAPIView.as_view(), name='user_detail'),
    path('clinic-registrars/', ClinicRegistrarsAPIView.as_view(), name='clinic_registrars'),

    # Klinika guruhi admini
    path('clinic-admin/me/', clinic_admin_me, name='clinic_admin_me'),
    path('clinic-admin/stats/', clinic_admin_stats, name='clinic_admin_stats'),
    path('clinic-admin/users/', ClinicAdminUserListCreateView.as_view(), name='clinic_admin_users'),
    path('clinic-admin/users/<int:id>/', ClinicAdminUserDetailView.as_view(), name='clinic_admin_user_detail'),
    path('clinic-admin/users/<int:user_id>/reset-password/', clinic_admin_reset_password, name='clinic_admin_reset_password'),
    path('clinic-admin/users/<int:user_id>/logout/', clinic_admin_logout_user, name='clinic_admin_logout_user'),
    path('clinic-admin/users/<int:user_id>/activate-subscription/', clinic_admin_activate_subscription, name='clinic_admin_activate_subscription'),
    path('clinic-admin/payments/', clinic_admin_payments, name='clinic_admin_payments'),

]