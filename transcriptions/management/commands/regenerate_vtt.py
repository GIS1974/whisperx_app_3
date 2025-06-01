import os
import json
import logging
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from transcriptions.models import Transcription
from transcriptions.subtitle_generators import VTTGenerator

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Regenerate VTT files for existing transcriptions with segment-level timing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--transcription-id',
            type=str,
            help='Regenerate VTT for a specific transcription ID',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Regenerate VTT files for all transcriptions',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually doing it',
        )

    def handle(self, *args, **options):
        if options['transcription_id']:
            self.regenerate_single(options['transcription_id'], options['dry_run'])
        elif options['all']:
            self.regenerate_all(options['dry_run'])
        else:
            self.stdout.write(
                self.style.ERROR('Please specify either --transcription-id or --all')
            )

    def regenerate_single(self, transcription_id, dry_run=False):
        """Regenerate VTT for a single transcription."""
        try:
            transcription = Transcription.objects.get(id=transcription_id)
            self.regenerate_transcription_vtt(transcription, dry_run)
        except Transcription.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Transcription {transcription_id} not found')
            )

    def regenerate_all(self, dry_run=False):
        """Regenerate VTT files for all transcriptions."""
        transcriptions = Transcription.objects.all()
        total = transcriptions.count()
        
        self.stdout.write(f'Found {total} transcriptions to process')
        
        success_count = 0
        error_count = 0
        
        for i, transcription in enumerate(transcriptions, 1):
            self.stdout.write(f'Processing {i}/{total}: {transcription.id}')
            
            try:
                self.regenerate_transcription_vtt(transcription, dry_run)
                success_count += 1
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error processing {transcription.id}: {str(e)}')
                )
                error_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'Completed: {success_count} success, {error_count} errors')
        )

    def regenerate_transcription_vtt(self, transcription, dry_run=False):
        """Regenerate VTT file for a single transcription."""
        # Get WhisperX output from JSON field or file
        whisperx_output = None

        if transcription.raw_whisperx_output:
            # Use JSON data stored directly in database
            whisperx_output = transcription.raw_whisperx_output
            # Determine VTT file path from existing VTT file or create new one
            if transcription.vtt_file_path:
                vtt_path = Path(settings.MEDIA_ROOT) / transcription.vtt_file_path
            else:
                # Create path based on media file
                media_dir = Path(settings.MEDIA_ROOT) / 'transcriptions' / str(transcription.media_file.id)
                media_dir.mkdir(parents=True, exist_ok=True)
                vtt_path = media_dir / 'subtitles.vtt'
        elif transcription.raw_whisperx_output_path:
            # Load from file
            json_path = Path(settings.MEDIA_ROOT) / transcription.raw_whisperx_output_path
            if not json_path.exists():
                raise Exception(f'JSON file not found: {json_path}')

            with open(json_path, 'r', encoding='utf-8') as f:
                whisperx_output = json.load(f)

            # VTT file should be in same directory as JSON
            vtt_path = json_path.parent / 'subtitles.vtt'
        else:
            raise Exception('No WhisperX output data found')

        if dry_run:
            self.stdout.write(f'  Would regenerate: {vtt_path}')
            return

        # Backup existing VTT file if it exists
        if vtt_path.exists():
            backup_path = vtt_path.with_suffix('.vtt.backup')
            vtt_path.rename(backup_path)
            self.stdout.write(f'  Backed up existing VTT to: {backup_path}')

        # Generate new VTT file
        VTTGenerator.generate(whisperx_output, vtt_path)

        # Update transcription record
        transcription.vtt_file_path = os.path.relpath(vtt_path, settings.MEDIA_ROOT)
        transcription.save()

        self.stdout.write(
            self.style.SUCCESS(f'  Generated new VTT: {vtt_path}')
        )
