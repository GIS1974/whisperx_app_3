import os
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404, HttpResponse
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from media_files.models import MediaFile
from .models import Transcription
from .serializers import TranscriptionSerializer, TranscriptionDetailSerializer


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
    Download subtitle file (VTT, SRT, or TXT).
    """
    if file_type not in ['vtt', 'srt', 'txt']:
        return Response(
            {'error': 'Invalid file type. Must be vtt, srt, or txt'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    try:
        transcription = media_file.transcription

        # Get file path based on type
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
    if file_type not in ['vtt', 'srt']:
        return Response(
            {'error': 'Invalid file type. Must be vtt or srt'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    try:
        transcription = media_file.transcription

        # Get file path based on type
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
            'has_srt': transcription.has_srt,
            'has_txt': transcription.has_txt,
            'word_count': transcription.word_count,
            'segment_count': transcription.segment_count,
            'speaker_count': transcription.speaker_count,
        })
    except Transcription.DoesNotExist:
        response_data['transcription_available'] = False

    return Response(response_data)
