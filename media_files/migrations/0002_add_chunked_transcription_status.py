# Generated migration for adding chunked transcription status

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('media_files', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='mediafile',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending_upload', 'Pending Upload'),
                    ('uploading', 'Uploading'),
                    ('uploaded_processing_assembly', 'Processing Assembly'),
                    ('processing_audio', 'Processing Audio'),
                    ('pending_transcription', 'Pending Transcription'),
                    ('transcribing', 'Transcribing'),
                    ('transcribing_chunked', 'Transcribing (Chunked)'),
                    ('completed', 'Completed'),
                    ('failed_upload', 'Failed Upload'),
                    ('failed_assembly', 'Failed Assembly'),
                    ('failed_extraction', 'Failed Audio Extraction'),
                    ('failed_transcription', 'Failed Transcription'),
                    ('failed_audio_too_large', 'Failed - Audio Too Large'),
                ],
                default='pending_upload',
                max_length=30
            ),
        ),
    ]
