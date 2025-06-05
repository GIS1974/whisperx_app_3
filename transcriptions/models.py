import uuid
from django.db import models
from media_files.models import MediaFile


class Transcription(models.Model):
    """
    Model to store transcription results and generated subtitle files.
    """

    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # One-to-one relationship with MediaFile
    media_file = models.OneToOneField(
        MediaFile,
        on_delete=models.CASCADE,
        related_name='transcription'
    )

    # Timestamps
    completed_date = models.DateTimeField(auto_now_add=True)

    # Generated file paths
    vtt_file_path = models.CharField(max_length=512, null=True, blank=True)
    word_level_vtt_file_path = models.CharField(max_length=512, null=True, blank=True)
    srt_file_path = models.CharField(max_length=512, null=True, blank=True)
    txt_file_path = models.CharField(max_length=512, null=True, blank=True)

    # Raw WhisperX output storage
    raw_whisperx_output_path = models.CharField(
        max_length=512,
        null=True,
        blank=True,
        help_text="Path to stored JSON response if too large for DB field"
    )

    # Alternative: store JSON directly in database (for smaller responses)
    raw_whisperx_output = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw JSON response from WhisperX API"
    )

    # Transcription metadata
    word_count = models.IntegerField(null=True, blank=True)
    segment_count = models.IntegerField(null=True, blank=True)
    speaker_count = models.IntegerField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['media_file']),
            models.Index(fields=['-completed_date']),
        ]

    def __str__(self):
        return f"Transcription for {self.media_file.filename_original}"

    @property
    def has_vtt(self):
        """Check if VTT file exists."""
        return bool(self.vtt_file_path)

    @property
    def has_word_level_vtt(self):
        """Check if word-level VTT file exists."""
        return bool(self.word_level_vtt_file_path)

    @property
    def has_srt(self):
        """Check if SRT file exists."""
        return bool(self.srt_file_path)

    @property
    def has_txt(self):
        """Check if TXT file exists."""
        return bool(self.txt_file_path)

    @property
    def has_raw_output(self):
        """Check if raw WhisperX output is available."""
        return bool(self.raw_whisperx_output or self.raw_whisperx_output_path)
