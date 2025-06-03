import os
import uuid
import logging
import subprocess
import threading
from pathlib import Path
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from .models import MediaFile, ChunkUpload

logger = logging.getLogger(__name__)


class FileUploadService:
    """Service for handling file uploads and chunk assembly."""

    @staticmethod
    def save_chunk(user, upload_id, chunk_number, total_chunks,
                   filename, file_type, total_size, chunk_file):
        """
        Save an individual chunk to temporary storage.
        """
        chunk_upload = ChunkUpload.objects.create(
            upload_id=upload_id,
            user=user,
            chunk_number=chunk_number,
            total_chunks=total_chunks,
            chunk_size=chunk_file.size,
            filename=filename,
            file_type=file_type,
            total_size=total_size,
            chunk_file=chunk_file
        )

        logger.info(f"Saved chunk {chunk_number}/{total_chunks} for upload {upload_id}")
        return chunk_upload

    @staticmethod
    def assemble_chunks(upload_id, user):
        """
        Assemble all chunks into the final file.
        """
        chunks = ChunkUpload.objects.filter(
            upload_id=upload_id,
            user=user
        ).order_by('chunk_number')

        if not chunks.exists():
            raise ValueError("No chunks found for upload")

        first_chunk = chunks.first()
        total_chunks = first_chunk.total_chunks

        if chunks.count() != total_chunks:
            raise ValueError(f"Missing chunks: expected {total_chunks}, got {chunks.count()}")

        # Create MediaFile entry
        media_file = MediaFile.objects.create(
            user=user,
            filename_original=first_chunk.filename,
            filesize_bytes=first_chunk.total_size,
            file_type=first_chunk.file_type,
            mime_type=FileUploadService._get_mime_type(first_chunk.filename),
            status='uploaded_processing_assembly'
        )

        try:
            # Create storage directory
            storage_dir = Path(settings.MEDIA_ROOT) / 'uploads' / 'originals' / str(user.id) / str(media_file.id)
            storage_dir.mkdir(parents=True, exist_ok=True)

            # Assemble file
            output_path = storage_dir / first_chunk.filename

            with open(output_path, 'wb') as output_file:
                for chunk in chunks:
                    with open(chunk.chunk_file.path, 'rb') as chunk_file:
                        output_file.write(chunk_file.read())

            # Update MediaFile with storage path
            relative_path = os.path.relpath(output_path, settings.MEDIA_ROOT)
            media_file.storage_path_original = relative_path
            media_file.status = 'processing_audio'
            media_file.save()

            # Mark chunks as assembled
            chunks.update(is_assembled=True)

            # Cleanup chunk files
            FileUploadService._cleanup_chunks(chunks)

            logger.info(f"Successfully assembled file {media_file.id}")
            return media_file

        except Exception as e:
            media_file.status = 'failed_assembly'
            media_file.error_message = str(e)
            media_file.save()
            logger.error(f"Error assembling chunks for {upload_id}: {str(e)}")
            raise

    @staticmethod
    def _get_mime_type(filename):
        """Get MIME type based on file extension."""
        ext = Path(filename).suffix.lower()
        mime_types = {
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
            '.mkv': 'video/x-matroska',
        }
        return mime_types.get(ext, 'application/octet-stream')

    @staticmethod
    def _cleanup_chunks(chunks):
        """Remove chunk files from disk."""
        for chunk in chunks:
            try:
                if chunk.chunk_file and os.path.exists(chunk.chunk_file.path):
                    os.remove(chunk.chunk_file.path)
            except Exception as e:
                logger.warning(f"Error removing chunk file {chunk.chunk_file.path}: {str(e)}")

    @staticmethod
    def cleanup_media_file(media_file):
        """Remove all files associated with a MediaFile."""
        files_to_remove = []

        if media_file.storage_path_original:
            files_to_remove.append(
                os.path.join(settings.MEDIA_ROOT, media_file.storage_path_original)
            )

        if media_file.storage_path_audio:
            files_to_remove.append(
                os.path.join(settings.MEDIA_ROOT, media_file.storage_path_audio)
            )

        for file_path in files_to_remove:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Removed file: {file_path}")
            except Exception as e:
                logger.warning(f"Error removing file {file_path}: {str(e)}")


