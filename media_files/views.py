import os
import uuid
import logging
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from .models import MediaFile, ChunkUpload
from .serializers import (
    MediaFileSerializer,
    MediaFileCreateSerializer,
    ChunkUploadCreateSerializer
)
from .services import FileUploadService, AudioProcessingService

logger = logging.getLogger(__name__)


class MediaFilePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def media_files_list(request):
    """
    List user's media files or create a new media file entry.
    """
    if request.method == 'GET':
        # For testing without authentication, get all media files
        media_files = MediaFile.objects.all()

        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            media_files = media_files.filter(status=status_filter)

        # Filter by file type if provided
        file_type_filter = request.query_params.get('file_type')
        if file_type_filter:
            media_files = media_files.filter(file_type=file_type_filter)

        paginator = MediaFilePagination()
        page = paginator.paginate_queryset(media_files, request)

        if page is not None:
            serializer = MediaFileSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = MediaFileSerializer(media_files, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = MediaFileCreateSerializer(data=request.data)

        if serializer.is_valid():
            # For testing, create a dummy user or use the first user
            from django.contrib.auth.models import User
            user, created = User.objects.get_or_create(
                username='testuser',
                defaults={'email': 'test@example.com'}
            )
            media_file = serializer.save(user=user)
            response_serializer = MediaFileSerializer(media_file)

            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def media_file_detail(request, file_id):
    """
    Retrieve or delete a specific media file.
    """
    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    if request.method == 'GET':
        serializer = MediaFileSerializer(media_file)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        # Delete associated files
        FileUploadService.cleanup_media_file(media_file)
        media_file.delete()

        return Response(
            {'message': 'Media file deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def upload_chunk(request):
    """
    Upload a file chunk.
    """
    serializer = ChunkUploadCreateSerializer(data=request.data)

    if serializer.is_valid():
        try:
            # For testing, use the same dummy user
            from django.contrib.auth.models import User
            user, _ = User.objects.get_or_create(
                username='testuser',
                defaults={'email': 'test@example.com'}
            )

            chunk_upload = FileUploadService.save_chunk(
                user=user,
                **serializer.validated_data
            )

            # Check if all chunks are uploaded
            upload_id = serializer.validated_data['upload_id']
            total_chunks = serializer.validated_data['total_chunks']

            uploaded_chunks = ChunkUpload.objects.filter(
                upload_id=upload_id,
                user=user
            ).count()

            response_data = {
                'message': 'Chunk uploaded successfully',
                'chunk_number': chunk_upload.chunk_number,
                'uploaded_chunks': uploaded_chunks,
                'total_chunks': total_chunks,
                'upload_complete': uploaded_chunks == total_chunks
            }

            # If all chunks uploaded, trigger assembly
            if uploaded_chunks == total_chunks:
                try:
                    media_file = FileUploadService.assemble_chunks(
                        upload_id=upload_id,
                        user=user
                    )
                    response_data['media_file_id'] = str(media_file.id)

                    # Start audio processing if it's a video file
                    if media_file.file_type == 'video':
                        AudioProcessingService.extract_audio_async(media_file)
                    else:
                        # For audio files, convert to required format
                        AudioProcessingService.convert_audio_async(media_file)

                except Exception as e:
                    logger.error(f"Error assembling chunks: {str(e)}")
                    response_data['assembly_error'] = str(e)

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error uploading chunk: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def serve_media_file(request, file_id):
    """
    Serve the original media file for playback.
    """
    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    if not media_file.storage_path_original:
        raise Http404("Media file not found")

    file_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_original)

    if not os.path.exists(file_path):
        raise Http404("Media file not found on disk")

    try:
        # Support range requests for video streaming
        file_size = os.path.getsize(file_path)

        # Check if this is a range request
        range_header = request.META.get('HTTP_RANGE')
        if range_header:
            # Parse range header (e.g., "bytes=0-1023")
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            end = int(range_match[1]) if range_match[1] else file_size - 1

            # Ensure end doesn't exceed file size
            end = min(end, file_size - 1)
            content_length = end - start + 1

            # Create partial content response
            with open(file_path, 'rb') as f:
                f.seek(start)
                data = f.read(content_length)

            from django.http import HttpResponse
            response = HttpResponse(
                data,
                status=206,  # Partial Content
                content_type=media_file.mime_type
            )
            response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
            response['Accept-Ranges'] = 'bytes'
            response['Content-Length'] = str(content_length)
            response['Content-Disposition'] = f'inline; filename="{media_file.filename_original}"'
            return response
        else:
            # Regular full file response
            response = FileResponse(
                open(file_path, 'rb'),
                content_type=media_file.mime_type
            )
            response['Accept-Ranges'] = 'bytes'
            response['Content-Length'] = str(file_size)
            response['Content-Disposition'] = f'inline; filename="{media_file.filename_original}"'
            return response
    except IOError:
        raise Http404("Error reading media file")


@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # Temporarily allow any for testing
def serve_audio_file(request, file_id):
    """
    Serve the extracted/converted audio file.
    """
    # For testing without authentication, get any media file with this ID
    media_file = get_object_or_404(MediaFile, id=file_id)

    if not media_file.storage_path_audio:
        raise Http404("Audio file not found")

    file_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_audio)

    if not os.path.exists(file_path):
        raise Http404("Audio file not found on disk")

    try:
        response = FileResponse(
            open(file_path, 'rb'),
            content_type='audio/wav'
        )
        response['Content-Disposition'] = f'inline; filename="audio_{media_file.id}.wav"'
        return response
    except IOError:
        raise Http404("Error reading audio file")


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def cancel_upload(request, upload_id):
    """
    Cancel an ongoing chunked upload and cleanup chunks.
    """
    try:
        upload_uuid = uuid.UUID(upload_id)
    except ValueError:
        return Response(
            {'error': 'Invalid upload ID'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Delete all chunks for this upload
    chunks = ChunkUpload.objects.filter(
        upload_id=upload_uuid,
        user=request.user
    )

    if not chunks.exists():
        return Response(
            {'error': 'Upload not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Cleanup chunk files
    for chunk in chunks:
        if chunk.chunk_file and os.path.exists(chunk.chunk_file.path):
            os.remove(chunk.chunk_file.path)

    # Delete chunk records
    chunks.delete()

    return Response(
        {'message': 'Upload cancelled successfully'},
        status=status.HTTP_200_OK
    )