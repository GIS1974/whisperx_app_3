from django.contrib import admin
from .models import Transcription


@admin.register(Transcription)
class TranscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'media_file', 'completed_date', 'word_count',
        'segment_count', 'speaker_count', 'has_vtt', 'has_srt'
    ]
    list_filter = ['completed_date']
    search_fields = ['media_file__filename_original', 'media_file__user__username']
    readonly_fields = ['id', 'completed_date']

    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'media_file', 'completed_date')
        }),
        ('Generated Files', {
            'fields': ('vtt_file_path', 'srt_file_path', 'txt_file_path')
        }),
        ('Metadata', {
            'fields': ('word_count', 'segment_count', 'speaker_count')
        }),
        ('Raw Data', {
            'fields': ('raw_whisperx_output_path', 'raw_whisperx_output'),
            'classes': ('collapse',)
        }),
    )
