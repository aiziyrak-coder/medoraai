#!/usr/bin/env python3
"""Fix nginx cache headers: index.html no-cache so browser always loads fresh JS/CSS"""
import paramiko

SERVER_USER = "root"
SERVER_HOST = "medora.cdcgroup.uz"
SERVER_PASSWORD = "Ziyrak2025Ai"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD,
               timeout=30, allow_agent=False, look_for_keys=False)

# Read config
_, stdout, _ = client.exec_command('cat /etc/nginx/sites-available/medoraai-cdcgroup')
content = stdout.read().decode()

# Find the problematic line (appears twice in config for two server blocks)
OLD = 'location ~* \\.(webmanifest|ico|png|svg|js|css)$ { expires 7d; add_header Cache-Control "public"; }'
NEW = ('location = /index.html { expires -1; add_header Cache-Control "no-cache, no-store, must-revalidate"; }\n'
       '    location ~* \\.(webmanifest|ico|png|svg)$ { expires 7d; add_header Cache-Control "public"; }')

if OLD in content:
    new_content = content.replace(OLD, NEW)
    print(f"Replaced {content.count(OLD)} occurrence(s)")
    
    # Write back
    sftp = client.open_sftp()
    with sftp.open('/etc/nginx/sites-available/medoraai-cdcgroup', 'w') as f:
        f.write(new_content)
    sftp.close()
    
    # Test and reload nginx
    _, stdout, stderr = client.exec_command('nginx -t && systemctl reload nginx')
    out = stdout.read().decode()
    err = stderr.read().decode()
    print("nginx -t output:", err.strip())
    print("Done!")
else:
    print("Pattern not found. Content snippet:")
    idx = content.find('webmanifest')
    print(repr(content[max(0,idx-20):idx+100]))

client.close()
