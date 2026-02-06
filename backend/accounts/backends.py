"""
Custom Authentication Backend for phone-based login
"""
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class PhoneBackend(ModelBackend):
    """Custom authentication backend using phone number"""
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get('username')
        
        if username is None or password is None:
            return None
        
        try:
            # Normalize phone number
            cleaned_phone = username.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            if not cleaned_phone.startswith('+'):
                if cleaned_phone.startswith('998'):
                    cleaned_phone = '+' + cleaned_phone
                else:
                    cleaned_phone = '+998' + cleaned_phone
            
            user = User.objects.get(phone=cleaned_phone)
        except User.DoesNotExist:
            return None
        
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None
