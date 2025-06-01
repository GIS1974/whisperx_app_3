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
        playerRef.current = videojs(videoElement, playerOptions, () => {
          console.log('Video.js player ready');
          setIsLoading(false);
          if (onReady) {
            onReady(playerRef.current);
          }
        });

        // Set up error handling
        playerRef.current.on('error', (error) => {
          console.error('Video.js player error:', error);
          console.error('Player error details:', playerRef.current.error());
          setPlayerError('Failed to load video: ' + (playerRef.current.error()?.message || 'Unknown error'));
          setIsLoading(false);
        });

        // Set up time update handler
        if (onTimeUpdate) {
          playerRef.current.on('timeupdate', onTimeUpdate);
        }



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
    if (!playerRef.current) return;

    try {
      // Use src prop if provided, otherwise fall back to mediaFile
      const mediaUrl = src || (mediaFile ? mediaAPI.getMediaFileUrl(mediaFile.id) : null);
      if (!mediaUrl) {
        console.warn('No media source available', { src, mediaFile });
        return;
      }

      console.log('Setting up media source:', {
        mediaUrl,
        mediaFile: mediaFile ? { id: mediaFile.id, mime_type: mediaFile.mime_type } : null,
        src
      });

      const sourceOptions = {
        src: mediaUrl,
        type: mediaFile?.mime_type || 'video/mp4', // Default to mp4 if no mime type
      };

      console.log('Video.js source options:', sourceOptions);
      playerRef.current.src(sourceOptions);

      // Clear any previous errors when starting to load new media
      setPlayerError(null);

    } catch (error) {
      console.error('Error setting up media source:', error);
      setPlayerError(`Failed to load media: ${error.message}`);
    }
  };

  const setupSubtitles = () => {
    if (!playerRef.current || !transcription || !transcription.has_vtt) return;

    const vttUrl = transcriptionAPI.getSubtitleFileUrl(mediaFile.id, 'vtt');

    // Remove existing text tracks
    const existingTracks = playerRef.current.textTracks();
    for (let i = existingTracks.length - 1; i >= 0; i--) {
      playerRef.current.removeRemoteTextTrack(existingTracks[i]);
    }

    // Add VTT subtitle track
    playerRef.current.addRemoteTextTrack({
      kind: 'subtitles',
      src: vttUrl,
      srclang: mediaFile.language_transcription,
      label: `${mediaFile.language_transcription.toUpperCase()} Subtitles`,
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
    if (mediaFile.file_type === 'audio') {
      // For audio files, show a static image or visualization
      return (
        <div className="video-player-container bg-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
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
      <div className="video-player-container">
        <video
          ref={videoRef}
          className="video-js vjs-default-skin"
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
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black rounded-lg overflow-hidden shadow-lg ${className}`}>
      {getPlayerContent()}
    </div>
  );
};
