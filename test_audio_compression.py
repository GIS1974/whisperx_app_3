#!/usr/bin/env python
"""
Test audio compression for existing files
"""
import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'repeatafterme_backend.settings')
django.setup()

from media_files.models import MediaFile
from media_files.services import AudioProcessingService

def test_audio_compression():
    """Test audio compression on existing file"""
    print("Testing audio compression...")
    
    # Get the most recent failed file
    media_file = MediaFile.objects.filter(status='failed_transcription').first()
    
    if not media_file:
        print("No failed transcription files found")
        return
    
    print(f"Testing with file: {media_file.filename_original}")
    print(f"File ID: {media_file.id}")
    
    # Check current audio file size
    if media_file.storage_path_audio:
        current_audio_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_audio)
        if os.path.exists(current_audio_path):
            current_size_mb = os.path.getsize(current_audio_path) / (1024 * 1024)
            print(f"Current audio file size: {current_size_mb:.2f} MB")
        
        # Remove old audio file
        try:
            os.remove(current_audio_path)
            print("Removed old audio file")
        except:
            pass
    
    # Reset status and re-extract audio with new compression
    media_file.status = 'processing_audio'
    media_file.storage_path_audio = None
    media_file.error_message = None
    media_file.save()
    
    print("Starting audio re-extraction with compression...")
    AudioProcessingService.extract_audio_async(media_file)
    
    print("Audio extraction started in background. Check logs for progress.")

if __name__ == "__main__":
    test_audio_compression()
