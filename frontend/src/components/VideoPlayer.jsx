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

  useEffect(() => {
    // Initialize Video.js player with proper DOM checking
    const initializePlayer = () => {
      if (!videoRef.current || playerRef.current) {
        return;
      }

      const videoElement = videoRef.current;

      // Ensure the element is in the DOM
      if (!videoElement.isConnected) {
        console.warn('Video element not yet connected to DOM, retrying...');
        setTimeout(initializePlayer, 100);
        return;
      }

      const playerOptions = {
        controls: true,
        responsive: true,
        fluid: true,
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
        preload: 'metadata',
        errorDisplay: true,
        plugins: {
          // Add any Video.js plugins here
        },
      };

      try {
        // Add a timeout to prevent infinite loading
        const loadingTimeout = setTimeout(() => {
          console.warn('Player loading timeout reached - forcing player to show');
          setIsLoading(false);
        }, 30000); // 30 second timeout for large video files

        playerRef.current = videojs(videoElement, playerOptions, () => {
          console.log('Video.js player ready');
          setIsLoading(false);
          clearTimeout(loadingTimeout);
          if (onReady) {
            onReady(playerRef.current);
          }
        });

        // Clear timeout when player is ready
        playerRef.current.ready(() => {
          clearTimeout(loadingTimeout);
        });

        // Set up error handling
        playerRef.current.on('error', (error) => {
          console.error('Video.js player error:', error);
          console.error('Player error details:', playerRef.current.error());
          const errorDetails = playerRef.current.error();
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
          clearTimeout(loadingTimeout);
        });

        // Set up time update handler
        if (onTimeUpdate) {
          playerRef.current.on('timeupdate', onTimeUpdate);
        }

        // Add debug event listeners
        playerRef.current.on('loadstart', () => {
          console.log('Video.js: loadstart event');
        });

        playerRef.current.on('loadedmetadata', () => {
          console.log('Video.js: loadedmetadata event');
        });

        playerRef.current.on('canplay', () => {
          console.log('Video.js: canplay event');
          setIsLoading(false);
          clearTimeout(loadingTimeout);
        });

        playerRef.current.on('canplaythrough', () => {
          console.log('Video.js: canplaythrough event');
        });

        // Set up the media source
        setupMediaSource();

        // Set up subtitles if available
        if (transcription && transcription.has_vtt) {
          setupSubtitles();
        } else if (subtitles && subtitles.length > 0) {
          setupInlineSubtitles();
        }
      } catch (error) {
        console.error('Error initializing Video.js player:', error);
        setPlayerError(`Player initialization error: ${error.message}`);
        setIsLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(initializePlayer, 50);

    return () => {
      clearTimeout(timeoutId);
      // Cleanup
      if (playerRef.current && !playerRef.current.isDisposed()) {
        try {
          playerRef.current.dispose();
        } catch (error) {
          console.warn('Error disposing player:', error);
        }
        playerRef.current = null;
      }
    };
  }, [src, subtitles, mediaFile, transcription]);

  const setupMediaSource = () => {
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
    // Add safety check for mediaFile
    if (!mediaFile) {
      return (
        <div className="bg-gray-900 rounded-lg overflow-hidden p-8 text-center">
          <div className="text-white">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">Loading media file...</p>
          </div>
        </div>
      );
    }

    if (mediaFile.file_type === 'audio') {
      // For audio files, show a static image or visualization
      return (
        <div className="video-player-container bg-gray-900 flex items-center justify-center relative min-h-[400px]">
          <div className="text-center text-white z-10">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-xl font-medium">{mediaFile.filename_original}</h3>
            <p className="text-gray-300 mt-2">Audio File</p>
          </div>
          <video
            ref={videoRef}
            className="video-js vjs-default-skin absolute inset-0 w-full h-full opacity-0"
            controls
            preload="auto"
            data-setup="{}"
          >
            <p className="vjs-no-js">
              To view this audio, please enable JavaScript, and consider upgrading to a web browser that
              <a href="https://videojs.com/html5-video-support/" target="_blank" rel="noopener noreferrer">
                supports HTML5 audio
              </a>
            </p>
          </video>
        </div>
      );
    }

    // For video files, show normal video player
    return (
      <div className="video-player-container min-h-[400px]">
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

  // Show error state
  if (playerError) {
    return (
      <div className="bg-gray-900 rounded-lg overflow-hidden p-8 text-center">
        <div className="text-red-400 mb-4">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-medium text-white mb-2">Media Loading Error</h3>
          <p className="text-gray-300 text-sm">{playerError}</p>
        </div>
        <div className="text-gray-400 text-sm">
          <p>Please check:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Backend server is running</li>
            <li>Media file exists and is accessible</li>
            <li>File format is supported</li>
          </ul>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-lg overflow-hidden p-8 text-center">
        <div className="text-white">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading media player...</p>
          <button
            onClick={() => {
              console.log('Force showing player');
              setIsLoading(false);
              // Try to setup media source after a short delay
              setTimeout(() => {
                if (playerRef.current && mediaFile) {
                  console.log('Manually triggering media source setup');
                  setupMediaSource();
                  if (transcription && transcription.has_vtt) {
                    setupSubtitles();
                  }
                }
              }, 500);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            Force Show Player
          </button>
        </div>
      </div>
    );
  }

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
      {/* Debug subtitle controls */}
      {!isLoading && !playerError && (
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
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            Reload Subtitles
          </button>
          <span className="ml-4 text-gray-300">
            VTT Available: {transcription?.has_vtt ? 'Yes' : 'No'}
          </span>
        </div>
      )}
    </div>
  );
};
