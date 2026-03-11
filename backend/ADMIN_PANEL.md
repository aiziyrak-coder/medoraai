# Django Admin panel

## Kirish manzili

- **Production:** https://AiDoktorapi.fargana.uz/admin/
- **Lokal:** http://localhost:8000/admin/

## Login

Loyihada **Username** oвЂrnida **telefon raqam** kiritiladi (masalan: `+998901234567`), keyin parol.

- **Username** = telefon raqam (toвЂliq, masalan `+998901234567`)
- **Password** = superuser paroli

## Serverda superuser yaratish yoki parolni yangilash

Backend papkasida (serverda):

```bash
cd /var/www/AiDoktorai/backend
source venv/bin/activate
python create_superuser.py
```

Default:
- **Telefon:** +998901234567  
- **Parol:** Admin2026!

Boshqa raqam/parol bilan:

```bash
ADMIN_PHONE=+998907863888 ADMIN_PASSWORD=MySecret123 python create_superuser.py
```

Agar bu telefon allaqachon mavjud boвЂlsa, parol yangilanadi va superuser huquqlari beriladi.

## Yodda tuting

- Admin panel faqat **is_staff** va **is_superuser** boвЂlgan foydalanuvchilar uchun ochiq.
- Parolni unutgan boвЂlsangiz, yuqoridagi `create_superuser.py` ni oвЂsha telefon bilan qayta ishlatib parolni yangilang.