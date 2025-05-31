from django.contrib import admin
from .models import MediaFile, ChunkUpload


@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = [
        'filename_original', 'user', 'file_type', 'status',
        'upload_date', 'filesize_bytes', 'duration_seconds'
    ]
    list_filter = ['file_type', 'status', 'language_transcription', 'upload_date']
    search_fields = ['filename_original', 'user__username', 'user__email']
    readonly_fields = ['id', 'upload_date', 'filesize_bytes']

    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'user', 'filename_original', 'file_type', 'mime_type')
        }),
        ('File Details', {
            'fields': ('filesize_bytes', 'duration_seconds', 'upload_date')
        }),
        ('Processing', {
            'fields': ('status', 'language_transcription', 'replicate_job_id')
        }),
        ('Storage Paths', {
            'fields': ('storage_path_original', 'storage_path_audio'),
            'classes': ('collapse',)
        }),
        ('Error Information', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
    )


@admin.register(ChunkUpload)
class ChunkUploadAdmin(admin.ModelAdmin):
    list_display = [
        'filename', 'user', 'chunk_number', 'total_chunks',
        'uploaded_at', 'is_assembled'
    ]
    list_filter = ['is_assembled', 'file_type', 'uploaded_at']
    search_fields = ['filename', 'user__username', 'upload_id']
    readonly_fields = ['upload_id', 'uploaded_at']
