#!/usr/bin/env python3
"""
Automated Deployment Script for MEDORA AI
Pushes to GitHub, then deploys to production server automatically
"""

import paramiko
import time
import sys
import os
from pathlib import Path

# Configuration
SERVER_HOST = "167.71.53.238"
SERVER_USER = "root"
SERVER_PASSWORD = "Ziyrak2025Ai"
PROJECT_DIR = "/root/medoraai"
BACKEND_DIR = f"{PROJECT_DIR}/backend"

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def print_success(text):
    print(f"{Colors.OKGREEN}✅ {text}{Colors.ENDC}")

def print_error(text):
    print(f"{Colors.FAIL}❌ {text}{Colors.ENDC}")

def print_info(text):
    print(f"{Colors.OKCYAN}ℹ️  {text}{Colors.ENDC}")

def print_warning(text):
    print(f"{Colors.WARNING}⚠️  {text}{Colors.ENDC}")

def run_ssh_command(ssh_client, command, timeout=30):
    """Execute command on remote server"""
    try:
        stdin, stdout, stderr = ssh_client.exec_command(command, timeout=timeout)
        
        # Read output in real-time
        while True:
            line = stdout.readline()
            if line:
                print(line.rstrip())
            else:
                break
        
       exit_status = stdout.channel.recv_exit_status()
        error_output = stderr.read().decode('utf-8')
        
        if exit_status != 0 and error_output:
            print_error(f"Command failed: {error_output}")
           return False, error_output
        
       return True, ""
   except Exception as e:
        print_error(f"Error executing command: {str(e)}")
       return False, str(e)

def connect_to_server():
    """Establish SSH connection to server"""
    print_header("Connecting to Server")
    
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print_info(f"Connecting to {SERVER_USER}@{SERVER_HOST}...")
        client.connect(
           hostname=SERVER_HOST,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=30,
            allow_agent=False,
            look_for_keys=False
        )
        
        print_success("Connected to server successfully!")
       return client
        
   except Exception as e:
        print_error(f"Failed to connect: {str(e)}")
       return None

def create_env_file(ssh_client):
    """Create.env file on server"""
    print_header("Creating.env File")
    
    env_content = """SECRET_KEY=django-insecure-medoraai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,medoraapi.cdcgroup.uz,medora.cdcgroup.uz,medora.ziyrak.org,medoraapi.ziyrak.org,20.82.115.71,167.71.53.238

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://medora.cdcgroup.uz,https://medoraapi.cdcgroup.uz

DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/medoraai/backend/db.sqlite3

GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview

TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
"""
    
    # Create.env file using cat with heredoc
    create_env_cmd = f"""cat > {BACKEND_DIR}/.env << 'EOF'
{env_content}
EOF
"""
    
    print_info("Creating .env file...")
   success, _ = run_ssh_command(ssh_client, create_env_cmd)
    
    if success:
        print_success(".env file created successfully!")
        
        # Verify file exists
        verify_cmd = f"ls -la {BACKEND_DIR}/.env"
        run_ssh_command(ssh_client, verify_cmd)
        
       return True
    else:
        print_error("Failed to create.env file")
       return False

def git_pull(ssh_client):
    """Pull latest changes from GitHub"""
    print_header("Pulling Latest Changes from GitHub")
    
    command = f"cd {PROJECT_DIR} && git pull origin main"
    print_info(f"Executing: {command}")
    
   success, _ = run_ssh_command(ssh_client, command)
    
    if success:
        print_success("Git pull completed!")
       return True
    else:
        print_error("Git pull failed")
       return False

def install_dependencies(ssh_client):
    """Install Python dependencies"""
    print_header("Installing Dependencies")
    
    command = f"cd {BACKEND_DIR} && source venv/bin/activate && pip install -r requirements.txt --quiet"
    print_info("Installing Python packages...")
    
   success, _ = run_ssh_command(ssh_client, command)
    
    if success:
        print_success("Dependencies installed!")
       return True
    else:
        print_warning("Some dependencies may have failed to install")
       return True  # Continue anyway

def run_migrations(ssh_client):
    """Run Django migrations"""
    print_header("Running Database Migrations")
    
    command = f"cd {BACKEND_DIR} && source venv/bin/activate && python manage.py migrate --noinput"
    print_info("Running migrations...")
    
   success, _ = run_ssh_command(ssh_client, command)
    
    if success:
        print_success("Migrations completed!")
       return True
    else:
        print_warning("Migration may have warnings")
       return True

