# 🔧 DisallowedHost Error Fix - Production Server Update

## Problem
Backend server was rejecting requests with error:
```
DisallowedHost at /
Invalid HTTP_HOST header: 'medoraapi.cdcgroup.uz'
```

## Root Cause
The production server's `.env` file had limited `ALLOWED_HOSTS` configuration.

## Solution Applied

### Local Changes (e:\medoraai\backend\.env)
Updated the following configuration:

**Line 4 - ALLOWED_HOSTS:**
```env
ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org
```

**Line 11 - CORS_ALLOWED_ORIGINS:**
```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz
```

## ⚠️ IMPORTANT: Server Update Required

The `.env` file is NOT tracked by git for security reasons. You need to update it manually on the production server.

### Option 1: SSH Manual Update (Recommended)

```bash
# 1. SSH into server
ssh root@167.71.53.238

# 2. Navigate to backend directory
cd /root/medoraai/backend

# 3. Edit .env file
nano .env

# 4. Update ALLOWED_HOSTS (line 4):
ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org,20.82.115.71,167.71.53.238

# 5. Update CORS_ALLOWED_ORIGINS (line 11):
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz

# 6. Save and exit (Ctrl+O, Enter, Ctrl+X)

# 7. Restart Gunicorn
sudo systemctl restart medoraai-backend

# OR if running manually:
pkill -f gunicorn
source venv/bin/activate
gunicorn medoraai_backend.wsgi:application --bind 127.0.0.1:8001 --workers 3
```

### Option 2: Using Deploy Script with Updated Config

If you have a deployment automation that manages `.env`, make sure it includes the new domains.

## Verification Steps

After updating the server:

1. **Test Backend Direct Access:**
   ```bash
   curl https://medoraapi.cdcgroup.uz/
   ```

2. **Test Django Admin:**
   ```
   https://medoraapi.cdcgroup.uz/admin/
   ```

3. **Test API Endpoint:**
   ```bash
   curl https://medoraapi.cdcgroup.uz/api/auth/profile/ \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Check Frontend Connection:**
   ```
   https://medora.cdcgroup.uz
   ```
   Should connect to backend without errors.

## Files Reference

- **Local dev**: `e:\medoraai\backend\.env` ✅ Already updated
- **Production server**: `/root/medoraai/backend/.env` ⚠️ Needs manual update
- **Template**: `e:\medoraai\backend\.env.example` ✅ Already has correct domains

## Security Notes

⚠️ **NEVER commit `.env` to GitHub!**

The `.env` file contains sensitive information:
- API keys
- Database credentials
- Secret keys
- Domain configurations

Always use `.env.example` as a template and update `.env` files manually on each environment.

## Troubleshooting

If still getting DisallowedHost after restart:

1. Check `.env` file syntax (no spaces around commas)
2. Verify Gunicorn actually restarted
3. Check Nginx is proxying to correct port (8001)
4. Review Django logs: `/root/medoraai/backend/logs/django.log`

## Current Git Status

```
Branch: main
Status: Up to date with origin/main
Last commit: middleware va wsgi o'zgarishlari (d37e453)
```

No git push needed - `.env` changes are local-only by design.

---

**Date Fixed**: March 11, 2026  
**Affected Domains**: medoraapi.cdcgroup.uz, medora.cdcgroup.uz  
**Status**: ✅ Local fixed, ⚠️ Server update pending
