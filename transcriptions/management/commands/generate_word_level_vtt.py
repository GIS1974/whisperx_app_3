import os
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from transcriptions.models import Transcription
from transcriptions.subtitle_generators import WordLevelVTTGenerator


class Command(BaseCommand):
    help = 'Generate word-level VTT files for existing transcriptions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--transcription-id',
            type=str,
            help='Generate word-level VTT for a specific transcription ID',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force regeneration even if word-level VTT already exists',
        )

    def handle(self, *args, **options):
        transcription_id = options.get('transcription_id')
        force = options.get('force', False)

        if transcription_id:
            # Process specific transcription
            try:
                transcription = Transcription.objects.get(id=transcription_id)
                self.process_transcription(transcription, force)
            except Transcription.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'Transcription with ID {transcription_id} not found')
                )
                return
        else:
            # Process all transcriptions
            transcriptions = Transcription.objects.all()
            total = transcriptions.count()
            
            self.stdout.write(f'Found {total} transcriptions to process')
            
            for i, transcription in enumerate(transcriptions, 1):
                self.stdout.write(f'Processing {i}/{total}: {transcription.id}')
                self.process_transcription(transcription, force)

        self.stdout.write(
            self.style.SUCCESS('Word-level VTT generation completed')
        )

    def process_transcription(self, transcription, force=False):
        """Process a single transcription to generate word-level VTT."""
        
        # Skip if word-level VTT already exists and not forcing
        if transcription.word_level_vtt_file_path and not force:
            self.stdout.write(f'  Skipping {transcription.id} - word-level VTT already exists')
            return

        # Get WhisperX output
        whisperx_output = None
        
        if transcription.raw_whisperx_output:
            whisperx_output = transcription.raw_whisperx_output
        elif transcription.raw_whisperx_output_path:
            try:
                full_path = os.path.join(settings.MEDIA_ROOT, transcription.raw_whisperx_output_path)
                with open(full_path, 'r', encoding='utf-8') as f:
                    whisperx_output = json.load(f)
            except (IOError, json.JSONDecodeError) as e:
                self.stdout.write(
                    self.style.ERROR(f'  Error loading raw output for {transcription.id}: {e}')
                )
                return

        if not whisperx_output:
            self.stdout.write(
                self.style.WARNING(f'  No raw WhisperX output found for {transcription.id}')
            )
            return

        # Check if the output has word-level data
        if not self.has_word_level_data(whisperx_output):
            self.stdout.write(
                self.style.WARNING(f'  No word-level data found for {transcription.id}')
            )
            return

        try:
            # Create output directory
            transcription_dir = Path(settings.MEDIA_ROOT) / 'transcriptions' / str(transcription.media_file.user.id) / str(transcription.media_file.id)
            transcription_dir.mkdir(parents=True, exist_ok=True)

            # Generate word-level VTT file
            word_vtt_path = transcription_dir / 'word_level_subtitles.vtt'
            WordLevelVTTGenerator.generate(whisperx_output, word_vtt_path)

            # Update transcription record
            relative_path = os.path.relpath(word_vtt_path, settings.MEDIA_ROOT)
            transcription.word_level_vtt_file_path = relative_path
            transcription.save()

            self.stdout.write(
                self.style.SUCCESS(f'  Generated word-level VTT for {transcription.id}')
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'  Error generating word-level VTT for {transcription.id}: {e}')
            )

    def has_word_level_data(self, whisperx_output):
        """Check if WhisperX output contains word-level timing data."""
        if not isinstance(whisperx_output, dict) or 'segments' not in whisperx_output:
            return False

        segments = whisperx_output['segments']
        
        # Check if any segment has word-level data
        for segment in segments:
            if 'words' in segment and segment['words']:
                # Check if words have timing information
                for word in segment['words']:
                    if 'start' in word and 'end' in word and 'word' in word:
                        return True
        
        return False
