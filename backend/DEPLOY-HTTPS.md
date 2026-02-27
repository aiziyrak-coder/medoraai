# Medora — To'liq HTTPS sozlash

Ikkala domen **https** orqali ishlashi uchun quyidagi qadamlarni serverda bajarish.

## 1. Sertifikatlar (Certbot)

```bash
# medoraapi.ziyrak.org uchun cert (medora.ziyrak.org allaqachon bo'lsa ham)
sudo certbot certonly --nginx -d medoraapi.ziyrak.org

# Agar ikkalasi uchun bitta cert kerak bo'lsa:
# sudo certbot certonly --nginx -d medora.ziyrak.org -d medoraapi.ziyrak.org
```

## 2. Nginx — HTTPS konfig

```bash
# Loyihadagi HTTPS konfigni nusxalash
sudo cp /home/cdcgroup/medora_platform/app/backend/nginx-https.conf /etc/nginx/sites-available/medora-https.conf

# Eski HTTP konfigni o'chirib, yangisini ulash
sudo rm -f /etc/nginx/sites-enabled/medora-http.conf
sudo ln -sf /etc/nginx/sites-available/medora-https.conf /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

## 3. Backend .env (Django)

```bash
nano ~/medora_platform/app/backend/.env
```

- `CORS_ALLOWED_ORIGINS` da **https://medora.ziyrak.org** bo'lsin (http olib tashlansa ham bo'ladi).
- `SECURE_SSL_REDIRECT=True` qo'shing yoki o'chirmang.

```env
CORS_ALLOWED_ORIGINS=https://medora.ziyrak.org,http://localhost:3000,http://localhost:5173
SECURE_SSL_REDIRECT=True
```

```bash
sudo systemctl restart medora
```

## 4. Frontend — API https, qayta build

```bash
cd ~/medora_platform/app/frontend
# .env.production da: VITE_API_BASE_URL=https://medoraapi.ziyrak.org/api
grep VITE_API .env.production
npm run build
```

## 5. Tekshirish

- https://medora.ziyrak.org
- https://medoraapi.ziyrak.org/api/
- https://medoraapi.ziyrak.org/admin/

Azure NSG da **443** port ochiq bo'lishi kerak.
