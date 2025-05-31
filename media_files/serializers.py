from rest_framework import serializers
from django.contrib.auth.models import User
from .models import MediaFile, ChunkUpload


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']


class MediaFileSerializer(serializers.ModelSerializer):
    """Serializer for MediaFile model."""
    
    user = UserSerializer(read_only=True)
    is_processing = serializers.ReadOnlyField()
    is_completed = serializers.ReadOnlyField()
    has_failed = serializers.ReadOnlyField()
    
    class Meta:
        model = MediaFile
        fields = [
            'id', 'user', 'filename_original', 'filesize_bytes', 
            'file_type', 'mime_type', 'upload_date', 'duration_seconds',
            'language_transcription', 'status', 'replicate_job_id',
            'storage_path_original', 'storage_path_audio', 'error_message',
            'is_processing', 'is_completed', 'has_failed'
        ]
        read_only_fields = [
            'id', 'user', 'upload_date', 'status', 'replicate_job_id',
            'storage_path_original', 'storage_path_audio', 'error_message'
        ]


class MediaFileCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating MediaFile instances."""
    
    class Meta:
        model = MediaFile
        fields = [
            'filename_original', 'filesize_bytes', 'file_type', 
            'mime_type', 'language_transcription'
        ]
    
    def validate_filesize_bytes(self, value):
        """Validate file size is within limits."""
        max_size = 1024 * 1024 * 1024  # 1GB
        if value > max_size:
            raise serializers.ValidationError(
                f"File size exceeds maximum limit of {max_size} bytes."
            )
        return value
    
    def validate_file_type(self, value):
        """Validate file type is supported."""
        if value not in ['video', 'audio']:
            raise serializers.ValidationError(
                "File type must be either 'video' or 'audio'."
            )
        return value
    
    def validate_mime_type(self, value):
        """Validate MIME type is supported."""
        supported_types = [
            'audio/mpeg',  # .mp3
            'video/mp4',   # .mp4
            'video/x-matroska',  # .mkv
        ]
        if value not in supported_types:
            raise serializers.ValidationError(
                f"MIME type '{value}' is not supported. "
                f"Supported types: {', '.join(supported_types)}"
            )
        return value


class ChunkUploadSerializer(serializers.ModelSerializer):
    """Serializer for ChunkUpload model."""
    
    class Meta:
        model = ChunkUpload
        fields = [
            'upload_id', 'chunk_number', 'total_chunks', 'chunk_size',
            'filename', 'file_type', 'total_size', 'uploaded_at', 'is_assembled'
        ]
        read_only_fields = ['uploaded_at', 'is_assembled']
    
    def validate(self, data):
        """Validate chunk upload data."""
        if data['chunk_number'] < 0 or data['chunk_number'] >= data['total_chunks']:
            raise serializers.ValidationError(
                "Chunk number must be between 0 and total_chunks - 1."
            )
        
        if data['total_chunks'] <= 0:
            raise serializers.ValidationError(
                "Total chunks must be greater than 0."
            )
        
        if data['chunk_size'] <= 0:
            raise serializers.ValidationError(
                "Chunk size must be greater than 0."
            )
        
        return data


class ChunkUploadCreateSerializer(serializers.Serializer):
    """Serializer for creating chunk uploads."""
    
    upload_id = serializers.UUIDField()
    chunk_number = serializers.IntegerField(min_value=0)
    total_chunks = serializers.IntegerField(min_value=1)
    filename = serializers.CharField(max_length=255)
    file_type = serializers.ChoiceField(choices=['video', 'audio'])
    total_size = serializers.IntegerField(min_value=1)
    chunk_file = serializers.FileField()
    
    def validate_total_size(self, value):
        """Validate total file size is within limits."""
        max_size = 1024 * 1024 * 1024  # 1GB
        if value > max_size:
            raise serializers.ValidationError(
                f"Total file size exceeds maximum limit of {max_size} bytes."
            )
        return value
