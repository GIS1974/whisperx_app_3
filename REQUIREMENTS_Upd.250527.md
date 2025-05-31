### ### Project Title: RepeatAfter.Me (ESL Video Learning Platform)

### ### Core Goal
To create a web application that allows users to upload large audio (.mp3) or video (.mp4, .mkv) files (up to 1GB), automatically transcribe them using the Replicate API for the `victor-upmeet/whisperx` model, and provide ESL-focused playback features, including "listen-and-repeat" and "shadowing," with word-level highlighting. The application will feature a dedicated layout for video playback and interactive subtitles.

### ### Key Technologies
*   **Frontend:** React (using Vite for project setup)
*   **Backend:** Python (using the Django framework)
*   **Video Playback:** Video.js library
*   **Styling:** Tailwind CSS
*   **Transcription Service:** Replicate API (for WhisperX model)
*   **Audio Processing:** FFmpeg

### ### External Configuration References
*   Detailed FFmpeg settings and rationale: `FFmpeg_settings.md`
*   Detailed Replicate API parameters for WhisperX: `Replicate_API_parameters.md`
    *(Key actionable parameters from these files are also summarized within the relevant sections below for direct use by the coding agent.)*

### ### General Principles for LLM Agent
*   Prioritize functionality as described for the Minimum Viable Product (MVP).
*   Generate well-commented, modular, and maintainable code.
*   Adhere to security best practices (e.g., input validation, secure API key handling).
*   Implement features for the MVP first; "Future Enhancements" can be logged for future iterations.

### ### Refined Requirements

#### #### 1. User Accounts and Authentication (Backend - Django)
    
*   **Functionality:**
    *   Users must be able to register for a new account using an email address and password.
    *   Users must be able to log in with their registered email and password.
    *   Users must be able to log out.
    *   Implement basic password validation (e.g., minimum length).
    *   Password reset functionality ("Forgot Password") is a desirable enhancement for a future iteration, not strictly required for MVP.
*   **Implementation:**
    *   Utilize Django's built-in authentication system (`django.contrib.auth`).
    *   Ensure secure password hashing (Django handles this by default).
    *   Protect authenticated routes/endpoints.

#### #### 2. File Upload and Storage (Backend - Django; Frontend - React)
    
*   **Supported File Types (Client-side and Server-side validation):**
    *   Audio: `.mp3`
    *   Video: `.mp4`, `.mkv`
*   **File Size Limit:**
    *   The application must support file uploads up to **1GB (1000 MB)**.
    *   The frontend should perform an initial check for file size before initiating the upload.
*   **Upload Mechanism (User to Backend Server):**
    *   **Frontend (React):**
        *   Implement **chunked file uploads** to reliably handle large files.
        *   The selected file should be split into smaller, manageable chunks (e.g., 5MB to 10MB per chunk).
        *   Each chunk should be sent as a separate HTTP request to the backend.
        *   Implement logic to manage the sequence of chunks and handle retries for failed chunk uploads (if feasible for MVP, otherwise fail the entire upload on chunk error).
        *   Provide robust progress indication to the user for the overall upload process (percentage based on chunks uploaded).
        *   Allow users to cancel an ongoing upload.
    *   **Backend (Django):**
        *   API endpoints to receive individual file chunks.
        *   Logic to securely reassemble the chunks in the correct order on the server into the complete original file. Chunks should be temporarily stored and then deleted after successful reassembly or if the upload is abandoned/fails.
        *   Associate chunks with a unique upload ID and the user.
        *   Validate each chunk (e.g., size, expected sequence).
*   **Server Configuration (Backend):**
    *   Web server (e.g., Nginx in front of Gunicorn) and Django settings must be configured to handle:
        *   The expected number of concurrent chunk uploads.
        *   The size of individual chunks.
        *   Timeouts appropriate for large file assembly.
*   **Storage Strategy (Post-Reassembly on Backend):**
    *   **Local Storage (Initial Development):**
        *   Reassembled original files: Store in a designated local server directory (e.g., `media/uploads/originals/<user_id>/<media_file_uuid>/<original_filename>`).
        *   Extracted audio files: Store in a designated local server directory (e.g., `media/uploads/audio/<user_id>/<media_file_uuid>/<audio_filename.wav>`).
        *   Generated subtitle files (VTT, SRT, TXT): Store in a designated local server directory (e.g., `media/transcriptions/<user_id>/<media_file_uuid>/`).
        *   Use UUIDs or a similar mechanism in storage paths to ensure uniqueness and avoid conflicts.
    *   **Cloud Storage (Future):** The application architecture should allow for future migration to cloud storage (AWS S3, Google Cloud Storage, Azure Blob Storage). Cloud services' multipart upload capabilities align well with this chunked approach.
