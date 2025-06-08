import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { mediaAPI, transcriptionAPI } from '../services/api';

export const VideoPlayer = ({
  src,
  subtitles = [],
  onReady,
  onTimeUpdate,
  onVideoClick,
  className = '',
  mediaFile = null,
  transcription = null
}) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [playerError, setPlayerError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Video.js when video element becomes available
  useEffect(() => {
    const initializePlayer = () => {
      if (!videoRef.current || playerRef.current) {
        return false; // Return false to indicate initialization didn't happen
      }

      try {
        const player = videojs(videoRef.current, {
          controls: false, // Disable native controls to use custom ESL controls
          responsive: true,
          fluid: true,
          playbackRates: [], // Remove built-in speed controls to avoid duplication
          preload: 'metadata',
          errorDisplay: false, // Disable error display overlay
          bigPlayButton: false, // Disable big play button
          loadingSpinner: false, // Disable loading spinner
          textTrackDisplay: false, // Disable text track display
          posterImage: false, // Disable poster image
          userActions: {
            hotkeys: false, // Disable keyboard shortcuts
            click: false, // Disable click to play/pause
            doubleClick: false // Disable double-click for fullscreen
          },
          // Additional options to completely disable controls
          html5: {
            vhs: {
              overrideNative: true
            }
          },
          techOrder: ['html5'],
          sources: []
        }, () => {
          setIsLoading(false);
          if (onReady) {
            onReady(player);
          }

          // Set up the media source now that player is ready
          setTimeout(() => {
            setupMediaSource();

            // Set up subtitles if available
            if (transcription && transcription.has_vtt) {
              setTimeout(() => setupSubtitles(), 500);
            } else if (subtitles && subtitles.length > 0) {
              setTimeout(() => setupInlineSubtitles(), 500);
            }
          }, 100);
        });

        playerRef.current = player;

        // Set up error handling
        player.on('error', (error) => {
          console.error('Video.js player error:', error);
          const errorDetails = player.error();
          let errorMessage = 'Failed to load video';

          if (errorDetails) {
            switch (errorDetails.code) {
              case 1:
                errorMessage = 'Video loading was aborted';
                break;
              case 2:
                errorMessage = 'Network error occurred while loading video';
                break;
              case 3:
                errorMessage = 'Video format not supported or corrupted';
                break;
              case 4:
                errorMessage = 'Video source not found or not accessible';
                break;
              default:
                errorMessage = errorDetails.message || 'Unknown video error';
            }
          }

          setPlayerError(errorMessage);
          setIsLoading(false);
        });

        // Set up time update handler
        if (onTimeUpdate) {
          player.on('timeupdate', onTimeUpdate);
        }

        // Set up essential event listeners
        player.on('canplay', () => {
          setIsLoading(false);
        });

        return true; // Return true to indicate successful initialization

      } catch (error) {
        console.error('Error initializing Video.js player:', error);
        setPlayerError(`Player initialization error: ${error.message}`);
        setIsLoading(false);
        return false;
      }
    };

    // Try to initialize immediately
    if (initializePlayer()) {
      return; // Success, no need for retries
    }

    // If immediate initialization failed, try with delays
    let attempts = 0;
    const maxAttempts = 5;
    let retryTimeoutId;

    const retryInitialization = () => {
      // Check if player was already initialized
      if (playerRef.current) {
        return;
      }

      attempts++;

      if (initializePlayer()) {
        return; // Success
      }

      if (attempts < maxAttempts) {
        retryTimeoutId = setTimeout(retryInitialization, 200 * attempts);
      } else {
        setPlayerError('Failed to initialize video player');
        setIsLoading(false);
      }
    };

    // Start retry process
    retryTimeoutId = setTimeout(retryInitialization, 100);

    // Cleanup function to clear retry timeout
    return () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      // Cleanup player
      if (playerRef.current && !playerRef.current.isDisposed()) {
        try {
          playerRef.current.dispose();
        } catch (error) {
          console.warn('Error disposing player:', error);
        }
        playerRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const setupMediaSource = () => {
    if (!playerRef.current || !mediaFile) {
      return;
    }

    try {
      // Use src prop if provided, otherwise fall back to mediaFile
      const mediaUrl = src || mediaAPI.getMediaFileUrl(mediaFile.id);
      if (!mediaUrl) {
        setPlayerError('No media source URL available');
        return;
      }

      const sourceOptions = {
        src: mediaUrl,
        type: mediaFile.mime_type || 'video/mp4',
      };

      // Set the media source
      playerRef.current.src(sourceOptions);

      // Clear any previous errors
      setPlayerError(null);

    } catch (error) {
      console.error('Error setting up media source:', error);
      setPlayerError(`Failed to load media: ${error.message}`);
    }
  };

  const setupSubtitles = () => {
    if (!playerRef.current || !transcription || !transcription.has_vtt) {
      return;
    }

    // Don't show native subtitles if we have word-level highlighting enabled
    // The WordHighlighter component will handle subtitle display
    if (transcription.has_word_level_vtt) {
      console.log('Skipping native subtitles - using WordHighlighter overlay instead');
      return;
    }

    const vttUrl = transcriptionAPI.getSubtitleFileUrl(mediaFile.id, 'vtt');

    // Remove existing text tracks
    const existingTracks = playerRef.current.textTracks();
    for (let i = existingTracks.length - 1; i >= 0; i--) {
      playerRef.current.removeRemoteTextTrack(existingTracks[i]);
    }

    // Add VTT subtitle track
    const trackOptions = {
      kind: 'subtitles',
      src: vttUrl,
      srclang: mediaFile.language_transcription || 'en',
      label: `${(mediaFile.language_transcription || 'en').toUpperCase()} Subtitles`,
      default: true,
    };

    playerRef.current.addRemoteTextTrack(trackOptions, false);

    // Enable subtitles by default
    const enableSubtitles = () => {
      const textTracks = playerRef.current.textTracks();
      if (textTracks.length > 0) {
        textTracks[0].mode = 'showing';
      }
    };

    // Try multiple times to ensure subtitles are enabled
    setTimeout(enableSubtitles, 100);
    setTimeout(enableSubtitles, 500);
    setTimeout(enableSubtitles, 1000);
  };

  const setupInlineSubtitles = () => {
    if (!playerRef.current || !subtitles || subtitles.length === 0) return;

    // Don't show native subtitles if we have word-level highlighting enabled
    // The WordHighlighter component will handle subtitle display
    if (transcription?.has_word_level_vtt) {
      console.log('Skipping inline subtitles - using WordHighlighter overlay instead');
      return;
    }

    // Convert segments to VTT format and create blob URL
    const vttContent = convertSegmentsToVTT(subtitles);
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const vttUrl = URL.createObjectURL(blob);

    // Remove existing text tracks
    const existingTracks = playerRef.current.textTracks();
    for (let i = existingTracks.length - 1; i >= 0; i--) {
      playerRef.current.removeRemoteTextTrack(existingTracks[i]);
    }

    // Add VTT subtitle track
    playerRef.current.addRemoteTextTrack({
      kind: 'subtitles',
      src: vttUrl,
      srclang: 'en',
      label: 'Transcription',
      default: true,
    }, false);

    // Enable subtitles by default
    setTimeout(() => {
      const textTracks = playerRef.current.textTracks();
      if (textTracks.length > 0) {
        textTracks[0].mode = 'showing';
      }
    }, 100);
  };

  const convertSegmentsToVTT = (segments) => {
    let vtt = 'WEBVTT\n\n';

    segments.forEach((segment, index) => {
      const startTime = formatTime(segment.start);
      const endTime = formatTime(segment.end);
      vtt += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n\n`;
    });

    return vtt;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Update subtitles when transcription becomes available
  useEffect(() => {
    if (playerRef.current && transcription && transcription.has_vtt) {
      setupSubtitles();
    }
  }, [transcription]);

  const getPlayerContent = () => {
    // Always render the video element to avoid Video.js initialization issues
    return (
      <div className="video-player-container h-full relative">
        {/* Show loading overlay for media file */}
        {!mediaFile && (
          <div className="absolute inset-0 bg-gray-900 rounded-lg overflow-hidden p-8 text-center flex items-center justify-center z-10">
            <div className="text-white">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-300">Loading media file...</p>
            </div>
          </div>
        )}

        {/* Show audio file overlay */}
        {mediaFile && mediaFile.file_type === 'audio' && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">🎵</div>
              <h3 className="text-xl font-medium">{mediaFile.filename_original}</h3>
              <p className="text-gray-300 mt-2">Audio File</p>
            </div>
          </div>
        )}

        {/* Always render video element for Video.js */}
        <video
          ref={videoRef}
          className="video-js vjs-default-skin w-full h-full"
          preload="auto"
          data-setup="{}"
          onClick={onVideoClick}
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture={true}
          playsInline={true}
        >
          <p className="vjs-no-js">
            To view this video, please enable JavaScript, and consider upgrading to a web browser that
            <a href="https://videojs.com/html5-video-support/" target="_blank" rel="noopener noreferrer">
              supports HTML5 video
            </a>
          </p>
        </video>
      </div>
    );
  };

  return (
    <div className={`bg-black rounded-lg overflow-hidden shadow-lg ${className}`}>
      {getPlayerContent()}

      {/* Show error overlay */}
      {playerError && (
        <div className="p-4 bg-red-900 text-white text-sm">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Error: {playerError}</span>
          </div>
        </div>
      )}

      {/* Show loading overlay */}
      {isLoading && (
        <div className="p-4 bg-blue-900 text-white text-sm">
          <div className="flex items-center">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full mr-2"></div>
            <span>Loading media player...</span>
          </div>
        </div>
      )}
    </div>
  );
};
