#!/usr/bin/env python
"""
Check file sizes in the media uploads directory
"""
import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'repeatafterme_backend.settings')
django.setup()

from media_files.models import MediaFile

def check_file_sizes():
    """Check file sizes for uploaded media files"""
    print("Checking file sizes for uploaded media files...")
    
    media_files = MediaFile.objects.all()
    
    for media_file in media_files:
        print(f"\n--- File: {media_file.filename_original} ---")
        print(f"ID: {media_file.id}")
        print(f"Status: {media_file.status}")
        
        # Check original file
        if media_file.storage_path_original:
            original_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_original)
            if os.path.exists(original_path):
                size_mb = os.path.getsize(original_path) / (1024 * 1024)
                print(f"Original file: {size_mb:.2f} MB")
            else:
                print("Original file: NOT FOUND")
        
        # Check audio file
        if media_file.storage_path_audio:
            audio_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_audio)
            if os.path.exists(audio_path):
                size_mb = os.path.getsize(audio_path) / (1024 * 1024)
                print(f"Audio file: {size_mb:.2f} MB")
                
                if size_mb > 25:
                    print(f"⚠️  Audio file too large for Replicate direct upload!")
                else:
                    print(f"✅ Audio file size OK for Replicate")
            else:
                print("Audio file: NOT FOUND")

if __name__ == "__main__":
    check_file_sizes()
