# 📤 GitHub'ga Push Qilish - Qadamma-Qadam

## ✅ QADAM 1: GitHub Remote Qo'shish

PowerShell'da quyidagi buyruqlarni bajaring:

```powershell
cd E:\medoraai

# GitHub remote qo'shish
git remote add origin https://github.com/aiziyrak-coder/medoraai.git

# Tekshirish
git remote -v
```

Natija:
```
origin  https://github.com/aiziyrak-coder/medoraai.git (fetch)
origin  https://github.com/aiziyrak-coder/medoraai.git (push)
```

---

## ✅ QADAM 2: GitHub Authentication

### Variant A: Personal Access Token (Tavsiya etiladi)

1. GitHub'ga kiring: https://github.com/settings/tokens
2. **"Generate new token (classic)"** tugmasini bosing
3. Token nomi: `medoraai-deploy`
4. **Scope'lar**:
   - ✅ `repo` (Full control of private repositories)
5. **"Generate token"** tugmasini bosing
6. Token'ni nusxalab qo'ying (keyin ko'rinmaydi!)

### Variant B: SSH Key (Uzoq muddatli)

```powershell
# SSH key yaratish
ssh-keygen -t ed25519 -C "your_email@example.com"
# Enter 3 marta (default path va parol yo'q)

# Public key'ni ko'rsatish
cat ~/.ssh/id_ed25519.pub
# Bu key'ni GitHub'ga qo'shing: Settings > SSH and GPG keys > New SSH key

# Remote'ni SSH URL'ga o'zgartirish
git remote set-url origin git@github.com:aiziyrak-coder/medoraai.git
```

---

## ✅ QADAM 3: Push Qilish

```powershell
cd E:\medoraai

# Branch nomini tekshirish
git branch

# Push qilish
git push -u origin main
```

**Agar Personal Access Token ishlatayotgan bo'lsangiz:**
- Username: `aiziyrak-coder`
- Password: **Personal Access Token** (parol emas!)

**Agar SSH ishlatayotgan bo'lsangiz:**
- Hech qanday username/password so'ralmaydi

---

## ✅ QADAM 4: Tekshirish

GitHub'ga kiring: https://github.com/aiziyrak-coder/medoraai

Barcha fayllar ko'rinishi kerak!

---

## 🔄 Keyingi Yangilanishlar

Har safar o'zgarish qilganda:

```powershell
cd E:\medoraai

# O'zgarishlarni ko'rish
git status

# Barcha o'zgarishlarni qo'shish
git add .

# Commit qilish
git commit -m "Your commit message here"

# GitHub'ga push qilish
git push
```

---

## 🆘 Muammolar

### "remote origin already exists"
```powershell
git remote remove origin
git remote add origin https://github.com/aiziyrak-coder/medoraai.git
```

### "Authentication failed"
- Personal Access Token to'g'ri ekanligini tekshiring
- Yoki SSH key'ni qo'shing

### "Permission denied"
- GitHub'da repository'ga kirish huquqingiz borligini tekshiring
- Repository public yoki sizga access berilgan bo'lishi kerak

---

**Tayyor! Kod GitHub'da! 🎉**
