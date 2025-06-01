from datetime import timedelta


class VTTGenerator:
    """Generator for WebVTT subtitle files with segment-level timing."""

    @staticmethod
    def generate(whisperx_output, output_path):
        """
        Generate VTT file from WhisperX output using segment-level timing.
        This creates proper subtitles that work well with video players.
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("WEBVTT\n\n")

            if not isinstance(whisperx_output, dict) or 'segments' not in whisperx_output:
                return

            segments = whisperx_output['segments']
            cue_id = 1

            for segment in segments:
                # Use segment-level timing for proper subtitle display
                if 'start' in segment and 'end' in segment and 'text' in segment:
                    start_time = VTTGenerator._format_timestamp(segment['start'])
                    end_time = VTTGenerator._format_timestamp(segment['end'])
                    text = segment['text'].strip()

                    if text:
                        # Add speaker label if available
                        speaker_label = ""
                        if 'speaker' in segment:
                            speaker_label = f"<v {segment['speaker']}>"

                        f.write(f"{cue_id}\n")
                        f.write(f"{start_time} --> {end_time}\n")
                        f.write(f"{speaker_label}{text}\n\n")
                        cue_id += 1
    
    @staticmethod
    def _format_timestamp(seconds):
        """Format timestamp for VTT format (HH:MM:SS.mmm)."""
        td = timedelta(seconds=seconds)
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        secs = total_seconds % 60
        milliseconds = int((seconds - total_seconds) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"


class WordLevelVTTGenerator:
    """Generator for WebVTT subtitle files with word-level timing for advanced ESL features."""

    @staticmethod
    def generate(whisperx_output, output_path):
        """
        Generate VTT file from WhisperX output with word-level timing.
        This is used for advanced ESL features like word-by-word highlighting.
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("WEBVTT\n\n")

            if not isinstance(whisperx_output, dict) or 'segments' not in whisperx_output:
                return

            segments = whisperx_output['segments']
            cue_id = 1

            for segment in segments:
                if 'words' in segment and segment['words']:
                    # Generate word-level cues for precise highlighting
                    for word_data in segment['words']:
                        if 'start' in word_data and 'end' in word_data and 'word' in word_data:
                            start_time = WordLevelVTTGenerator._format_timestamp(word_data['start'])
                            end_time = WordLevelVTTGenerator._format_timestamp(word_data['end'])
                            word_text = word_data['word'].strip()

                            if word_text:
                                # Add speaker label if available
                                speaker_label = ""
                                if 'speaker' in segment:
                                    speaker_label = f"<v {segment['speaker']}>"

                                f.write(f"{cue_id}\n")
                                f.write(f"{start_time} --> {end_time}\n")
                                f.write(f"{speaker_label}<c.word-highlight>{word_text}</c>\n\n")
                                cue_id += 1
                else:
                    # Fallback: segment-level cues
                    if 'start' in segment and 'end' in segment and 'text' in segment:
                        start_time = WordLevelVTTGenerator._format_timestamp(segment['start'])
                        end_time = WordLevelVTTGenerator._format_timestamp(segment['end'])
                        text = segment['text'].strip()

                        if text:
                            speaker_label = ""
                            if 'speaker' in segment:
                                speaker_label = f"<v {segment['speaker']}>"

                            f.write(f"{cue_id}\n")
                            f.write(f"{start_time} --> {end_time}\n")
                            f.write(f"{speaker_label}{text}\n\n")
                            cue_id += 1

    @staticmethod
    def _format_timestamp(seconds):
        """Format timestamp for VTT format (HH:MM:SS.mmm)."""
        td = timedelta(seconds=seconds)
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        secs = total_seconds % 60
        milliseconds = int((seconds - total_seconds) * 1000)

        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"


class SRTGenerator:
    """Generator for SubRip (SRT) subtitle files."""
    
    @staticmethod
    def generate(whisperx_output, output_path):
        """
        Generate SRT file from WhisperX output.
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            if not isinstance(whisperx_output, dict) or 'segments' not in whisperx_output:
                return
            
            segments = whisperx_output['segments']
            subtitle_id = 1
            
            for segment in segments:
                if 'start' in segment and 'end' in segment and 'text' in segment:
                    start_time = SRTGenerator._format_timestamp(segment['start'])
                    end_time = SRTGenerator._format_timestamp(segment['end'])
                    text = segment['text'].strip()
                    
                    if text:
                        # Add speaker label if available
                        if 'speaker' in segment:
                            text = f"[{segment['speaker']}] {text}"
                        
                        f.write(f"{subtitle_id}\n")
                        f.write(f"{start_time} --> {end_time}\n")
                        f.write(f"{text}\n\n")
                        subtitle_id += 1
    
    @staticmethod
    def _format_timestamp(seconds):
        """Format timestamp for SRT format (HH:MM:SS,mmm)."""
        td = timedelta(seconds=seconds)
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        secs = total_seconds % 60
        milliseconds = int((seconds - total_seconds) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


class TXTGenerator:
    """Generator for plain text transcript files."""
    
    @staticmethod
    def generate(whisperx_output, output_path):
        """
        Generate TXT file from WhisperX output.
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            if not isinstance(whisperx_output, dict) or 'segments' not in whisperx_output:
                return
            
            segments = whisperx_output['segments']
            
            f.write("TRANSCRIPT\n")
            f.write("=" * 50 + "\n\n")
            
            current_speaker = None
            
            for segment in segments:
                if 'text' in segment:
                    text = segment['text'].strip()
                    
                    if text:
                        # Handle speaker changes
                        speaker = segment.get('speaker', 'Unknown')
                        if speaker != current_speaker:
                            if current_speaker is not None:
                                f.write("\n")
                            f.write(f"{speaker}:\n")
                            current_speaker = speaker
                        
                        # Add timestamp if available
                        if 'start' in segment:
                            timestamp = TXTGenerator._format_timestamp(segment['start'])
                            f.write(f"[{timestamp}] ")
                        
                        f.write(f"{text}\n")
            
            # Add metadata section
            f.write("\n" + "=" * 50 + "\n")
            f.write("METADATA\n")
            f.write("=" * 50 + "\n")
            
            # Count segments and words
            segment_count = len(segments)
            word_count = 0
            speakers = set()
            
            for segment in segments:
                if 'words' in segment:
                    word_count += len(segment['words'])
                else:
                    # Fallback: estimate from text
                    word_count += len(segment.get('text', '').split())
                
                if 'speaker' in segment:
                    speakers.add(segment['speaker'])
            
            f.write(f"Segments: {segment_count}\n")
            f.write(f"Words: {word_count}\n")
            f.write(f"Speakers: {len(speakers) if speakers else 1}\n")
            
            if speakers:
                f.write(f"Speaker list: {', '.join(sorted(speakers))}\n")
    
    @staticmethod
    def _format_timestamp(seconds):
        """Format timestamp for TXT format (HH:MM:SS)."""
        td = timedelta(seconds=seconds)
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        secs = total_seconds % 60
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