class AudioChunkingService:
    """Service for splitting large audio files into chunks for Replicate API."""

    @staticmethod
    def split_audio_if_needed(audio_path, max_size_mb=95):
        """
        Split audio file into chunks if it exceeds the size limit.

        This method first tries the optimized approach (95MB threshold, 90MB chunks).
        If you need smaller chunks due to network issues, call split_audio_with_smaller_chunks().
        """
        return AudioChunkingService._split_audio_internal(audio_path, max_size_mb)

    @staticmethod
    def split_audio_with_smaller_chunks(audio_path, max_size_mb=50):
        """
        Split audio file into smaller chunks for better network reliability.
        Use this as a fallback when large chunks fail due to connection issues.
        """
        logger.info(f"Using smaller chunks ({max_size_mb}MB) for better network reliability")

        # Use different chunk sizes based on threshold
        if max_size_mb <= 25:
            target_chunk_size_mb = 15  # Ultra-conservative for very unreliable networks (reduced from 20MB)
        else:
            target_chunk_size_mb = 45  # Conservative for moderately unreliable networks

        return AudioChunkingService._split_audio_internal(audio_path, max_size_mb, target_chunk_size_mb=target_chunk_size_mb)

    @staticmethod
    def _split_audio_internal(audio_path, max_size_mb=95, target_chunk_size_mb=None):
        """
        Internal method to split audio file into chunks if it exceeds the size limit.
        Returns list of chunk file paths.

        Args:
            audio_path: Path to the audio file
            max_size_mb: Maximum size threshold for chunking
            target_chunk_size_mb: Target size for each chunk when chunking is needed

        Returns:
            List of chunk file paths
        """
        file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)

        if file_size_mb <= max_size_mb:
            # File is small enough, return as single chunk
            return [audio_path]

        # When chunking is needed, use specified target chunk size or default
        if target_chunk_size_mb is None:
            target_chunk_size_mb = 90  # Default: 90MB chunks for optimal performance

        # Calculate chunk duration based on file size
        # Estimate: 16kHz mono WAV is approximately 32KB per second
        estimated_duration_seconds = file_size_mb * 1024 * 1024 / (16000 * 2)  # 2 bytes per sample
        chunk_duration_seconds = int((estimated_duration_seconds * target_chunk_size_mb) / file_size_mb)

        # Ensure minimum chunk duration of 30 seconds
        chunk_duration_seconds = max(30, chunk_duration_seconds)

        logger.info(f"Splitting audio file ({file_size_mb:.2f}MB) into ~{target_chunk_size_mb}MB chunks of {chunk_duration_seconds}s")

        # Create chunks directory
        audio_path_obj = Path(audio_path)
        chunks_dir = audio_path_obj.parent / 'chunks'
        chunks_dir.mkdir(exist_ok=True)

        chunk_paths = []
        chunk_number = 0
        start_time = 0

        while start_time < estimated_duration_seconds:
            chunk_path = chunks_dir / f"chunk_{chunk_number:03d}.wav"

            # FFmpeg command to extract chunk
            cmd = [
                settings.FFMPEG_BINARY,
                '-i', str(audio_path),
                '-ss', str(start_time),  # Start time
                '-t', str(chunk_duration_seconds),  # Duration
                '-acodec', 'pcm_s16le',  # Same format as original
                '-ar', '16000',
                '-ac', '1',
                '-y',  # Overwrite
                str(chunk_path)
            ]

            logger.info(f"Creating chunk {chunk_number}: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes timeout per chunk
            )

            if result.returncode == 0 and os.path.exists(chunk_path):
                chunk_size_mb = os.path.getsize(chunk_path) / (1024 * 1024)
                logger.info(f"Created chunk {chunk_number}: {chunk_size_mb:.2f}MB")
                chunk_paths.append(str(chunk_path))
                chunk_number += 1
                start_time += chunk_duration_seconds
            else:
                logger.error(f"Failed to create chunk {chunk_number}: {result.stderr}")
                break

        return chunk_paths


