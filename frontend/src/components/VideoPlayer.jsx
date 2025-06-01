import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { mediaAPI, transcriptionAPI } from '../services/api';

export const VideoPlayer = ({
  src,
  subtitles = [],
  onReady,
  onTimeUpdate,
  className = '',
  mediaFile = null,
  transcription = null
}) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [playerError, setPlayerError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Separate effect to initialize Video.js when video element becomes available
  useEffect(() => {
    console.log('VideoPlayer useEffect running, checking video element...');
    console.log('videoRef.current:', videoRef.current);
    console.log('playerRef.current:', playerRef.current);

    const initializePlayer = () => {
      console.log('initializePlayer called, checking conditions:', {
        hasVideoRef: !!videoRef.current,
        hasPlayerRef: !!playerRef.current,
        videoElement: videoRef.current
      });

      if (!videoRef.current || playerRef.current) {
        return false; // Return false to indicate initialization didn't happen
      }

      console.log('Initializing Video.js player...', {
        videoElement: videoRef.current,
        isConnected: videoRef.current.isConnected
      });

      try {
        const player = videojs(videoRef.current, {
          controls: true,
          responsive: true,
          fluid: true,
          playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
          preload: 'metadata',
          errorDisplay: true,
        }, () => {
          console.log('Video.js player ready callback fired');
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

        console.log('Video.js player created:', player);
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

        // Add debug event listeners
        player.on('loadstart', () => {
          console.log('Video.js: loadstart event');
        });

        player.on('loadedmetadata', () => {
          console.log('Video.js: loadedmetadata event');
        });

        player.on('canplay', () => {
          console.log('Video.js: canplay event');
          setIsLoading(false);
        });

        player.on('canplaythrough', () => {
          console.log('Video.js: canplaythrough event');
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
      console.log('Video.js initialization successful immediately');
      return; // Success, no need for retries
    }

    // If immediate initialization failed, try with delays
    let attempts = 0;
    const maxAttempts = 10;
    let retryTimeoutId;

    const retryInitialization = () => {
      // Check if player was already initialized (maybe by another effect run)
      if (playerRef.current) {
        console.log('Video.js player already exists, stopping retry attempts');
        return;
      }

      attempts++;
      console.log(`Video.js initialization attempt ${attempts}/${maxAttempts}`);

      if (initializePlayer()) {
        console.log('Video.js initialization successful on attempt', attempts);
        return; // Success
      }

      if (attempts < maxAttempts) {
        retryTimeoutId = setTimeout(retryInitialization, 200 * attempts); // Increasing delay
      } else {
        console.warn('Video.js initialization failed after', maxAttempts, 'attempts');
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
  }, []); // Empty dependency array - only run once on mount

  const setupMediaSource = () => {
    console.log('setupMediaSource called with:', {
      hasPlayer: !!playerRef.current,
      hasMediaFile: !!mediaFile,
      mediaFile: mediaFile ? {
        id: mediaFile.id,
        filename: mediaFile.filename_original,
        mime_type: mediaFile.mime_type,
        file_type: mediaFile.file_type
      } : null
    });

    if (!playerRef.current) {
      console.warn('Player not ready for media source setup');
      return;
    }

    if (!mediaFile) {
      console.warn('No media file provided for source setup');
      return;
    }

    try {
      // Use src prop if provided, otherwise fall back to mediaFile
      const mediaUrl = src || mediaAPI.getMediaFileUrl(mediaFile.id);
      if (!mediaUrl) {
        console.warn('No media source available', { src, mediaFile });
        setPlayerError('No media source URL available');
        return;
      }

      console.log('Setting up media source:', {
        mediaUrl,
        mediaFile: {
          id: mediaFile.id,
          mime_type: mediaFile.mime_type,
          file_type: mediaFile.file_type,
          filename: mediaFile.filename_original
        },
        src
      });

      const sourceOptions = {
        src: mediaUrl,
        type: mediaFile.mime_type || 'video/mp4', // Default to mp4 if no mime type
      };

      console.log('Video.js source options:', sourceOptions);

      // Set the media source immediately
      playerRef.current.src(sourceOptions);

      // Test if the URL is accessible (non-blocking) using range request
      fetch(mediaUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-1023' // Request first 1KB to test accessibility
        }
      })
        .then(response => {
          console.log('Media URL accessibility test:', {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
          });
          if (!response.ok && response.status !== 206) {
            console.warn(`Media file accessibility warning: ${response.status}`);
            // Don't set error here, let Video.js handle it
          } else {
            console.log('Media file is accessible');
          }
        })
        .catch(error => {
          console.warn('Media URL accessibility test failed:', error);
          // Don't set error here, let Video.js handle it
        });

      // Clear any previous errors when starting to load new media
      setPlayerError(null);

    } catch (error) {
      console.error('Error setting up media source:', error);
      setPlayerError(`Failed to load media: ${error.message}`);
    }
  };

  const setupSubtitles = () => {
    if (!playerRef.current || !transcription || !transcription.has_vtt) {
      console.warn('Cannot setup subtitles:', {
        hasPlayer: !!playerRef.current,
        hasTranscription: !!transcription,
        hasVtt: transcription?.has_vtt
      });
      return;
    }

    const vttUrl = transcriptionAPI.getSubtitleFileUrl(mediaFile.id, 'vtt');
    console.log('Setting up subtitles:', { vttUrl, mediaFile: mediaFile.id });

    // Remove existing text tracks
    const existingTracks = playerRef.current.textTracks();
    console.log(`Removing ${existingTracks.length} existing text tracks`);
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

    console.log('Adding text track:', trackOptions);
    playerRef.current.addRemoteTextTrack(trackOptions, false);

    // Enable subtitles by default with multiple attempts
    const enableSubtitles = () => {
      const textTracks = playerRef.current.textTracks();
      console.log(`Found ${textTracks.length} text tracks`);

      if (textTracks.length > 0) {
        textTracks[0].mode = 'showing';
        console.log('Subtitles enabled, mode:', textTracks[0].mode);

        // Also try to enable via Video.js API
        if (playerRef.current.textTrackSettings) {
          playerRef.current.textTrackSettings.setValues({
            'color': '#FFFFFF',
            'fontFamily': 'Arial',
            'fontSize': '1.2em'
          });
        }
      } else {
        console.warn('No text tracks found for subtitle enabling');
      }
    };

    // Try multiple times with different delays
    setTimeout(enableSubtitles, 100);
    setTimeout(enableSubtitles, 500);
    setTimeout(enableSubtitles, 1000);
  };

  const setupInlineSubtitles = () => {
    if (!playerRef.current || !subtitles || subtitles.length === 0) return;

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
      <div className="video-player-container min-h-[400px] relative">
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
          controls
          preload="auto"
          data-setup="{}"
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



  const toggleSubtitles = () => {
    if (!playerRef.current) return;

    const textTracks = playerRef.current.textTracks();
    console.log('Toggling subtitles, tracks:', textTracks.length);

    if (textTracks.length > 0) {
      const currentMode = textTracks[0].mode;
      const newMode = currentMode === 'showing' ? 'hidden' : 'showing';
      textTracks[0].mode = newMode;
      console.log(`Subtitle mode changed from ${currentMode} to ${newMode}`);
    } else {
      console.log('No text tracks available for toggling');
      // Try to setup subtitles if they're not loaded
      if (transcription && transcription.has_vtt) {
        setupSubtitles();
      }
    }
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
            <button
              onClick={() => {
                console.log('Force showing player');
                setIsLoading(false);
              }}
              className="ml-4 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
            >
              Force Show
            </button>
          </div>
        </div>
      )}

      {/* Debug controls - always show */}
      <div className="p-4 bg-gray-800 text-white text-sm">
          <button
            onClick={toggleSubtitles}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs mr-2"
          >
            Toggle Subtitles
          </button>
          <button
            onClick={() => {
              if (transcription && transcription.has_vtt) {
                console.log('Manually triggering subtitle setup');
                setupSubtitles();
              }
            }}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs mr-2"
          >
            Reload Subtitles
          </button>
          <button
            onClick={() => {
              console.log('Manually triggering media source setup');
              setupMediaSource();
            }}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs mr-2"
          >
            Reload Media
          </button>
          <button
            onClick={() => {
              const mediaUrl = src || mediaAPI.getMediaFileUrl(mediaFile.id);
              console.log('Testing HTML5 video with URL:', mediaUrl);

              // Create a simple HTML5 video element for testing
              const testVideo = document.createElement('video');
              testVideo.src = mediaUrl;
              testVideo.controls = true;
              testVideo.style.width = '100%';
              testVideo.style.maxWidth = '400px';
              testVideo.style.border = '2px solid red';

              // Add it to the page temporarily
              const container = document.createElement('div');
              container.style.position = 'fixed';
              container.style.top = '10px';
              container.style.right = '10px';
              container.style.zIndex = '9999';
              container.style.background = 'white';
              container.style.padding = '10px';
              container.appendChild(testVideo);

              const closeBtn = document.createElement('button');
              closeBtn.textContent = 'Close Test';
              closeBtn.onclick = () => document.body.removeChild(container);
              closeBtn.style.display = 'block';
              closeBtn.style.marginTop = '5px';
              container.appendChild(closeBtn);

              document.body.appendChild(container);
            }}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs mr-2"
          >
            Test HTML5 Video
          </button>
          <button
            onClick={() => {
              console.log('Manually triggering Video.js initialization');
              console.log('Current state:', {
                hasVideoRef: !!videoRef.current,
                hasPlayerRef: !!playerRef.current,
                videoElement: videoRef.current
              });

              // Force re-initialization
              if (playerRef.current && !playerRef.current.isDisposed()) {
                console.log('Disposing existing player');
                playerRef.current.dispose();
                playerRef.current = null;
              }

              // Try to initialize again
              setTimeout(() => {
                if (videoRef.current && !playerRef.current) {
                  console.log('Attempting manual Video.js initialization');
                  try {
                    const player = videojs(videoRef.current, {
                      controls: true,
                      responsive: true,
                      fluid: true,
                    }, () => {
                      console.log('Manual Video.js player ready!');
                      setIsLoading(false);
                      setupMediaSource();
                    });
                    playerRef.current = player;
                  } catch (error) {
                    console.error('Manual initialization failed:', error);
                  }
                }
              }, 100);
            }}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs mr-2"
          >
            Init Video.js
          </button>
          <span className="ml-4 text-gray-300">
            VTT Available: {transcription?.has_vtt ? 'Yes' : 'No'}
          </span>
        </div>
    </div>
  );
};
