# Testing the Transcription Functionality

## Current Status
✅ **Authentication bypassed** - All API endpoints now work without authentication for testing
✅ **Frontend updated** - Navigation works without login
✅ **Backend ready** - All transcription endpoints are accessible

## How to Test the Core Transcription Features

### 1. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://127.0.0.1:8000/api
- **Django Admin**: http://127.0.0.1:8000/admin (if needed)

### 2. Test File Upload
1. Go to http://localhost:5173/upload
2. Select a small audio (.mp3) or video (.mp4) file
3. Choose transcription language (English recommended for testing)
4. Click "Upload and Transcribe"
5. Monitor the upload progress

### 3. Monitor Processing
1. After upload completes, go to http://localhost:5173/dashboard
2. You should see your file with status "Processing Audio" or "Pending Transcription"
3. The status will update automatically as processing progresses

### 4. Test Transcription (Requires API Keys)
**Note**: For full transcription testing, you need:
- **Replicate API Token**: Sign up at https://replicate.com
- **HuggingFace Token**: Sign up at https://huggingface.co

Add these to your `.env` file:
```
REPLICATE_API_TOKEN=your-replicate-token-here
HUGGINGFACE_ACCESS_TOKEN=your-huggingface-token-here
```

### 5. Test ESL Player Features
1. Once transcription is complete, click "Play" on your file
2. Test the ESL features:
   - **Listen-and-Repeat Mode**: Toggle on/off
   - **Speed Control**: Try different playback speeds
   - **Audio Muting**: Test shadowing practice
   - **Interactive Transcript**: Click segments to jump to specific parts

## API Testing with curl

### List Media Files
```bash
curl -X GET http://127.0.0.1:8000/api/media/
```

### Create Media File Entry
```bash
curl -X POST http://127.0.0.1:8000/api/media/ \
  -H "Content-Type: application/json" \
  -d '{
    "filename_original": "test.mp3",
    "filesize_bytes": 1024000,
    "file_type": "audio",
    "mime_type": "audio/mpeg",
    "language_transcription": "en"
  }'
```

### Check Transcription Status
```bash
curl -X GET http://127.0.0.1:8000/api/transcriptions/{file_id}/status/
```

## Testing Without External APIs

If you don't have API keys, you can still test:

### 1. File Upload System
- Test chunked upload functionality
- Verify file validation
- Check progress tracking

### 2. Audio Processing
- Upload video files to test audio extraction
- Verify FFmpeg integration (requires FFmpeg installed)

### 3. Frontend Features
- Test all UI components
- Verify responsive design
- Check error handling

### 4. Mock Transcription Data
You can manually create transcription data in the Django admin to test the player:

1. Go to http://127.0.0.1:8000/admin
2. Create a superuser: `python manage.py createsuperuser`
3. Add mock transcription data to test the player features

## Expected File Processing Flow

1. **Upload** → File chunks uploaded and assembled
2. **Audio Processing** → Audio extracted/converted (requires FFmpeg)
3. **Transcription** → WhisperX processing (requires API keys)
4. **Completion** → Subtitle files generated, ready for ESL features

## Troubleshooting

### Common Issues

1. **FFmpeg not found**
   - Install FFmpeg and ensure it's in your PATH
   - Windows: Download from https://ffmpeg.org/download.html

2. **CORS errors**
   - Already configured for localhost:5173
   - Check browser console for specific errors

3. **File upload fails**
   - Check file size (max 1GB)
   - Verify supported formats (MP3, MP4, MKV)

4. **Transcription fails**
   - Verify API tokens are correct
   - Check file size limits for Replicate API
   - Monitor Django logs for errors

### Debug Information

Check Django server logs for detailed error messages:
- File processing errors
- API call failures
- Database issues

Check browser console for frontend errors:
- Network requests
- JavaScript errors
- API response issues

## Next Steps

Once basic functionality is verified:

1. **Re-enable Authentication**: Remove the temporary bypasses
2. **Add Production Features**: Cloud storage, message queues
3. **Optimize Performance**: Caching, CDN integration
4. **Add Advanced ESL Features**: Pronunciation scoring, vocabulary extraction

## Test Files

For testing, use:
- **Small audio files** (< 10MB) for quick testing
- **Clear speech** for better transcription accuracy
- **English content** for most reliable results
- **Short duration** (< 5 minutes) for faster processing

The application is now ready for core transcription functionality testing!
