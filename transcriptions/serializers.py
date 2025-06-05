from rest_framework import serializers
from .models import Transcription
from media_files.serializers import MediaFileSerializer


class TranscriptionSerializer(serializers.ModelSerializer):
    """Serializer for Transcription model."""
    
    media_file = MediaFileSerializer(read_only=True)
    has_vtt = serializers.ReadOnlyField()
    has_srt = serializers.ReadOnlyField()
    has_txt = serializers.ReadOnlyField()
    has_raw_output = serializers.ReadOnlyField()
    
    class Meta:
        model = Transcription
        fields = [
            'id', 'media_file', 'completed_date', 'vtt_file_path', 'word_level_vtt_file_path',
            'srt_file_path', 'txt_file_path', 'raw_whisperx_output_path',
            'raw_whisperx_output', 'word_count', 'segment_count',
            'speaker_count', 'has_vtt', 'has_word_level_vtt', 'has_srt', 'has_txt', 'has_raw_output'
        ]
        read_only_fields = [
            'id', 'completed_date', 'vtt_file_path', 'word_level_vtt_file_path', 'srt_file_path',
            'txt_file_path', 'raw_whisperx_output_path', 'raw_whisperx_output',
            'word_count', 'segment_count', 'speaker_count'
        ]


class TranscriptionDetailSerializer(TranscriptionSerializer):
    """Detailed serializer for Transcription model including raw output."""
    
    class Meta(TranscriptionSerializer.Meta):
        fields = TranscriptionSerializer.Meta.fields + ['raw_whisperx_output']


class SubtitleFileSerializer(serializers.Serializer):
    """Serializer for subtitle file download responses."""
    
    file_type = serializers.ChoiceField(choices=['vtt', 'srt', 'txt'])
    filename = serializers.CharField()
    content = serializers.CharField()
    content_type = serializers.CharField()
