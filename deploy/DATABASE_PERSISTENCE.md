# Ma'lumotlar bazasi — serverda saqlash (restart dan keyin ham)

Barcha tahlillar, bemorlar va foydalanuvchi ma'lumotlari **SQL bazada** (SQLite yoki PostgreSQL) saqlanadi. Server qayta ishga tushsa ham ma'lumotlar **o'chib ketmaydi**.

## Serverda (MedoraAI — /root/medoraai)

- **Baza fayli:** `/root/medoraai/backend/db.sqlite3`
- Deploy skripti (`server-deploy.sh`) avtomatik `.env` ga `DB_NAME=/root/medoraai/backend/db.sqlite3` qo'shadi.
- Restart (systemctl restart, server reboot) dan keyin ham baza **shu faylda** qoladi.

## Tekshirish

```bash
# Baza fayli mavjudligi
ls -la /root/medoraai/backend/db.sqlite3

# .env da DB_NAME
grep DB_NAME /root/medoraai/backend/.env
```

## Muhim

- `db.sqlite3` faylini **o'chirmang** va `git` ga commit qilmang (`.gitignore` da).
- Backup olish: `cp /root/medoraai/backend/db.sqlite3 /backup/db.sqlite3.$(date +%Y%m%d)`
