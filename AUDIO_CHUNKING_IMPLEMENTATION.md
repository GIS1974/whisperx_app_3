# Audio Chunking Implementation for Large Files

## Overview

This implementation addresses the 100MB file size limit for the Replicate API while maintaining high audio quality by implementing audio chunking functionality. Large audio files are automatically split into smaller chunks that are processed sequentially and then combined back into a single transcription result.

## Key Changes Made

### 1. High-Quality Audio Processing

**Updated FFmpeg Settings** (media_files/services.py):
- Changed from lossy MP3 (64kbps) to lossless WAV with PCM format
- Audio codec: `pcm_s16le` (16-bit PCM, uncompressed)
- Sample rate: `16000` Hz (optimal for WhisperX)
- Channels: Mono (`-ac 1`)
- Output format: `.wav` files

This follows the recommendations in `FFmpeg_settings.md` for optimal WhisperX transcription quality.

### 2. Audio Chunking Service

**New AudioChunkingService** (media_files/services.py):
- Automatically splits audio files larger than 95MB into chunks
- Uses FFmpeg to create time-based chunks with consistent quality
- Maintains the same audio format (PCM 16kHz mono) for all chunks
- Creates chunks directory structure for organization
- Calculates optimal chunk duration based on file size

### 3. Enhanced Transcription Processing

**Updated TranscriptionService** (transcriptions/services.py):
- Detects when chunking is needed (files > 95MB) - optimized threshold
- Processes chunks sequentially through Replicate API
- Uses larger chunks (~90MB) to reduce processing overhead
- Adjusts timestamps for each chunk to maintain proper timing
- Combines all chunk results into a single transcription
- Handles chunk-specific error handling and logging

**New Helper Methods**:
- `_poll_chunk_completion()`: Polls individual chunk processing
- `_adjust_chunk_timestamps()`: Adjusts timestamps for chunk position
- `_combine_chunk_results()`: Merges all chunk transcriptions

### 4. Status Tracking

**New Status** (media_files/models.py):
- Added `transcribing_chunked` status to track large file processing
- Migration file created for database schema update

**Frontend Updates**:
- Updated MediaFileCard.jsx to display "Transcribing (Large File)" status
- Updated PlayerPage.jsx to handle chunked transcription status
- Consistent status colors and messaging across components

### 5. File Size Limits

**Optimized Limits**:
- Removed conflicting file size checks (was 200MB and 25MB)
- Set optimized 95MB chunking threshold to leverage model capabilities
- Use 90MB chunks when chunking is needed for efficiency
- Proper error handling for oversized files

## Technical Details

### Replicate API Model
- **Model**: `victor-upmeet/whisperx-a40-large:1395a1d7aa48a01094887250475f384d4bae08fd0616f9c405bb81d4174597ea`
- **Optimized**: Specifically designed for large audio files (178.7K successful runs)
- **Hardware**: Runs on Nvidia L40S GPU for better performance and reliability

### Optimized Chunking Algorithm

1. **Size Check**: Files > 95MB are automatically chunked (optimized threshold)
2. **Large Chunks**: When chunking is needed, creates ~90MB chunks (not 10MB)
3. **Duration Calculation**: Estimates audio duration based on file size
4. **Chunk Creation**: Uses FFmpeg to extract time-based segments
5. **Quality Preservation**: Each chunk maintains original audio quality
6. **Reduced API Calls**: Fewer, larger chunks mean faster processing

### Timestamp Alignment

1. **Chunk Timing**: Calculates start time offset for each chunk
2. **Segment Adjustment**: Adjusts all segment timestamps by chunk offset
3. **Word-Level Timing**: Adjusts word-level timestamps if present
4. **Seamless Combination**: Results appear as single continuous transcription

### Error Handling

- Individual chunk failures don't stop entire process
- Detailed logging for debugging chunk processing
- Graceful fallback for timestamp adjustment issues
- Clear error messages for users

## Benefits

1. **No File Size Restrictions**: Can process files of any size
2. **Maintained Audio Quality**: Uses lossless WAV format as recommended
3. **Seamless User Experience**: Chunking is transparent to users
4. **Robust Processing**: Individual chunk failures don't break entire job
5. **Accurate Timestamps**: Proper timing alignment across chunks

## Usage

The chunking functionality is automatic and transparent:

1. User uploads large video/audio file
2. System extracts high-quality WAV audio
3. If file > 95MB, automatically splits into ~90MB chunks
4. Each chunk processed through Replicate API (fewer API calls)
5. Results combined into single transcription
6. User receives complete transcript files (SRT, VTT, TXT)

## File Structure

```
uploads/audio/[user_id]/[media_file_id]/
├── [media_file_id].wav          # Main audio file
└── chunks/                      # Chunk directory (if needed)
    ├── chunk_000.wav
    ├── chunk_001.wav
    └── ...
```

## Status Flow

```
pending_transcription → transcribing_chunked → completed
                     ↘ transcribing → completed
```

## Configuration

- **Chunking Threshold**: 95MB (files larger than this are chunked)
- **Target Chunk Size**: ~90MB (when chunking is needed)
- **Minimum Chunk Duration**: 30 seconds
- **Audio Format**: WAV PCM 16kHz mono
- **Timeout**: 10 minutes per chunk processing

## Optimization Benefits

- **Fewer API Calls**: 90MB chunks instead of 10MB means ~9x fewer requests
- **Faster Processing**: Less overhead from chunk management and timestamp alignment
- **Better Resource Usage**: Takes advantage of victor-upmeet/whisperx-a40-large's large file capabilities
- **Maintained Quality**: Same high-quality audio processing and transcription accuracy
