import uuid
from django.db import models
from django.contrib.auth.models import User


class MediaFile(models.Model):
    """
    Model to store uploaded media files (audio/video) and their metadata.
    """

    FILE_TYPE_CHOICES = [
        ('video', 'Video'),
        ('audio', 'Audio'),
    ]

    STATUS_CHOICES = [
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
    ]

    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('es', 'Spanish'),
        ('fr', 'French'),
        ('de', 'German'),
        ('ja', 'Japanese'),
    ]

    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # User association
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_files')

    # File metadata
    filename_original = models.CharField(max_length=255)
    filesize_bytes = models.BigIntegerField()
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    mime_type = models.CharField(max_length=100)

    # Timestamps
    upload_date = models.DateTimeField(auto_now_add=True)

    # Media properties
    duration_seconds = models.IntegerField(null=True, blank=True)
    language_transcription = models.CharField(max_length=10, choices=LANGUAGE_CHOICES, default='en')

    # Processing status
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending_upload')
    replicate_job_id = models.CharField(max_length=100, null=True, blank=True)

    # File paths
    storage_path_original = models.CharField(max_length=512, null=True, blank=True)
    storage_path_audio = models.CharField(max_length=512, null=True, blank=True)

    # Error handling
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-upload_date']
        indexes = [
            models.Index(fields=['user', '-upload_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.filename_original} ({self.user.username})"

    @property
    def is_processing(self):
        """Check if the file is currently being processed."""
        processing_statuses = [
            'uploading', 'uploaded_processing_assembly',
            'processing_audio', 'pending_transcription', 'transcribing'
        ]
        return self.status in processing_statuses

    @property
    def is_completed(self):
        """Check if the file processing is completed."""
        return self.status == 'completed'

    @property
    def has_failed(self):
        """Check if the file processing has failed."""
        return self.status.startswith('failed_')


class ChunkUpload(models.Model):
    """
    Model to track individual chunks during chunked file upload.
    """

    # Upload session identifier
    upload_id = models.UUIDField(default=uuid.uuid4)

    # User association
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    # Chunk metadata
    chunk_number = models.IntegerField()
    total_chunks = models.IntegerField()
    chunk_size = models.IntegerField()

    # File metadata
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)
    total_size = models.BigIntegerField()

    # Chunk storage
    chunk_file = models.FileField(upload_to='temp_chunks/')

    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # Status
    is_assembled = models.BooleanField(default=False)

    class Meta:
        unique_together = ['upload_id', 'chunk_number']
        indexes = [
            models.Index(fields=['upload_id']),
            models.Index(fields=['user', '-uploaded_at']),
        ]

    def __str__(self):
        return f"Chunk {self.chunk_number}/{self.total_chunks} for {self.filename}"
