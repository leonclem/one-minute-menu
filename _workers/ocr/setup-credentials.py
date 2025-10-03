#!/usr/bin/env python3
"""
Script to set up Google Vision credentials in Railway
"""
import os
import json
import base64

def setup_credentials():
    """Set up Google Vision credentials from environment variable"""
    
    # Check if we're in Railway (production)
    if os.getenv('RAILWAY_ENVIRONMENT'):
        # In Railway, we'll store the JSON as a base64 encoded env var
        encoded_creds = os.getenv('GOOGLE_CREDENTIALS_BASE64')
        if encoded_creds:
            # Decode and write to file
            creds_json = base64.b64decode(encoded_creds).decode('utf-8')
            with open('/app/vision-key.json', 'w') as f:
                f.write(creds_json)
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/app/vision-key.json'
            print("✅ Google Vision credentials set up successfully")
        else:
            print("❌ GOOGLE_CREDENTIALS_BASE64 environment variable not found")
            return False
    else:
        # Local development - use existing file path
        creds_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if creds_path and os.path.exists(creds_path):
            print(f"✅ Using local credentials: {creds_path}")
        else:
            print("❌ Local Google Vision credentials not found")
            return False
    
    return True

if __name__ == "__main__":
    setup_credentials()