import os
import json
import logging
import threading
import time
from pathlib import Path
from django.conf import settings
import replicate
from .models import Transcription
from .subtitle_generators import VTTGenerator, WordLevelVTTGenerator, SRTGenerator, TXTGenerator

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Service for handling WhisperX transcription via Replicate API."""

    @staticmethod
    def start_transcription_async(media_file):
        """
        Start transcription process asynchronously.
        """
        thread = threading.Thread(
            target=TranscriptionService._process_transcription,
            args=(media_file,)
        )
        thread.daemon = True
        thread.start()

    @staticmethod
    def _process_transcription(media_file):
        """
        Process transcription using Replicate API.
        """
        try:
            # Get audio file path
            audio_path = os.path.join(settings.MEDIA_ROOT, media_file.storage_path_audio)
            file_size = os.path.getsize(audio_path)
            file_size_mb = file_size / (1024 * 1024)

            logger.info(f"Processing audio file: {file_size_mb:.2f}MB")

            # Import AudioChunkingService
            from media_files.services import AudioChunkingService

            # Split audio into chunks if needed (100MB Replicate limit)
            # Use ultra-conservative chunking (25MB threshold, 15MB chunks) for maximum reliability
            chunk_paths = AudioChunkingService.split_audio_with_smaller_chunks(audio_path, max_size_mb=25)

            if len(chunk_paths) > 1:
                logger.info(f"Audio file split into {len(chunk_paths)} chunks")
            else:
                logger.info("Audio file fits within size limit, processing as single file")

            # Update status based on whether chunking is needed
            if len(chunk_paths) > 1:
                media_file.status = 'transcribing_chunked'
                logger.info(f"Starting chunked transcription with {len(chunk_paths)} chunks")
            else:
                media_file.status = 'transcribing'
                logger.info("Starting single-file transcription")
            media_file.save()

            # Process chunks sequentially
            all_chunk_results = []
            chunk_start_times = []

            client = replicate.Client(api_token=settings.REPLICATE_API_TOKEN)

            for i, chunk_path in enumerate(chunk_paths):
                logger.info(f"Processing chunk {i+1}/{len(chunk_paths)}: {chunk_path}")

                # Check if chunk file exists
                if not os.path.exists(chunk_path):
                    raise FileNotFoundError(f"Chunk file not found: {chunk_path}")

                chunk_size_mb = os.path.getsize(chunk_path) / (1024 * 1024)
                logger.info(f"Chunk {i+1} size: {chunk_size_mb:.2f}MB")

                # Calculate start time for this chunk (for later alignment)
                if i == 0:
                    chunk_start_time = 0.0
                else:
                    # Estimate chunk duration based on file size
                    # 16kHz mono WAV: ~32KB per second
                    prev_chunk_size = os.path.getsize(chunk_paths[i-1])
                    prev_duration = prev_chunk_size / (16000 * 2)  # 2 bytes per sample
                    chunk_start_time = chunk_start_times[-1] + prev_duration

                chunk_start_times.append(chunk_start_time)

                try:
                    # Process chunk with Replicate API
                    logger.info(f"Attempting to upload chunk {i+1} to Replicate API...")

                    # Check if we have a valid Hugging Face token for diarization
                    has_hf_token = (
                        settings.HUGGINGFACE_ACCESS_TOKEN and
                        settings.HUGGINGFACE_ACCESS_TOKEN != "your-huggingface-token-here" and
                        len(settings.HUGGINGFACE_ACCESS_TOKEN) > 10
                    )

                    # Try multiple times with exponential backoff for reliability
                    max_retries = 3
                    retry_delay = 5  # seconds

                    for attempt in range(max_retries):
                        try:
                            logger.info(f"Chunk {i+1}, attempt {attempt+1}/{max_retries} (size: {chunk_size_mb:.2f}MB)")

                            with open(chunk_path, "rb") as audio_file:
                                # Build input parameters
                                input_params = {
                                    "audio_file": audio_file,
                                    "language": media_file.language_transcription,
                                    "align_output": True,
                                    "diarization": has_hf_token,  # Only enable if we have a valid token
                                    "temperature": 0.0,
                                }

                                # Only include huggingface_access_token if we have a valid one
                                if has_hf_token:
                                    input_params["huggingface_access_token"] = settings.HUGGINGFACE_ACCESS_TOKEN

                                # Create prediction with longer timeout for large files
                                logger.info(f"Uploading {chunk_size_mb:.2f}MB chunk to Replicate API...")
                                prediction = client.predictions.create(
                                    version="victor-upmeet/whisperx-a40-large:1395a1d7aa48a01094887250475f384d4bae08fd0616f9c405bb81d4174597ea",
                                    input=input_params
                                )

                            if not has_hf_token:
                                logger.info(f"Chunk {i+1}: Diarization disabled (no valid Hugging Face token)")

                            logger.info(f"Replicate prediction created for chunk {i+1}: {prediction.id}")
                            break  # Success, exit retry loop

                        except Exception as upload_error:
                            logger.warning(f"Chunk {i+1}, attempt {attempt+1} failed: {str(upload_error)}")
                            if attempt < max_retries - 1:
                                logger.info(f"Retrying chunk {i+1} in {retry_delay} seconds...")
                                time.sleep(retry_delay)
                                retry_delay *= 2  # Exponential backoff
                            else:
                                raise upload_error  # Re-raise on final attempt

                    # Poll for chunk completion
                    chunk_result = TranscriptionService._poll_chunk_completion(prediction.id)

                    if chunk_result:
                        # Adjust timestamps for chunk position
                        adjusted_result = TranscriptionService._adjust_chunk_timestamps(
                            chunk_result, chunk_start_time
                        )
                        all_chunk_results.append(adjusted_result)
                        logger.info(f"Successfully processed chunk {i+1}")
                    else:
                        raise Exception(f"Failed to process chunk {i+1}")

                except Exception as chunk_error:
                    logger.error(f"Error processing chunk {i+1}: {str(chunk_error)}")
                    raise chunk_error

            # Combine all chunk results
            combined_result = TranscriptionService._combine_chunk_results(all_chunk_results)

            # Store the first prediction ID for reference
            if chunk_paths:
                media_file.replicate_job_id = f"chunked_{len(chunk_paths)}_chunks"
                media_file.save()

            logger.info(f"Successfully processed all {len(chunk_paths)} chunks for {media_file.id}")

            # Process the combined result
            TranscriptionService._process_transcription_result(media_file, combined_result)

        except Exception as e:
            media_file.status = 'failed_transcription'
            media_file.error_message = str(e)
            media_file.save()
            logger.error(f"Error starting transcription for {media_file.id}: {str(e)}")

    @staticmethod
    def _poll_chunk_completion(prediction_id):
        """
        Poll Replicate API for chunk completion and return result.
        """
        client = replicate.Client(api_token=settings.REPLICATE_API_TOKEN)
        max_attempts = 360  # 30 minutes with 5-second intervals
        attempt = 0

        while attempt < max_attempts:
            try:
                prediction = client.predictions.get(prediction_id)

                if prediction.status == "succeeded":
                    return prediction.output

                elif prediction.status == "failed":
                    logger.error(f"Chunk prediction {prediction_id} failed: {prediction.error}")
                    return None

                elif prediction.status in ["starting", "processing"]:
                    # Still processing, continue polling
                    time.sleep(5)
                    attempt += 1
                    continue

                else:
                    # Unknown status
                    logger.warning(f"Unknown status for chunk {prediction_id}: {prediction.status}")
                    time.sleep(5)
                    attempt += 1
                    continue

            except Exception as e:
                logger.error(f"Error polling chunk {prediction_id}: {str(e)}")
                time.sleep(5)
                attempt += 1
                continue

        # Timeout reached
        logger.error(f"Chunk polling timed out for {prediction_id}")
        return None

    @staticmethod
    def _adjust_chunk_timestamps(chunk_result, start_time_offset):
        """
        Adjust timestamps in chunk result to account for position in full audio.
        """
        if not isinstance(chunk_result, dict) or 'segments' not in chunk_result:
            return chunk_result

        adjusted_result = chunk_result.copy()
        adjusted_segments = []

        for segment in chunk_result['segments']:
            adjusted_segment = segment.copy()

            # Adjust segment timestamps
            if 'start' in adjusted_segment:
                adjusted_segment['start'] += start_time_offset
            if 'end' in adjusted_segment:
                adjusted_segment['end'] += start_time_offset

            # Adjust word-level timestamps if present
            if 'words' in adjusted_segment:
                adjusted_words = []
                for word in adjusted_segment['words']:
                    adjusted_word = word.copy()
                    if 'start' in adjusted_word:
                        adjusted_word['start'] += start_time_offset
                    if 'end' in adjusted_word:
                        adjusted_word['end'] += start_time_offset
                    adjusted_words.append(adjusted_word)
                adjusted_segment['words'] = adjusted_words

            adjusted_segments.append(adjusted_segment)

        adjusted_result['segments'] = adjusted_segments
        return adjusted_result

    @staticmethod
    def _combine_chunk_results(chunk_results):
        """
        Combine multiple chunk results into a single transcription result.
        """
        if not chunk_results:
            return {}

        if len(chunk_results) == 1:
            return chunk_results[0]

        # Combine all segments
        combined_segments = []
        for chunk_result in chunk_results:
            if isinstance(chunk_result, dict) and 'segments' in chunk_result:
                combined_segments.extend(chunk_result['segments'])

        # Create combined result
        combined_result = {
            'segments': combined_segments
        }

        # Copy other metadata from first chunk if available
        if chunk_results[0] and isinstance(chunk_results[0], dict):
            for key, value in chunk_results[0].items():
                if key != 'segments':
                    combined_result[key] = value

        return combined_result

    @staticmethod
    def _poll_transcription_status(media_file, prediction_id):
        """
        Poll Replicate API for transcription completion.
        """
        client = replicate.Client(api_token=settings.REPLICATE_API_TOKEN)
        max_attempts = 360  # 30 minutes with 5-second intervals
        attempt = 0

        while attempt < max_attempts:
            try:
                prediction = client.predictions.get(prediction_id)

                if prediction.status == "succeeded":
                    # Process successful transcription
                    TranscriptionService._process_transcription_result(
                        media_file,
                        prediction.output
                    )
                    return

                elif prediction.status == "failed":
                    media_file.status = 'failed_transcription'
                    media_file.error_message = f"Replicate job failed: {prediction.error}"
                    media_file.save()
                    logger.error(f"Replicate job {prediction_id} failed: {prediction.error}")
                    return

                elif prediction.status in ["starting", "processing"]:
                    # Still processing, continue polling
                    time.sleep(5)
                    attempt += 1
                    continue

                else:
                    # Unknown status
                    logger.warning(f"Unknown Replicate status for {prediction_id}: {prediction.status}")
                    time.sleep(5)
                    attempt += 1
                    continue

            except Exception as e:
                logger.error(f"Error polling transcription status for {media_file.id}: {str(e)}")
                time.sleep(5)
                attempt += 1
                continue

        # Timeout reached
        media_file.status = 'failed_transcription'
        media_file.error_message = "Transcription polling timed out"
        media_file.save()
        logger.error(f"Transcription polling timed out for {media_file.id}")

    @staticmethod
    def _process_transcription_result(media_file, whisperx_output):
        """
        Process successful transcription result and generate subtitle files.
        """
        try:
            # Create transcription record
            transcription = Transcription.objects.create(
                media_file=media_file
            )

            # Create transcription storage directory
            transcription_dir = Path(settings.MEDIA_ROOT) / 'transcriptions' / str(media_file.user.id) / str(media_file.id)
            transcription_dir.mkdir(parents=True, exist_ok=True)

            # Store raw WhisperX output
            if isinstance(whisperx_output, dict) and len(json.dumps(whisperx_output)) < 1000000:  # 1MB limit
                transcription.raw_whisperx_output = whisperx_output
            else:
                # Store in file if too large
                raw_output_path = transcription_dir / 'raw_whisperx_output.json'
                with open(raw_output_path, 'w', encoding='utf-8') as f:
                    json.dump(whisperx_output, f, indent=2, ensure_ascii=False)

                relative_path = os.path.relpath(raw_output_path, settings.MEDIA_ROOT)
                transcription.raw_whisperx_output_path = relative_path

            # Generate subtitle files
            vtt_path = TranscriptionService._generate_vtt(transcription_dir, whisperx_output)
            word_level_vtt_path = TranscriptionService._generate_word_level_vtt(transcription_dir, whisperx_output)
            srt_path = TranscriptionService._generate_srt(transcription_dir, whisperx_output)
            txt_path = TranscriptionService._generate_txt(transcription_dir, whisperx_output)

            # Update transcription record with file paths
            if vtt_path:
                transcription.vtt_file_path = os.path.relpath(vtt_path, settings.MEDIA_ROOT)
            if word_level_vtt_path:
                transcription.word_level_vtt_file_path = os.path.relpath(word_level_vtt_path, settings.MEDIA_ROOT)
            if srt_path:
                transcription.srt_file_path = os.path.relpath(srt_path, settings.MEDIA_ROOT)
            if txt_path:
                transcription.txt_file_path = os.path.relpath(txt_path, settings.MEDIA_ROOT)

            # Extract metadata
            if isinstance(whisperx_output, dict):
                segments = whisperx_output.get('segments', [])
                transcription.segment_count = len(segments)

                # Count words
                word_count = 0
                for segment in segments:
                    if 'words' in segment:
                        word_count += len(segment['words'])
                    else:
                        # Fallback: estimate from text
                        word_count += len(segment.get('text', '').split())
                transcription.word_count = word_count

                # Count speakers
                speakers = set()
                for segment in segments:
                    if 'speaker' in segment:
                        speakers.add(segment['speaker'])
                transcription.speaker_count = len(speakers) if speakers else 1

            transcription.save()

            # Update media file status
            media_file.status = 'completed'
            media_file.save()

            logger.info(f"Successfully processed transcription for {media_file.id}")

        except Exception as e:
            media_file.status = 'failed_transcription'
            media_file.error_message = f"Error processing transcription result: {str(e)}"
            media_file.save()
            logger.error(f"Error processing transcription result for {media_file.id}: {str(e)}")

    @staticmethod
    def _generate_vtt(output_dir, whisperx_output):
        """Generate VTT subtitle file."""
        try:
            vtt_path = output_dir / 'subtitles.vtt'
            VTTGenerator.generate(whisperx_output, vtt_path)
            return vtt_path
        except Exception as e:
            logger.error(f"Error generating VTT: {str(e)}")
            return None

    @staticmethod
    def _generate_word_level_vtt(output_dir, whisperx_output):
        """Generate word-level VTT subtitle file for word highlighting."""
        try:
            word_vtt_path = output_dir / 'word_level_subtitles.vtt'
            WordLevelVTTGenerator.generate(whisperx_output, word_vtt_path)
            return word_vtt_path
        except Exception as e:
            logger.error(f"Error generating word-level VTT: {str(e)}")
            return None

    @staticmethod
    def _generate_srt(output_dir, whisperx_output):
        """Generate SRT subtitle file."""
        try:
            srt_path = output_dir / 'subtitles.srt'
            SRTGenerator.generate(whisperx_output, srt_path)
            return srt_path
        except Exception as e:
            logger.error(f"Error generating SRT: {str(e)}")
            return None

    @staticmethod
    def _generate_txt(output_dir, whisperx_output):
        """Generate TXT transcript file."""
        try:
            txt_path = output_dir / 'transcript.txt'
            TXTGenerator.generate(whisperx_output, txt_path)
            return txt_path
        except Exception as e:
            logger.error(f"Error generating TXT: {str(e)}")
            return None
