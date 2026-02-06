"""
Custom validators for user input
"""
import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_phone_number(value):
    """Validate Uzbekistan phone number format"""
    if not value:
        raise ValidationError(_("Telefon raqami kiritilishi shart"))
    
    cleaned = value.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    
    # Check format: +998XXXXXXXXX or 998XXXXXXXXX
    if not re.match(r'^(\+?998)?[0-9]{9}$', cleaned):
        raise ValidationError(_("Telefon raqami noto'g'ri formatda. Masalan: +998901234567"))
    
    return cleaned


def validate_name(value):
    """Validate name (letters, spaces, hyphens, apostrophes only)"""
    if not value or len(value.strip()) < 2:
        raise ValidationError(_("Ism kamida 2 belgidan iborat bo'lishi kerak"))
    
    if not re.match(r'^[a-zA-Zа-яА-ЯёЁўЎқҚғҒҳҲ\s\'-]+$', value):
        raise ValidationError(_("Ismda faqat harflar, probellar va tire ishlatilishi mumkin"))
    
    return value.strip()


def validate_file_size(file, max_size_mb=10):
    """Validate file size"""
    max_size = max_size_mb * 1024 * 1024
    if file.size > max_size:
        raise ValidationError(_(f"Fayl hajmi {max_size_mb}MB dan oshmasligi kerak"))
    return file


def validate_image_file(file):
    """Validate image file type"""
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']
    if file.content_type not in allowed_types:
        raise ValidationError(_("Faqat rasm fayllari (JPG, PNG, GIF) qabul qilinadi"))
    return file


def sanitize_filename(filename):
    """Sanitize filename to prevent directory traversal"""
    import os
    filename = os.path.basename(filename)
    # Remove any path components
    filename = filename.replace('/', '').replace('\\', '')
    # Limit length
    if len(filename) > 255:
        filename = filename[:255]
    return filename
