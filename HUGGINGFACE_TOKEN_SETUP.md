# Hugging Face Token Setup for Speaker Diarization

## Current Status

Your system is now configured to work **without** speaker diarization if no valid Hugging Face token is provided. This means:

✅ **Transcription will work** - You'll get accurate text transcripts
❌ **Speaker diarization disabled** - No speaker identification (Speaker 1, Speaker 2, etc.)

## What is Speaker Diarization?

Speaker diarization identifies different speakers in audio and labels them as "Speaker 1", "Speaker 2", etc. This is useful for:
- Multi-person conversations
- Interviews
- Meetings
- Podcasts with multiple hosts

## How to Enable Speaker Diarization (Optional)

If you want speaker identification, you need a free Hugging Face token:

### Step 1: Create Hugging Face Account
1. Go to [https://huggingface.co/join](https://huggingface.co/join)
2. Sign up for a free account

### Step 2: Get Access Token
1. Go to [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Click "New token"
3. Give it a name (e.g., "WhisperX ESL App")
4. Select "Read" permissions
5. Click "Generate a token"
6. Copy the token (starts with `hf_`)

### Step 3: Update Your .env File
1. Open the `.env` file in your project root
2. Replace this line:
   ```
   HUGGINGFACE_ACCESS_TOKEN=your-huggingface-token-here
   ```
   
   With your actual token:
   ```
   HUGGINGFACE_ACCESS_TOKEN=hf_your_actual_token_here
   ```

### Step 4: Restart Django Server
1. Stop the Django server (Ctrl+C)
2. Start it again: `python manage.py runserver`

## Testing

After setting up the token:
- Upload a test file with multiple speakers
- Check the transcription output for speaker labels
- Look for "Speaker 1:", "Speaker 2:", etc. in the transcript

## Troubleshooting

**If you get permission errors:**
- Make sure you accepted the terms for the speaker diarization models
- Visit: [https://huggingface.co/pyannote/speaker-diarization](https://huggingface.co/pyannote/speaker-diarization)
- Click "Agree and access repository"

**If diarization still doesn't work:**
- Check the Django logs for error messages
- Verify your token is correctly set in the `.env` file
- Make sure there are no extra spaces or quotes around the token

## Current System Behavior

**Without Hugging Face Token:**
- ✅ Transcription works perfectly
- ✅ Word-level timestamps included
- ✅ High-quality audio processing
- ❌ No speaker identification

**With Valid Hugging Face Token:**
- ✅ All of the above PLUS
- ✅ Speaker identification (Speaker 1, Speaker 2, etc.)
- ✅ Better transcript organization for multi-speaker content

## Note

The system will automatically detect whether you have a valid token and enable/disable diarization accordingly. You don't need to change any code - just update the `.env` file if you want speaker identification.
