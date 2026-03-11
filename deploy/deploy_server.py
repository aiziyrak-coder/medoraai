#!/usr/bin/env python3
"""
MedoraAI Server Deployment Script
Connects to server via SSH and deploys latest changes
"""

import paramiko
import sys
import time

# Server credentials
SERVER_USER = "root"
SERVER_HOST = "medora.cdcgroup.uz"
SERVER_PASSWORD = "Ziyrak2025Ai"
REMOTE_DIR = "/root/medoraai"

def deploy():
    """Deploy to server via SSH"""
    
    print("=" * 60)
    print(" MedoraAI Server Deployment")
    print("=" * 60)
    print(f"Server: {SERVER_USER}@{SERVER_HOST}")
    print(f"Remote Directory: {REMOTE_DIR}")
    print()
    
    # Create SSH client
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print("[1/4] Connecting to server...")
        client.connect(
            hostname=SERVER_HOST,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=30,
            allow_agent=False,
            look_for_keys=False
        )
        print("✓ Connected successfully")
        print()
        
        # Step 1: Pull from GitHub (with stash to handle local changes)
        print("[2/4] Pulling latest changes from GitHub...")
        stdin, stdout, stderr = client.exec_command(
            f"cd {REMOTE_DIR} && git stash && git pull origin main",
            timeout=60
        )
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if output:
            print(output)
        if error and "error:" not in error.lower():
            print(f"WARNING: {error}")
        
        print("✓ Pull completed")
        print()
        
        # Small delay
        time.sleep(1)
        
        # Step 2: Restart service
        print("[3/4] Restarting backend service...")
        stdin, stdout, stderr = client.exec_command(
            "sudo systemctl restart medoraai-backend-8001.service",
            timeout=30
        )
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if error:
            print(f"ERROR: {error}")
            return False
        
        print("✓ Service restarted")
        print()
        
        # Small delay
        time.sleep(2)
        
        # Step 3: Check service status
        print("[4/4] Checking service status...")
        stdin, stdout, stderr = client.exec_command(
            "sudo systemctl status medoraai-backend-8001.service --no-pager -l",
            timeout=30
        )
        status_output = stdout.read().decode('utf-8')
        print(status_output)
        
        # Check if service is active
        if "active (running)" in status_output:
            print()
            print("=" * 60)
            print(" ✅ DEPLOYMENT SUCCESSFUL!")
            print("=" * 60)
            print()
            print("Backend service is running.")
            print("Test URL: https://medora.cdcgroup.uz/api/ai/clarifying-questions/")
            print()
            return True
        else:
            print()
            print("⚠️  Service may not be running properly. Check logs:")
            print("   sudo journalctl -u medoraai-backend-8001.service -f --no-pager")
            return False
            
    except paramiko.AuthenticationException:
        print("❌ Authentication failed! Check username/password.")
        return False
    except paramiko.SSHException as e:
        print(f"❌ SSH connection error: {e}")
        return False
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    success = deploy()
    sys.exit(0 if success else 1)
