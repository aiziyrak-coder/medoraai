"""
Authentication URLs
"""
from django.urls import path
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
    UserListAPIView,
    UserDetailAPIView,
)
from .queue_views import queue_list, queue_add, queue_item_detail

app_name = 'accounts'

urlpatterns = [
    # Authentication
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('register/', register, name='register'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    
    # Profile
    path('profile/', profile, name='profile'),
    path('change-password/', change_password, name='change_password'),
    path('password-reset/', password_reset_request, name='password_reset'),
    path('plans/', subscription_plans_list, name='subscription_plans_list'),
    path('subscription/', my_subscription, name='my_subscription'),
    path('send-payment-receipt/', send_payment_receipt, name='send_payment_receipt'),
    
    # User management
    path('users/', UserListAPIView.as_view(), name='user_list'),
    path('users/<int:id>/', UserDetailAPIView.as_view(), name='user_detail'),

    # Navbat (qurilmalar orasida sinxron)
    path('queue/', queue_list, name='queue_list'),
    path('queue/add/', queue_add, name='queue_add'),
    path('queue/<int:item_id>/', queue_item_detail, name='queue_item_detail'),
]