class AudioProcessingService:
    """Service for audio extraction and processing."""

    @staticmethod
    def extract_audio_async(media_file):
        """
        Extract audio from video file asynchronously.
        """
        thread = threading.Thread(
            target=AudioProcessingService._extract_audio,
            args=(media_file,)
        )
        thread.daemon = True
        thread.start()

    @staticmethod
    def convert_audio_async(media_file):
        """
        Convert audio file to required format asynchronously.
        """
        thread = threading.Thread(
            target=AudioProcessingService._convert_audio,
            args=(media_file,)
        )
        thread.daemon = True
        thread.start()

    @staticmethod
    def _extract_audio(media_file):
        """
        Extract audio from video file using FFmpeg.
        """
        try:
            input_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_original)

            # Create audio storage directory
            audio_dir = Path(settings.MEDIA_ROOT) / 'uploads' / 'audio' / str(media_file.user.id) / str(media_file.id)
            audio_dir.mkdir(parents=True, exist_ok=True)

            output_path = audio_dir / f"{media_file.id}.wav"

            # FFmpeg command for high-quality audio extraction (WAV PCM format)
            # Following FFmpeg_settings.md recommendations for optimal WhisperX quality
            cmd = [
                settings.FFMPEG_BINARY,
                '-i', input_path,
                '-vn',  # No video
                '-acodec', 'pcm_s16le',  # 16-bit PCM (uncompressed, high quality)
                '-ar', '16000',  # 16kHz sample rate (optimal for WhisperX)
                '-ac', '1',  # Mono channel
                '-y',  # Overwrite output file
                str(output_path)  # WAV file with PCM format
            ]

            logger.info(f"Extracting audio for {media_file.id}: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )

            if result.returncode == 0:
                # Update MediaFile with audio path
                relative_path = os.path.relpath(output_path, settings.MEDIA_ROOT)
                media_file.storage_path_audio = relative_path
                media_file.status = 'pending_transcription'
                media_file.save()

                logger.info(f"Successfully extracted audio for {media_file.id}")

                # Start transcription
                from transcriptions.services import TranscriptionService
                TranscriptionService.start_transcription_async(media_file)

            else:
                media_file.status = 'failed_extraction'
                media_file.error_message = f"FFmpeg error: {result.stderr}"
                media_file.save()
                logger.error(f"FFmpeg extraction failed for {media_file.id}: {result.stderr}")

        except subprocess.TimeoutExpired:
            media_file.status = 'failed_extraction'
            media_file.error_message = "Audio extraction timed out"
            media_file.save()
            logger.error(f"Audio extraction timed out for {media_file.id}")

        except Exception as e:
            media_file.status = 'failed_extraction'
            media_file.error_message = str(e)
            media_file.save()
            logger.error(f"Error extracting audio for {media_file.id}: {str(e)}")

    @staticmethod
    def _convert_audio(media_file):
        """
        Convert audio file to required format using FFmpeg.
        """
        try:
            input_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_original)

            # Create audio storage directory
            audio_dir = Path(settings.MEDIA_ROOT) / 'uploads' / 'audio' / str(media_file.user.id) / str(media_file.id)
            audio_dir.mkdir(parents=True, exist_ok=True)

            output_path = audio_dir / f"{media_file.id}.wav"

            # FFmpeg command for high-quality audio conversion (WAV PCM format)
            # Following FFmpeg_settings.md recommendations for optimal WhisperX quality
            cmd = [
                settings.FFMPEG_BINARY,
                '-i', input_path,
                '-acodec', 'pcm_s16le',  # 16-bit PCM (uncompressed, high quality)
                '-ar', '16000',  # 16kHz sample rate (optimal for WhisperX)
                '-ac', '1',  # Mono channel
                '-y',  # Overwrite output file
                str(output_path)  # WAV file with PCM format
            ]

            logger.info(f"Converting audio for {media_file.id}: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )

            if result.returncode == 0:
                # Update MediaFile with audio path
                relative_path = os.path.relpath(output_path, settings.MEDIA_ROOT)
                media_file.storage_path_audio = relative_path
                media_file.status = 'pending_transcription'
                media_file.save()

                logger.info(f"Successfully converted audio for {media_file.id}")

                # Start transcription
                from transcriptions.services import TranscriptionService
                TranscriptionService.start_transcription_async(media_file)

            else:
                media_file.status = 'failed_extraction'
                media_file.error_message = f"FFmpeg error: {result.stderr}"
                media_file.save()
                logger.error(f"FFmpeg conversion failed for {media_file.id}: {result.stderr}")

        except subprocess.TimeoutExpired:
            media_file.status = 'failed_extraction'
            media_file.error_message = "Audio conversion timed out"
            media_file.save()
            logger.error(f"Audio conversion timed out for {media_file.id}")

        except Exception as e:
            media_file.status = 'failed_extraction'
            media_file.error_message = str(e)
            media_file.save()
            logger.error(f"Error converting audio for {media_file.id}: {str(e)}")
