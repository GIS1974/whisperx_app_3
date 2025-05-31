# Hugging Face Token Fix

## Issue Fixed
The transcription service was failing with the error:
```
ReplicateError Details:
title: Input validation failed
status: 422
detail: - input.huggingface_access_token: Invalid type. Expected: string, given: null
```

## Root Cause
The code was passing `huggingface_access_token: null` to the Replicate API when no valid Hugging Face token was configured. The Replicate API expects either a valid string token or the parameter to be omitted entirely.

## Solution Applied
Modified `transcriptions/services.py` to conditionally include the `huggingface_access_token` parameter only when a valid token is available:

**Before (problematic code):**
```python
input={
    "audio_file": audio_file,
    "language": media_file.language_transcription,
    "align_output": True,
    "diarization": has_hf_token,
    "temperature": 0.0,
    "huggingface_access_token": settings.HUGGINGFACE_ACCESS_TOKEN if has_hf_token else None,
}
```

**After (fixed code):**
```python
# Build input parameters
input_params = {
    "audio_file": audio_file,
    "language": media_file.language_transcription,
    "align_output": True,
    "diarization": has_hf_token,
    "temperature": 0.0,
}

# Only include huggingface_access_token if we have a valid one
if has_hf_token:
    input_params["huggingface_access_token"] = settings.HUGGINGFACE_ACCESS_TOKEN

prediction = client.predictions.create(
    version="victor-upmeet/whisperx-a40-large:1395a1d7aa48a01094887250475f384d4bae08fd0616f9c405bb81d4174597ea",
    input=input_params
)
```

## Current Behavior

### Without Valid Hugging Face Token (Current State)
- ✅ Transcription works perfectly
- ✅ Word-level timestamps included
- ✅ High-quality audio processing
- ✅ No API errors
- ❌ No speaker identification (diarization disabled)

### With Valid Hugging Face Token (When Configured)
- ✅ All of the above PLUS
- ✅ Speaker identification (Speaker 1, Speaker 2, etc.)
- ✅ Better transcript organization for multi-speaker content

## How to Configure Hugging Face Token (Optional)

If you want speaker identification (diarization), follow these steps:

1. **Get a Hugging Face Token:**
   - Go to https://huggingface.co/settings/tokens
   - Create a new token with "Read" permissions
   - Copy the token (starts with `hf_`)

2. **Update your .env file:**
   ```
   HUGGINGFACE_ACCESS_TOKEN=hf_your_actual_token_here
   ```

3. **Restart the Django server:**
   ```bash
   python manage.py runserver
   ```

## Testing the Fix

Run the test script to verify the fix:
```bash
python test_hf_token_fix.py
```

This will show whether the token is being handled correctly and confirm that the API call parameters are properly constructed.

## Files Modified
- `transcriptions/services.py` - Fixed the API parameter construction logic

## Files Added
- `test_hf_token_fix.py` - Test script to verify the fix
- `HUGGINGFACE_TOKEN_FIX.md` - This documentation file
