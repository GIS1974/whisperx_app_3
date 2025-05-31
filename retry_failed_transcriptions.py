#!/usr/bin/env python
"""
Script to retry failed transcriptions after the Hugging Face token fix
"""
import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'repeatafterme_backend.settings')
django.setup()

from media_files.models import MediaFile
from transcriptions.services import TranscriptionService

def retry_failed_transcriptions():
    """Retry all failed transcriptions"""
    print("🔄 Looking for failed transcriptions to retry...")

    # Get all failed transcriptions
    failed_files = MediaFile.objects.filter(status='failed_transcription')

    print(f"Found {failed_files.count()} failed transcriptions")

    if failed_files.count() == 0:
        print("✅ No failed transcriptions to retry")
        return

    # Show details of failed files
    for i, media_file in enumerate(failed_files[:5], 1):  # Show first 5
        print(f"{i}. File: {media_file.filename_original}")
        print(f"   Error: {media_file.error_message}")
        print(f"   Upload time: {media_file.upload_date}")
        print()

    if failed_files.count() > 5:
        print(f"... and {failed_files.count() - 5} more")
        print()

    # Ask user if they want to retry
    response = input("Do you want to retry all failed transcriptions? (y/N): ").strip().lower()

    if response != 'y':
        print("❌ Retry cancelled")
        return

    print(f"🚀 Retrying {failed_files.count()} failed transcriptions...")

    success_count = 0
    error_count = 0

    for media_file in failed_files:
        try:
            print(f"Retrying: {media_file.filename_original}")

            # Reset status and error message
            media_file.status = 'pending_transcription'
            media_file.error_message = ''
            media_file.save()

            # Start transcription
            TranscriptionService.start_transcription_async(media_file)
            success_count += 1
            print(f"✅ Started transcription for {media_file.filename_original}")

        except Exception as e:
            error_count += 1
            print(f"❌ Failed to retry {media_file.filename_original}: {str(e)}")

    print(f"\n📊 Retry Summary:")
    print(f"   Successfully started: {success_count}")
    print(f"   Errors: {error_count}")
    print(f"\n💡 Check the Django logs and dashboard to monitor progress")

if __name__ == "__main__":
    retry_failed_transcriptions()