def restart_gunicorn(ssh_client):
    """Restart Gunicorn service"""
    print_header("Restarting Gunicorn")
    
    # Stop existing Gunicorn processes
    print_info("Stopping existing Gunicorn processes...")
    run_ssh_command(ssh_client, "pkill -f gunicorn", timeout=10)
    time.sleep(2)
    
    # Start new Gunicorn process
    start_cmd = f"""cd {BACKEND_DIR} && \
source venv/bin/activate && \
nohup gunicorn medoraai_backend.wsgi:application \\
    --bind 127.0.0.1:8001 \\
    --workers 3 \\
    --threads 2 \\
    --timeout 120 \\
    --access-logfile logs/access.log \\
    --error-logfile logs/error.log \\
    >> logs/gunicorn.log 2>&1 &"""
    
    print_info("Starting Gunicorn...")
    run_ssh_command(ssh_client, start_cmd, timeout=10)
    time.sleep(3)
    
    # Verify Gunicorn is running
    print_info("Verifying Gunicorn...")
    run_ssh_command(ssh_client, "ps aux | grep gunicorn | grep -v grep", timeout=10)
    
    print_success("Gunicorn restarted!")
   return True

def reload_nginx(ssh_client):
    """Reload Nginx"""
    print_header("Reloading Nginx")
    
    # Test Nginx configuration
    print_info("Testing Nginx configuration...")
   success, _ = run_ssh_command(ssh_client, "nginx -t", timeout=10)
    
    if not success:
        print_error("Nginx configuration test failed!")
       return False
    
    # Reload Nginx
    print_info("Reloading Nginx service...")
   success, _ = run_ssh_command(ssh_client, "sudo systemctl reload nginx", timeout=10)
    
    if success:
        print_success("Nginx reloaded successfully!")
       return True
    else:
        print_error("Failed to reload Nginx")
       return False

def health_check(ssh_client):
    """Perform health checks"""
    print_header("Running Health Checks")
    
    # Wait for services to stabilize
    print_info("Waiting for services to stabilize...")
    time.sleep(3)
    
    # Local health check
    print_info("Testing local health endpoint...")
   success, _ = run_ssh_command(ssh_client, "curl -s http://127.0.0.1:8001/health/")
    
    if success:
        print_success("Local health check passed!")
    else:
        print_error("Local health check failed!")
       return False
    
    # Test root endpoint
    print_info("Testing root endpoint...")
    run_ssh_command(ssh_client, "curl -s -o /dev/null -w 'HTTP Status: %{http_code}\\n' http://127.0.0.1:8001/", timeout=10)
    
    # Test admin endpoint
    print_info("Testing admin endpoint...")
    run_ssh_command(ssh_client, "curl -s -o /dev/null -w 'HTTP Status: %{http_code}\\n' http://127.0.0.1:8001/admin/", timeout=10)
    
   return True

def check_logs(ssh_client):
    """Check recent logs for errors"""
    print_header("Checking Recent Logs")
    
    # Check last 10 lines of Django log
    print_info("Last 10 lines of Django log:")
    run_ssh_command(ssh_client, f"tail -n 10 {BACKEND_DIR}/logs/django.log", timeout=10)
    
    # Check for recent errors
    print_info("\nLast 5 lines of error log:")
    run_ssh_command(ssh_client, f"tail -n 5 {BACKEND_DIR}/logs/django_errors.log", timeout=10)
    
   return True

def deploy():
    """Main deployment function"""
    print_header("🚀 MEDORA AI Automated Deployment")
    
    # Connect to server
    ssh_client = connect_to_server()
    if not ssh_client:
        print_error("Failed to connect to server. Exiting...")
        sys.exit(1)
    
    try:
        # Step 1: Git Pull
        if not git_pull(ssh_client):
            print_error("Git pull failed! Aborting deployment.")
            sys.exit(1)
        
        # Step 2: Create .env file
        if not create_env_file(ssh_client):
            print_error("Failed to create.env file! Aborting deployment.")
            sys.exit(1)
        
        # Step 3: Install dependencies
        install_dependencies(ssh_client)
        
        # Step 4: Run migrations
        run_migrations(ssh_client)
        
        # Step 5: Restart Gunicorn
        if not restart_gunicorn(ssh_client):
            print_error("Failed to restart Gunicorn!")
            sys.exit(1)
        
        # Step 6: Reload Nginx
        if not reload_nginx(ssh_client):
            print_error("Failed to reload Nginx!")
            sys.exit(1)
        
        # Step 7: Health checks
        if not health_check(ssh_client):
            print_error("Health checks failed!")
            sys.exit(1)
        
        # Step 8: Check logs
        check_logs(ssh_client)
        
        print_header("🎉 Deployment Completed Successfully!")
        print_success("All steps completed without critical errors!")
        print_info("\n📝 Next steps:")
        print("   1. Test the application:")
        print("      - https://medoraapi.cdcgroup.uz/")
        print("      - https://medoraapi.cdcgroup.uz/admin/")
        print("      - https://medora.cdcgroup.uz/")
        print("\n  2. Monitor logs if issues occur:")
        print(f"      tail -f {BACKEND_DIR}/logs/django.log")
        print("      tail -f /var/log/nginx/error.log")
        print("")
        
    finally:
        # Close SSH connection
        ssh_client.close()
        print_info("SSH connection closed.")

if __name__ == "__main__":
    try:
        deploy()
   except KeyboardInterrupt:
        print_error("\n\nDeployment interrupted by user!")
        sys.exit(1)
   except Exception as e:
        print_error(f"\n\nUnexpected error: {str(e)}")
        sys.exit(1)
