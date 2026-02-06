# 📤 GitHub'ga Push Qilish Qo'llanmasi

## QADAM 1: GitHub Repository Yaratish

1. https://github.com/aiziyrak-coder/medoraai ga kiring
2. Agar repository bo'sh bo'lsa, "Initialize with README" ni **o'chiring** (agar mavjud bo'lsa)
3. Repository URL ni eslab qoling: `https://github.com/aiziyrak-coder/medoraai.git`

## QADAM 2: Lokalda Git Setup

```powershell
cd E:\medoraai

# Git remote qo'shish
git remote add origin https://github.com/aiziyrak-coder/medoraai.git

# Branch nomini main qilish
git branch -M main

# GitHub'ga push qilish
git push -u origin main
```

Agar GitHub'da authentication kerak bo'lsa:
- Personal Access Token yarating: https://github.com/settings/tokens
- Token yaratganda `repo` scope'ni tanlang
- Push qilganda username va token so'raladi

## QADAM 3: Authentication (Agar kerak bo'lsa)

```powershell
# Username: aiziyrak-coder
# Password: Personal Access Token (parol emas!)
```

Yoki SSH key ishlatish:
```powershell
# SSH key yaratish
ssh-keygen -t ed25519 -C "your_email@example.com"

# Public key'ni GitHub'ga qo'shing
# Settings > SSH and GPG keys > New SSH key

# Remote'ni SSH URL'ga o'zgartirish
git remote set-url origin git@github.com:aiziyrak-coder/medoraai.git
```

## QADAM 4: Push Qilish

```powershell
git push -u origin main
```

## Keyingi Yangilanishlar

Har safar o'zgarish qilganda:
```powershell
git add .
git commit -m "Your commit message"
git push
```