*   **Association:** Uploaded files and their derivatives must be associated with the uploading user's account in the database.

#### #### 3. Audio Extraction (Backend - Django with FFmpeg)
*   **Trigger:** Occurs after a video file (.mp4, .mkv) is successfully uploaded and reassembled on the backend.
*   **Tool:** Use FFmpeg (ensure it's installed and accessible by the Django application environment).
*   **Input:** Path to the reassembled original video file.
*   **Output:** A `.wav` audio file.
*   **FFmpeg Command (Key Settings):**
    *   Codec: `pcm_s16le`
    *   Sample Rate: `16000` Hz
    *   Channels: `1` (Mono)
    *   Primary command for MVP: `ffmpeg -i <input_video_path> -vn -acodec pcm_s16le -ar 16000 -ac 1 <output_audio_path.wav>`
    *   (Refer to `FFmpeg_settings.md` for detailed rationale and alternative commands like with `loudnorm`).
*   **Error Handling:** Capture FFmpeg process errors. If extraction fails, update `MediaFile` status and log.

#### #### 4. WhisperX Transcription (Backend - Django with Replicate API)
*   **Trigger:**
    *   For video files: After successful audio extraction.
    *   For audio files (.mp3): After successful upload, reassembly, and conversion to `.wav` (16kHz, mono, pcm_s16le using FFmpeg).
*   **Service:** Interact with the Replicate API for the `victor-upmeet/whisperx` model.
*   **API Key Management:** Securely manage `REPLICATE_API_TOKEN` and `HUGGINGFACE_ACCESS_TOKEN` via environment variables.
*   **Input to Replicate API (Backend to Replicate):**
    *   Processed `.wav` audio file (16kHz, mono).
    *   **File Provision:** Via a publicly accessible URL (see "Key Questions" below).
    *   **Replicate File Size Limit Handling:** If extracted WAV exceeds Replicate's limits (e.g., >100-200MB), set `MediaFile.status` to `failed_audio_too_large` and notify user.
*   **Replicate API Parameters (Key Settings):**
    *   `audio`: Public URL to the `.wav` file.
    *   `language`: User-selectable (e.g., from `["en", "es", "fr", "de", "ja"]`), default "en".
    *   `align_output`: `true`.
    *   `diarization`: `true`.
    *   `huggingface_access_token`: From environment variable.
    *   `temperature`: `0.0`.
    *   (Refer to `Replicate_API_parameters.md` for all default parameters).
*   **Asynchronous Handling:** Initiate job, store Replicate job ID, poll for status (MVP).
*   **Output from Replicate:** JSON object with transcription, word-level timestamps, speaker diarization.
*   **Error Handling:** Handle Replicate API errors, update `MediaFile` status, log.

#### #### 5. Subtitle Generation (Backend - Django)
    
*   **Trigger:** Occurs when the WhisperX transcription job completes successfully and the JSON output is retrieved.
*   **Input:** The JSON output from WhisperX.
*   **Processing:**
    *   Parse the JSON to extract segments, words, start/end timestamps, and speaker labels.
    *   **VTT Generation (`.vtt`):**
        *   Create WebVTT cues. For word-level highlighting, each word (or small groups of words if more practical for performance) should be represented with precise timing.
        *   Include speaker labels in cues if diarization is enabled (e.g., `SPEAKER 1: Hello world`).
        *   Structure VTT to be easily parsable by the frontend for highlighting (e.g., wrap words in identifiable tags or use VTT's native cue text styling capabilities if sufficient).
    *   **SRT Generation (`.srt`):** Generate standard SubRip format, typically with sentence or phrase-level segments.
    *   **TXT Generation (`.txt`):** Generate a plain text transcript, including speaker labels and timestamps if helpful.
*   **Storage:** Save generated VTT, SRT, and TXT files to their designated storage paths. Update `Transcription` database records with these paths.

#### #### 6. Video Playback with Subtitles (Frontend - React with Video.js)
    
*   **Player:** Initialize and configure Video.js.
*   **Source:**
    *   Video files: Load the original uploaded video from a backend endpoint that serves the file.
    *   Audio-only files: Display a suitable audio player interface (Video.js can handle audio-only) with a static visual or album art placeholder.
*   **Subtitles:**
    *   Fetch and load the generated VTT file associated with the media.
    *   Display subtitles synchronized with the video/audio.
*   **Word-Level Highlighting:**
    *   As media plays, the currently spoken word(s) in the VTT subtitles must be visually highlighted (e.g., different background color or text color).
    *   Utilize Video.js `timeupdate` events and `textTracks` API to identify active cues and words within those cues.
    *   This may require parsing VTT cue content on the client-side to identify individual word timings if not already structured as individual word cues.
*   **Customizable Subtitle Appearance (Desirable Enhancement - Post MVP):**
    *   Simple controls for font size.

#### #### 7. ESL-Specific Features (Frontend - React with Video.js)
    
*   **"Listen-and-Repeat" Feature:**
    *   **Segmentation:** Playback pauses after each VTT cue (subtitle segment/sentence).
    *   **Controls:**
        *   Toggle button: "Enable/Disable Listen-and-Repeat Mode".
        *   When enabled: Automatic pause after current VTT cue finishes.
        *   Button: "Replay Current Segment" (replays the last played VTT cue).
        *   Button: "Play Next Segment" (plays the next VTT cue and then pauses).
*   **"Shadowing" Feature:**
    *   **Playback Speed Control:** Utilize Video.js built-in speed controls (e.g., 0.5x, 0.75x, 1.0x, 1.25x, 1.5x).
    *   **Mute Original Audio:** Provide a toggle button to mute/unmute the original audio track of the media.

#### #### 8. User Interface (UI) - Frontend: React with Tailwind CSS
*   **General Principles:** Clean, intuitive, responsive (desktop-first for MVP).
*   **Key Pages/Views & Components:**
    *   **Authentication Pages (e.g., `/login`, `/register`):** Standard forms.
    *   **Dashboard/File List Page (e.g., `/dashboard`):**
        *   Displays a list/grid of the user's `MediaFile` entries.
        *   Information per file: Filename, upload date, duration, transcription status (e.g., "Uploading", "Processing Audio", "Transcribing [Job ID]", "Completed", "Failed: [Reason]"), "Play" button (links to Player Page).
        *   Button: "Upload New File" (links to Upload Page).
    *   **Upload Page (e.g., `/upload`):**
        *   File input component (HTML5 default, drag-and-drop is a desirable enhancement).
        *   Language selector dropdown (for transcription language).
        *   "Upload and Transcribe" button.
        *   Detailed progress bar for chunked upload (overall percentage, current chunk number/total chunks).
        *   Cancel upload button.
    *   **Video Player Page (e.g., `/player/<media_file_uuid>`):**
        *   **Layout:** The page will be divided vertically.
            *   **Left Section (approx. 70% width):** Contains the Video.js player instance and all playback/ESL controls.
            *   **Right Section (approx. 30% width):** Contains a scrollable, interactive transcript display area. Each subtitle line/segment from the VTT file should be displayed here. The currently active subtitle segment (being spoken or highlighted in the player) should also be highlighted or brought into view in this transcript section.
        *   ESL feature controls clearly visible and accessible within the left section or alongside the player.
        *   Links/buttons to download generated SRT and TXT files.
*   **Progress Indication & Feedback:**
    *   Visual feedback for all asynchronous operations: file upload (chunk progress), file reassembly, audio extraction, transcription polling/status.
    *   Use toasts (e.g., using a library like `react-toastify`) or inline messages for success/error notifications.
*   **Styling:** Use Tailwind CSS for all styling.

#### #### 9. Database (Backend - Django ORM)
    
*   **Engine (Initial Development):** SQLite.
*   **Engine (Production):** Design for easy migration to PostgreSQL (use Django's ORM features that are database-agnostic where possible).
*   **Models & Schemas:**
    *   **`User` (from `django.contrib.auth.models`):** Standard.
    *   **`MediaFile`:**
        *   `id`: UUIDField (Primary Key, default=uuid.uuid4).
        *   `user`: ForeignKey to `User` (on_delete=models.CASCADE).
        *   `filename_original`: CharField (max_length=255).
        *   `filesize_bytes`: BigIntegerField (size of the original uploaded file).
        *   `file_type`: CharField (choices: 'video', 'audio', max_length=10).
        *   `mime_type`: CharField (max_length=100).
        *   `upload_date`: DateTimeField (auto_now_add=True).
        *   `duration_seconds`: IntegerField (null=True, blank=True).
        *   `language_transcription`: CharField (max_length=10, e.g., "en").
        *   `status`: CharField (max_length=30, choices: 'pending_upload', 'uploading', 'uploaded_processing_assembly', 'processing_audio', 'pending_transcription', 'transcribing', 'completed', 'failed_upload', 'failed_assembly', 'failed_extraction', 'failed_transcription', 'failed_audio_too_large').
        *   `replicate_job_id`: CharField (max_length=100, null=True, blank=True).
        *   `storage_path_original`: CharField (max_length=512, null=True, blank=True).
        *   `storage_path_audio`: CharField (max_length=512, null=True, blank=True).
        *   `error_message`: TextField (null=True, blank=True).
    *   **`Transcription`:**
        *   `id`: UUIDField (Primary Key, default=uuid.uuid4).
        *   `media_file`: OneToOneField to `MediaFile` (on_delete=models.CASCADE).
        *   `completed_date`: DateTimeField (auto_now_add=True).
        *   `vtt_file_path`: CharField (max_length=512, null=True, blank=True).
        *   `srt_file_path`: CharField (max_length=512, null=True, blank=True).
        *   `txt_file_path`: CharField (max_length=512, null=True, blank=True).
        *   `raw_whisperx_output_path`: CharField (max_length=512, null=True, blank=True, path to stored JSON response if too large for DB field).
        *   Alternatively, `raw_whisperx_output`: JSONField (if database supports it and responses are not excessively large).

#### #### 10. Deployment
    
*   **Frontend (React with Vite):** Vercel.
*   **Backend (Python with Django):** To be determined (e.g., Heroku, AWS Elastic Beanstalk, Google Cloud Run).
*   **CORS:** Backend API endpoints must be correctly CORS configured to allow requests from the Vercel frontend domain.
*   **Environment Variables:** All sensitive keys (Replicate, Hugging Face, Django `SECRET_KEY`, database credentials for production) and configurations (file size limits, Replicate model version) must be managed via environment variables.

#### #### 11. Error Handling & User Feedback (General)
    
*   **Backend (Django):**
    *   Implement comprehensive logging for errors and key events.
    *   Use Django's exception handling; return appropriate HTTP status codes (4xx for client errors, 5xx for server errors) and structured JSON error responses.
*   **Frontend (React):**
    *   Gracefully handle API errors from the backend.
    *   Display clear, user-friendly error messages for all failure scenarios (login, registration, file upload stages, transcription process, playback issues).
    *   Provide specific feedback for validation errors (e.g., "File type not supported," "File exceeds 1GB limit").

#### #### 12. No Transcription Editing (Initial MVP)
*   The initial version will not allow users to edit the generated subtitles. (See Section 14 for future enhancement).

#### #### 13. Non-Functional Requirements (MVP Focus)
    
*   **Usability:** The application should be intuitive and easy to use for the target ESL learners.
*   **Responsiveness:** The UI should be functional and presentable on common desktop browser sizes. Full mobile optimization is a future enhancement.
*   **Performance:**
    *   Page loads should be reasonably fast.
    *   File upload progress should be responsive.
    *   Video playback should start promptly once data is available.
    *   Transcription time is dependent on the external Replicate service and file duration. The UI should manage user expectations for this.
*   **Security:** Basic security measures (HTTPS, secure credential handling, input validation) must be in place.

#### #### 14. Future Enhancements / Post-MVP Features
*   **Subtitle Editing Functionality:**
    *   Users should be able to toggle an "Edit Mode" for subtitles on the Video Player Page.
    *   In Edit Mode, users can:
        *   Select an individual subtitle line/segment (e.g., by clicking on it in the right-hand transcript panel or directly on the video overlay if feasible).
        *   Edit the text content of the selected subtitle segment.
        *   Adjust the start and end times of the selected subtitle segment (e.g., via input fields or a visual timeline editor if more advanced).
    *   Changes should be savable to the backend, potentially creating a new version of the VTT file or storing edits in a separate table.
*   **Password Reset Functionality.**
*   **Advanced Drag-and-Drop File Upload Component.**
*   **Full Mobile UI Optimization.**
*   **More Granular Subtitle Appearance Customization.**
*   **User Profile Management Page.**

### ### Key Questions/Clarifications (To be resolved during development or by the agent making sensible assumptions for MVP):
    
1.  **Audio File Provision to Replicate API (Requirement #4):** For local development, the agent should assume a mechanism like `ngrok` can be used to expose the locally served audio file, or if a Replicate client library allows direct file upload for the specified model, that should be preferred. For production, this will involve uploading to cloud storage first.
2.  **VTT Structure for Word Highlighting (Requirement #5 & #6):** The agent should aim for the most granular VTT structure possible from WhisperX word timings to support highlighting. If this proves overly complex for initial Video.js integration, a slightly less granular approach (e.g., highlighting short phrases within a cue) might be an acceptable fallback for MVP, but word-level is the target.
3.  **"Listen-and-Repeat" Segmentation (Requirement #7):** Segments are defined by the VTT cues. The granularity of these cues will depend on the VTT generation logic in step 5.
4.  **Replicate Audio File Size Limit Handling (Requirement #4):** If the extracted WAV file is too large for Replicate, the `MediaFile.status` should be set to `failed_audio_too_large`, and the user should be notified. The exact size limit from Replicate needs to be confirmed if possible, otherwise, assume a reasonable limit like 100-200MB for the audio file itself.
