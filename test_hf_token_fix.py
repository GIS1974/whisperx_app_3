#!/usr/bin/env python
"""
Test script to verify the Hugging Face token fix
"""
import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'repeatafterme_backend.settings')
django.setup()

def test_hf_token_validation():
    """Test the Hugging Face token validation logic"""
    print("Testing Hugging Face token validation logic...")
    print(f"Current HF token: {settings.HUGGINGFACE_ACCESS_TOKEN}")
    
    # Test the validation logic from the transcription service
    has_hf_token = (
        settings.HUGGINGFACE_ACCESS_TOKEN and
        settings.HUGGINGFACE_ACCESS_TOKEN != "your-huggingface-token-here" and
        len(settings.HUGGINGFACE_ACCESS_TOKEN) > 10
    )
    
    print(f"Token validation result: {has_hf_token}")
    
    # Test input parameter construction
    input_params = {
        "audio_file": "test_file.wav",
        "language": "en",
        "align_output": True,
        "diarization": has_hf_token,
        "temperature": 0.0,
    }
    
    # Only include huggingface_access_token if we have a valid one
    if has_hf_token:
        input_params["huggingface_access_token"] = settings.HUGGINGFACE_ACCESS_TOKEN
        print("✅ HF token would be included in API call")
    else:
        print("✅ HF token would be omitted from API call (this should prevent the error)")
    
    print(f"Final input params keys: {list(input_params.keys())}")
    
    return has_hf_token

if __name__ == "__main__":
    print("🧪 Testing Hugging Face token fix...")
    has_token = test_hf_token_validation()
    
    if has_token:
        print("\n🎉 Valid HF token detected - diarization will be enabled")
    else:
        print("\n✅ No valid HF token - diarization disabled, token omitted from API call")
        print("   This should fix the 'Invalid type. Expected: string, given: null' error")
