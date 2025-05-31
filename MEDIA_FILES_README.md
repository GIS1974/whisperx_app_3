# Media Files Management

## Overview

This WhisperX ESL application processes large media files (videos and audio) that should **NOT** be committed to Git due to GitHub's file size limitations.

## File Size Limits

- **GitHub**: 100MB hard limit per file, 50MB recommended maximum
- **Git**: No hard limit, but large files slow down operations
- **Typical media files**: Often 100MB-1GB+ (too large for Git)

## Current Setup

### Excluded Directories
The following directories are excluded from Git tracking via `.gitignore`:

```
media/                  # All uploaded and processed media files
temp_uploads/          # Temporary upload chunks
media_files/           # Alternative media storage
```

### Excluded File Types
```
*.mp4, *.mkv, *.avi, *.mov, *.flv, *.webm    # Video files
*.wav, *.mp3, *.m4a, *.aac                   # Audio files
*.vtt, *.srt, *.txt                          # Generated subtitle files
*.zip, *.tar.gz, *.rar, *.7z                # Archive files
```

## Directory Structure

```
media/
├── uploads/
│   ├── originals/          # Original uploaded files
│   │   └── {user_id}/
│   │       └── {file_id}/
│   │           └── original_file.mp4
│   └── audio/              # Extracted/converted audio
│       └── {user_id}/
│           └── {file_id}/
│               ├── audio_file.wav
│               └── chunks/
│                   ├── chunk_000.wav
│                   └── chunk_001.wav
├── transcriptions/         # Generated subtitle files
│   └── {user_id}/
│       └── {file_id}/
│           ├── subtitles.vtt
│           ├── subtitles.srt
│           └── transcript.txt
└── temp_chunks/           # Temporary upload chunks
```

## Development Workflow

### For Developers

1. **Clone the repository** - Media files won't be included
2. **Test with small files** - Use short audio/video clips for testing
3. **Use sample files** - Keep test files under 10MB when possible
4. **Local testing** - Upload files locally to test the full pipeline

### Sample Test Files

For testing, use small media files:
- **Audio**: 1-5 minute clips, < 10MB
- **Video**: Short clips, < 50MB
- **Formats**: MP3, MP4 (most common)

## Production Deployment

### Cloud Storage (Recommended)

For production, migrate to cloud storage:

1. **AWS S3** / **Google Cloud Storage** / **Azure Blob Storage**
2. **CDN** for fast media delivery
3. **Backup strategy** for uploaded content
4. **Cleanup policies** for old/unused files

### Environment Variables

```bash
# Local Development
MEDIA_ROOT=/path/to/local/media
MEDIA_URL=/media/

# Production
MEDIA_ROOT=https://your-bucket.s3.amazonaws.com/
MEDIA_URL=https://cdn.yourdomain.com/media/
```

## Troubleshooting

### "Large files detected" Error

If you encounter GitHub's large file error:

1. **Run the cleanup script**: `quick_fix_large_files.bat`
2. **Check .gitignore**: Ensure media patterns are included
3. **Verify exclusion**: `git status` should not show media files

### Files Already Committed

If large files were already committed:

1. **Safe approach**: Use `quick_fix_large_files.bat`
2. **Complete cleanup**: Use `cleanup_large_files.bat` (rewrites history)
3. **Force push**: May be required after cleanup

### Git Commands

```bash
# Check what files Git is tracking
git ls-files | grep -E "\.(mp4|wav|mp3)$"

# Remove specific file from tracking
git rm --cached path/to/large/file.mp4

# Remove entire directory from tracking
git rm -r --cached media/

# Check repository size
git count-objects -vH
```

## Best Practices

1. **Never commit large media files** to Git
2. **Use cloud storage** for production
3. **Test with small files** during development
4. **Regular cleanup** of local media files
5. **Backup strategy** for important content
6. **Monitor disk space** on development machines

## File Cleanup

### Local Development

```bash
# Clean up old test files (be careful!)
rm -rf media/uploads/originals/*
rm -rf media/uploads/audio/*
rm -rf media/transcriptions/*

# Keep directory structure
mkdir -p media/uploads/originals
mkdir -p media/uploads/audio
mkdir -p media/transcriptions
```

### Automated Cleanup

Consider implementing:
- **Age-based cleanup** (delete files older than X days)
- **Size-based limits** (delete when total size exceeds limit)
- **User quotas** (limit per-user storage)

## Security Considerations

1. **File type validation** - Only allow safe media formats
2. **Size limits** - Enforce reasonable file size limits
3. **Virus scanning** - Scan uploaded files in production
4. **Access controls** - Ensure users can only access their files
5. **Cleanup policies** - Remove files when users are deleted

---

**Remember**: Media files are for processing only. The valuable output is the transcriptions and subtitles, which are much smaller and can be stored in the database or as small text files.
