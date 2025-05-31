# RepeatAfter.Me - ESL Video Learning Platform

A web application that allows users to upload audio/video files, automatically transcribe them using WhisperX, and provides ESL-focused playback features including "listen-and-repeat" and "shadowing" with word-level highlighting.

## Features

### Core Functionality
- **File Upload**: Support for large audio (.mp3) and video (.mp4, .mkv) files up to 1GB
- **Chunked Upload**: Reliable upload of large files with progress tracking
- **Audio Extraction**: Automatic audio extraction from video files using FFmpeg
- **WhisperX Transcription**: High-quality transcription with word-level timestamps via Replicate API
- **Multiple Subtitle Formats**: Generate VTT, SRT, and TXT files

### ESL Learning Features
- **Listen-and-Repeat Mode**: Automatic pause after each subtitle segment
- **Shadowing Practice**: Adjustable playback speed and audio muting
- **Word-Level Highlighting**: Real-time highlighting of spoken words
- **Interactive Transcript**: Click segments to jump to specific parts
- **Multiple Languages**: Support for English, Spanish, French, German, and Japanese

### User Interface
- **Responsive Design**: Desktop-first design with Tailwind CSS
- **Video Player**: Video.js integration with custom ESL controls
- **Dashboard**: File management with status tracking
- **Real-time Updates**: Live status updates during processing

## Technology Stack

### Backend
- **Framework**: Django 5.2 with Django REST Framework
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: Token-based authentication
- **File Processing**: FFmpeg for audio extraction
- **Transcription**: Replicate API with WhisperX model
- **Storage**: Local storage (development) / Cloud storage (production)

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS
- **Video Player**: Video.js
- **HTTP Client**: Axios
- **Notifications**: React Toastify

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- FFmpeg installed and accessible in PATH
- Replicate API account and token
- HuggingFace account and token (for speaker diarization)

### Backend Setup

1. **Clone the repository and navigate to the project directory**
   ```bash
   cd whisperx_app_3
   ```

2. **Install Python dependencies**
   ```bash
   pip install django djangorestframework django-cors-headers python-decouple replicate
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   REPLICATE_API_TOKEN=your-replicate-api-token
   HUGGINGFACE_ACCESS_TOKEN=your-huggingface-token
   FFMPEG_BINARY=ffmpeg
   ```

4. **Run database migrations**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create superuser (optional)**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start the Django development server**
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Django Admin: http://localhost:8000/admin

## Usage

### Getting Started

1. **Register an Account**
   - Visit http://localhost:3000
   - Click "Sign Up" and create an account
   - Or use the login page if you already have an account

2. **Upload a Media File**
   - Click "Upload New File" from the dashboard
   - Select an audio (.mp3) or video (.mp4, .mkv) file
   - Choose the transcription language
   - Click "Upload and Transcribe"

3. **Monitor Processing**
   - Files go through several stages: Upload → Audio Processing → Transcription
   - Progress is shown in real-time on the dashboard
   - Processing time depends on file length and complexity

4. **Use ESL Features**
   - Once processing is complete, click "Play" to open the player
   - Enable "Listen-and-Repeat" mode for automatic pausing
   - Adjust playback speed for better comprehension
   - Mute original audio for shadowing practice
   - Click transcript segments to jump to specific parts

### File Processing Pipeline

1. **Upload**: Files are uploaded in chunks for reliability
2. **Assembly**: Chunks are reassembled into the original file
3. **Audio Extraction**: For video files, audio is extracted using FFmpeg
4. **Format Conversion**: Audio is converted to 16kHz mono WAV format
5. **Transcription**: WhisperX processes the audio via Replicate API
6. **Subtitle Generation**: VTT, SRT, and TXT files are created
7. **Completion**: File is ready for ESL learning features

## API Endpoints

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout
- `GET /api/auth/profile/` - Get user profile
- `PUT /api/auth/profile/` - Update user profile

### Media Files
- `GET /api/media/` - List user's media files
- `POST /api/media/` - Create media file entry
- `GET /api/media/{id}/` - Get specific media file
- `DELETE /api/media/{id}/` - Delete media file
- `POST /api/media/upload/chunk/` - Upload file chunk
- `GET /api/media/{id}/serve/` - Serve media file
- `GET /api/media/{id}/audio/` - Serve audio file

### Transcriptions
- `GET /api/transcriptions/{id}/` - Get transcription details
- `GET /api/transcriptions/{id}/status/` - Get transcription status
- `GET /api/transcriptions/{id}/download/{format}/` - Download subtitle file
- `GET /api/transcriptions/{id}/serve/{format}/` - Serve subtitle file

## Configuration

### Environment Variables

#### Backend (.env)
```
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
REPLICATE_API_TOKEN=your-replicate-token
HUGGINGFACE_ACCESS_TOKEN=your-huggingface-token
FFMPEG_BINARY=ffmpeg
```

#### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8000/api
```

### FFmpeg Configuration
The application uses FFmpeg with these settings for optimal WhisperX compatibility:
- Codec: pcm_s16le (16-bit PCM)
- Sample Rate: 16000 Hz
- Channels: 1 (Mono)

### Replicate API Configuration
WhisperX model parameters:
- Model: `victor-upmeet/whisperx`
- Language: User-selectable
- Align Output: True (for word-level timestamps)
- Diarization: True (for speaker identification)
- Temperature: 0.0 (for consistent results)

## Development

### Project Structure
```
whisperx_app_3/
├── manage.py
├── repeatafterme_backend/     # Django project settings
├── accounts/                  # User authentication app
├── media_files/              # File upload and management app
├── transcriptions/           # Transcription processing app
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── contexts/        # React contexts
│   │   ├── services/        # API services
│   │   └── utils/           # Utility functions
│   └── public/
├── media/                    # Uploaded files storage
├── logs/                     # Application logs
└── temp_uploads/            # Temporary chunk storage
```

### Adding New Features

1. **Backend**: Create new Django apps or extend existing ones
2. **Frontend**: Add new components in the appropriate directories
3. **API**: Follow RESTful conventions and update serializers
4. **Database**: Create migrations for model changes

## Troubleshooting

### Common Issues

1. **FFmpeg not found**
   - Ensure FFmpeg is installed and in your system PATH
   - On Windows: Download from https://ffmpeg.org/download.html
   - On macOS: `brew install ffmpeg`
   - On Linux: `sudo apt-get install ffmpeg`

2. **Large file upload fails**
   - Check Django settings for file upload limits
   - Ensure sufficient disk space
   - Verify network stability for chunked uploads

3. **Transcription fails**
   - Verify Replicate API token is valid
   - Check audio file size (max ~200MB for Replicate)
   - Ensure audio quality is sufficient

4. **CORS errors**
   - Verify CORS settings in Django settings
   - Check frontend API base URL configuration

## License

This project is created for educational and development purposes.

## Support

For issues and questions, please check the troubleshooting section or create an issue in the project repository.
