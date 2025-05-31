  "audio_file": "path/to/your/preprocessed_audio.wav", // Ensure this is 16kHz mono as per FFmpeg_settings.md
  "language": "en", // Or the specific language code of your audio
  "initial_prompt":  // Optional - leave blank
  "temperature": 0.0,
  "align_output": true, // Essential for word-level timestamps
  "diarization": true, // Multiple speakers are present
  "huggingface_access_token": "YOUR_HF_TOKEN_HERE", // If diarization is true
  "min_speakers": null, // 
  "max_speakers": null, // 
  // Keep other parameters at their defaults unless specific issues arise:
  "language_detection_min_prob": 0,
  "language_detection_max_tries": 5,
  "batch_size": 64,
  "vad_onset": 0.500,
  "vad_offset": 0.363,
  "debug": false