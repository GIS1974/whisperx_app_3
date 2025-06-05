import os
import json
import copy
from pathlib import Path
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404, HttpResponse
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from media_files.models import MediaFile
from .models import Transcription
from .serializers import TranscriptionSerializer, TranscriptionDetailSerializer
from .subtitle_generators import VTTGenerator, WordLevelVTTGenerator, SRTGenerator, TXTGenerator


@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def transcription_detail(request, file_id):
    """
    Get transcription details for a media file.
    """
    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    try:
        transcription = media_file.transcription

        # Use detailed serializer if raw output is requested
        include_raw = request.query_params.get('include_raw', 'false').lower() == 'true'

        if include_raw:
            serializer = TranscriptionDetailSerializer(transcription)
        else:
            serializer = TranscriptionSerializer(transcription)

        return Response(serializer.data)

    except Transcription.DoesNotExist:
        return Response(
            {'error': 'Transcription not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def download_subtitle_file(request, file_id, file_type):
    """
    Download subtitle file (VTT, SRT, TXT, or word-level VTT).
    """
    if file_type not in ['vtt', 'word_vtt', 'srt', 'txt']:
        return Response(
            {'error': 'Invalid file type. Must be vtt, word_vtt, srt, or txt'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    try:
        transcription = media_file.transcription

        # Get file path based on type
        if file_type == 'word_vtt':
            file_path = transcription.word_level_vtt_file_path
        else:
            file_path_attr = f'{file_type}_file_path'
            file_path = getattr(transcription, file_path_attr)

        if not file_path:
            return Response(
                {'error': f'{file_type.upper()} file not available'},
                status=status.HTTP_404_NOT_FOUND
            )

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)

        if not os.path.exists(full_path):
            return Response(
                {'error': f'{file_type.upper()} file not found on disk'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Determine content type
        content_types = {
            'vtt': 'text/vtt',
            'word_vtt': 'text/vtt',
            'srt': 'application/x-subrip',
            'txt': 'text/plain'
        }

        try:
            response = FileResponse(
                open(full_path, 'rb'),
                content_type=content_types[file_type]
            )

            filename = f"{media_file.filename_original}_{file_type}.{file_type}"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            return response

        except IOError:
            return Response(
                {'error': f'Error reading {file_type.upper()} file'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    except Transcription.DoesNotExist:
        return Response(
            {'error': 'Transcription not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def serve_subtitle_file(request, file_id, file_type):
    """
    Serve subtitle file for inline use (e.g., by video player).
    """
    if file_type not in ['vtt', 'word_vtt', 'srt']:
        return Response(
            {'error': 'Invalid file type. Must be vtt, word_vtt, or srt'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    try:
        transcription = media_file.transcription

        # Get file path based on type
        if file_type == 'word_vtt':
            file_path = transcription.word_level_vtt_file_path
        else:
            file_path_attr = f'{file_type}_file_path'
            file_path = getattr(transcription, file_path_attr)

        if not file_path:
            raise Http404(f'{file_type.upper()} file not available')

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)

        if not os.path.exists(full_path):
            raise Http404(f'{file_type.upper()} file not found on disk')

        # Determine content type
        content_types = {
            'vtt': 'text/vtt',
            'word_vtt': 'text/vtt',
            'srt': 'application/x-subrip'
        }

        try:
            response = FileResponse(
                open(full_path, 'rb'),
                content_type=content_types[file_type]
            )

            # Set headers for inline display
            response['Content-Disposition'] = 'inline'
            response['Access-Control-Allow-Origin'] = '*'  # For CORS

            return response

        except IOError:
            raise Http404(f'Error reading {file_type.upper()} file')

    except Transcription.DoesNotExist:
        raise Http404('Transcription not found')


@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def transcription_status(request, file_id):
    """
    Get transcription status for a media file.
    """
    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    response_data = {
        'media_file_id': str(media_file.id),
        'status': media_file.status,
        'is_processing': media_file.is_processing,
        'is_completed': media_file.is_completed,
        'has_failed': media_file.has_failed,
        'error_message': media_file.error_message,
        'replicate_job_id': media_file.replicate_job_id,
    }

    # Add transcription info if available
    try:
        transcription = media_file.transcription
        response_data.update({
            'transcription_available': True,
            'has_vtt': transcription.has_vtt,
            'has_word_level_vtt': transcription.has_word_level_vtt,
            'has_srt': transcription.has_srt,
            'has_txt': transcription.has_txt,
            'word_count': transcription.word_count,
            'segment_count': transcription.segment_count,
            'speaker_count': transcription.speaker_count,
        })
    except Transcription.DoesNotExist:
        response_data['transcription_available'] = False

    return Response(response_data)


@api_view(['PUT'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def update_transcription_segments(request, file_id):
    """
    Update transcription segments with edited content and timing.
    """
    print(f"=== UPDATE TRANSCRIPTION SEGMENTS CALLED ===")
    print(f"File ID: {file_id}")
    print(f"Request method: {request.method}")
    print(f"Request data: {request.data}")

    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)
    print(f"Found media file: {media_file.filename_original}")

    try:
        transcription = media_file.transcription
    except Transcription.DoesNotExist:
        return Response(
            {'error': 'Transcription not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get the updated segments from request data
    updated_segments = request.data.get('segments', [])

    if not updated_segments:
        return Response(
            {'error': 'No segments provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate segments
    for i, segment in enumerate(updated_segments):
        if not all(key in segment for key in ['start', 'end', 'text']):
            return Response(
                {'error': f'Segment {i} missing required fields (start, end, text)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start = float(segment['start'])
            end = float(segment['end'])
            if start < 0 or end <= start:
                return Response(
                    {'error': f'Segment {i} has invalid timing (start: {start}, end: {end})'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {'error': f'Segment {i} has invalid timing values'},
                status=status.HTTP_400_BAD_REQUEST
            )

    # Get the original WhisperX output
    original_output = None
    if transcription.raw_whisperx_output:
        original_output = copy.deepcopy(transcription.raw_whisperx_output)
    elif transcription.raw_whisperx_output_path:
        try:
            full_path = os.path.join(settings.MEDIA_ROOT, transcription.raw_whisperx_output_path)
            with open(full_path, 'r', encoding='utf-8') as f:
                original_output = json.load(f)
        except (IOError, json.JSONDecodeError):
            return Response(
                {'error': 'Could not load original transcription data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    if not original_output or 'segments' not in original_output:
        return Response(
            {'error': 'Original transcription data not available'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Update the segments in the output
    updated_output = copy.deepcopy(original_output)
    updated_output['segments'] = []

    for segment in updated_segments:
        updated_segment = {
            'start': float(segment['start']),
            'end': float(segment['end']),
            'text': segment['text'].strip()
        }

        # Preserve speaker information if available
        if 'speaker' in segment:
            updated_segment['speaker'] = segment['speaker']

        # Preserve words if available (for word-level timing)
        if 'words' in segment:
            updated_segment['words'] = segment['words']

        updated_output['segments'].append(updated_segment)

    # Save the updated output
    if transcription.raw_whisperx_output:
        transcription.raw_whisperx_output = updated_output
    else:
        # Save to file
        try:
            full_path = os.path.join(settings.MEDIA_ROOT, transcription.raw_whisperx_output_path)
            with open(full_path, 'w', encoding='utf-8') as f:
                json.dump(updated_output, f, indent=2, ensure_ascii=False)
        except IOError:
            return Response(
                {'error': 'Could not save updated transcription data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # Regenerate subtitle files with updated content
    try:
        transcription_dir = Path(settings.MEDIA_ROOT) / 'transcriptions' / str(media_file.user.id) / str(media_file.id)
        transcription_dir.mkdir(parents=True, exist_ok=True)

        # Regenerate VTT file
        if transcription.vtt_file_path:
            vtt_path = os.path.join(settings.MEDIA_ROOT, transcription.vtt_file_path)
            VTTGenerator.generate(updated_output, vtt_path)

        # Regenerate word-level VTT file
        if transcription.word_level_vtt_file_path:
            word_vtt_path = os.path.join(settings.MEDIA_ROOT, transcription.word_level_vtt_file_path)
            WordLevelVTTGenerator.generate(updated_output, word_vtt_path)

        # Regenerate SRT file
        if transcription.srt_file_path:
            srt_path = os.path.join(settings.MEDIA_ROOT, transcription.srt_file_path)
            SRTGenerator.generate(updated_output, srt_path)

        # Regenerate TXT file
        if transcription.txt_file_path:
            txt_path = os.path.join(settings.MEDIA_ROOT, transcription.txt_file_path)
            TXTGenerator.generate(updated_output, txt_path)

        # Update segment count
        transcription.segment_count = len(updated_segments)

        # Update word count
        total_words = sum(len(segment['text'].split()) for segment in updated_segments)
        transcription.word_count = total_words

        transcription.save()

        return Response({
            'message': 'Transcription updated successfully',
            'segment_count': transcription.segment_count,
            'word_count': transcription.word_count
        })

    except Exception as e:
        return Response(
            {'error': f'Error regenerating subtitle files: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
