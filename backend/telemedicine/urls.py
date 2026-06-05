from django.urls import path
from . import views

urlpatterns = [
    path('sessions/', views.create_session, name='tele-create'),
    path('signal/<str:room_code>/', views.signal, name='tele-signal'),
]
