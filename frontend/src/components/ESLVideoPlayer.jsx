import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoPlayer } from './VideoPlayer';
import './ESLVideoPlayer.css';

export const ESLVideoPlayer = ({
  mediaFile,
  transcription,
  className = '',
  onProgress,
  onSegmentComplete,
  selectedSegmentIndex = null,
  onSegmentChange,
  onPlayerReady
}) => {
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState('normal'); // 'normal', 'listen', 'repeat'
  const [segments, setSegments] = useState([]);
  const [repeatCount, setRepeatCount] = useState(0);
  const [maxRepeats] = useState(3);
  const [showTranscript, setShowTranscript] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const playerRef = useRef(null);
  const segmentTimeoutRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);
  const progressBarRef = useRef(null);
  const segmentChangeTimeoutRef = useRef(null);

  // Helper function to format time in MM:SS format
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse transcript segments from transcription data
  useEffect(() => {
    if (transcription && transcription.segments) {
      const parsedSegments = transcription.segments.map((segment, index) => ({
        id: index,
        start: segment.start,
        end: segment.end,
        text: segment.text?.trim() || '', // Ensure text is always a string
        duration: segment.end - segment.start,
        words: segment.words || [] // Include word-level timing data if available
      }));
      setSegments(parsedSegments);

      // Debug log to check for text truncation issues
      console.log('ESL Player - Parsed segments:', parsedSegments.length);
      if (parsedSegments.length > 0) {
        console.log('ESL Player - Sample segment:', parsedSegments[0]);
        console.log('ESL Player - Word-level data available:', parsedSegments[0].words?.length > 0);
        console.log('ESL Player - Setting current segment to 0');
        setCurrentSegment(0);
      }
    }
  }, [transcription]);

  // Sync with external segment selection
  useEffect(() => {
    if (selectedSegmentIndex !== null && selectedSegmentIndex !== currentSegment && selectedSegmentIndex >= 0 && selectedSegmentIndex < segments.length) {
      setCurrentSegment(selectedSegmentIndex);
      // Don't auto-play here since it will be triggered by the parent
    }
  }, [selectedSegmentIndex, segments.length]);

  // Calculate precise timing for segment playback using word-level data
  const calculatePreciseTiming = useCallback((segment) => {
    const START_BUFFER = 0.15; // 150ms buffer before first word
    const END_BUFFER = 0.3;    // 300ms buffer after last word (balanced for complete playback)
    const MIN_END_BUFFER = 0.15; // Minimum buffer to ensure natural completion

    // If no word-level data is available, use segment timing with small buffer
    if (!segment.words || segment.words.length === 0) {
      return {
        startTime: Math.max(0, segment.start - START_BUFFER),
        endTime: segment.end + END_BUFFER,
        duration: (segment.end + END_BUFFER) - Math.max(0, segment.start - START_BUFFER)
      };
    }

    // Find first and last words with valid timing
    const wordsWithTiming = segment.words.filter(word =>
      word.start !== undefined && word.end !== undefined &&
      word.start !== null && word.end !== null &&
      typeof word.start === 'number' && typeof word.end === 'number'
    );

    if (wordsWithTiming.length === 0) {
      // Fallback to segment timing if no valid word timing
      return {
        startTime: Math.max(0, segment.start - START_BUFFER),
        endTime: segment.end + END_BUFFER,
        duration: (segment.end + END_BUFFER) - Math.max(0, segment.start - START_BUFFER)
      };
    }

    // Use first word start time and last word end time with buffers
    const firstWordStart = wordsWithTiming[0].start;
    const lastWordEnd = wordsWithTiming[wordsWithTiming.length - 1].end;

    const preciseStartTime = Math.max(0, firstWordStart - START_BUFFER);

    // Calculate end time with intelligent buffering
    let preciseEndTime = lastWordEnd + END_BUFFER;

    // Safety check: ensure we don't end too early compared to segment timing
    // If word end time is significantly before segment end, use segment end with minimum buffer
    const wordToSegmentGap = segment.end - lastWordEnd;
    if (wordToSegmentGap > 0.5) {
      // Large gap suggests word timing might be inaccurate, use segment timing
      preciseEndTime = segment.end + MIN_END_BUFFER;
    } else if (wordToSegmentGap > 0.1) {
      // Moderate gap, use the later of word+buffer or segment+min_buffer
      const wordBasedEnd = lastWordEnd + END_BUFFER;
      const segmentBasedEnd = segment.end + MIN_END_BUFFER;
      preciseEndTime = Math.max(wordBasedEnd, segmentBasedEnd);
    }

    // Final safety check: ensure end time is not before segment end
    preciseEndTime = Math.max(preciseEndTime, segment.end + MIN_END_BUFFER);

    return {
      startTime: preciseStartTime,
      endTime: preciseEndTime,
      duration: preciseEndTime - preciseStartTime
    };
  }, []);

  // Handle time updates to track current segment using enhanced timing boundaries
  const handleTimeUpdate = useCallback(() => {
    if (!playerRef.current || segments.length === 0) return;

    const currentTime = playerRef.current.currentTime();
    console.log('Time update:', currentTime.toFixed(2), 'Current segment:', currentSegment);

    // Find the segment that contains the current time using enhanced timing boundaries
    const activeSegment = segments.findIndex((segment) => {
      const timing = calculatePreciseTiming(segment);
      return currentTime >= timing.startTime && currentTime <= timing.endTime;
    });

    // If no segment contains the current time, find the closest one using enhanced boundaries
    let segmentToShow = activeSegment;
    if (activeSegment === -1) {
      // Find the closest segment based on enhanced timing
      segmentToShow = segments.findIndex((segment, index) => {
        const timing = calculatePreciseTiming(segment);
        const nextSegment = segments[index + 1];

        if (nextSegment) {
          const nextTiming = calculatePreciseTiming(nextSegment);
          return currentTime >= timing.startTime && currentTime < nextTiming.startTime;
        } else {
          // Last segment - check if we're after its enhanced start
          return currentTime >= timing.startTime;
        }
      });

      // If still not found, use the last segment if we're past the end
      if (segmentToShow === -1) {
        const lastSegment = segments[segments.length - 1];
        const lastTiming = calculatePreciseTiming(lastSegment);
        if (currentTime > lastTiming.endTime) {
          segmentToShow = segments.length - 1;
        } else {
          segmentToShow = 0; // Default to first segment
        }
      }
    }

    // Update current segment if it has changed (with debounce to prevent rapid switching)
    if (segmentToShow !== -1 && segmentToShow !== currentSegment) {
      // Clear any pending segment change
      if (segmentChangeTimeoutRef.current) {
        clearTimeout(segmentChangeTimeoutRef.current);
      }

      // Debounce segment changes to prevent rapid switching
      segmentChangeTimeoutRef.current = setTimeout(() => {
        console.log('Changing segment from', currentSegment, 'to', segmentToShow, segments[segmentToShow]?.text);
        setCurrentSegment(segmentToShow);
        if (onProgress) {
          onProgress(segmentToShow, segments[segmentToShow]);
        }
        if (onSegmentChange) {
          onSegmentChange(segmentToShow, segments[segmentToShow]);
        }
      }, 100); // 100ms debounce
    }
  }, [segments, currentSegment, onProgress, onSegmentChange]);

  // Initialize subtitle display based on current video time
  const initializeSubtitleDisplay = useCallback(() => {
    if (!playerRef.current || segments.length === 0) return;

    const currentTime = playerRef.current.currentTime();
    const activeSegment = segments.findIndex(segment =>
      currentTime >= segment.start && currentTime <= segment.end
    );

    // Set the current segment based on video time, or default to first segment
    const segmentToShow = activeSegment !== -1 ? activeSegment : 0;

    if (segmentToShow !== currentSegment) {
      setCurrentSegment(segmentToShow);
      if (onProgress) {
        onProgress(segmentToShow, segments[segmentToShow]);
      }
      if (onSegmentChange) {
        onSegmentChange(segmentToShow, segments[segmentToShow]);
      }
    }

    console.log('Initialized subtitle display:', segmentToShow, segments[segmentToShow]?.text);
  }, [segments, currentSegment, onProgress, onSegmentChange]);

  // Initialize subtitle display when segments are loaded
  useEffect(() => {
    if (segments.length > 0) {
      if (playerRef.current) {
        // Initialize subtitle display after a short delay
        setTimeout(() => {
          initializeSubtitleDisplay();
        }, 200);
      }

      // Start polling for time updates to ensure subtitles update
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }

      timeUpdateIntervalRef.current = setInterval(() => {
        if (playerRef.current && segments.length > 0) {
          handleTimeUpdate();
        }
      }, 500); // Check every 500ms
    }

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [segments, initializeSubtitleDisplay, handleTimeUpdate]);

  // Force subtitle update when current segment changes
  useEffect(() => {
    if (segments.length > 0 && currentSegment >= 0 && currentSegment < segments.length) {
      // Force a re-render of the subtitle display
      const currentSegmentData = segments[currentSegment];
      console.log('Current segment updated:', currentSegment, currentSegmentData?.text);
    }
  }, [currentSegment, segments]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Only handle keys if not typing in an input
      if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          goToPreviousSegment();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNextSegment();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentSegment, segments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
      }
      if (segmentChangeTimeoutRef.current) {
        clearTimeout(segmentChangeTimeoutRef.current);
      }
    };
  }, []);

  // Handle player ready
  const handlePlayerReady = (player) => {
    playerRef.current = player;

    // Set up multiple event listeners for comprehensive time tracking
    player.on('timeupdate', handleTimeUpdate);
    player.on('seeked', handleTimeUpdate); // When user seeks using progress bar
    player.on('seeking', handleTimeUpdate); // While user is seeking
    player.on('loadedmetadata', handleTimeUpdate); // When video metadata loads
    player.on('canplay', handleTimeUpdate); // When video can start playing
    player.on('play', () => {
      setIsPlaying(true);
      handleTimeUpdate(); // Update immediately when play starts
    });
    player.on('pause', () => {
      setIsPlaying(false);
      handleTimeUpdate(); // Update when paused to ensure correct subtitle
    });
    player.on('ended', handleVideoEnd);

    // Track progress for custom progress bar
    player.on('timeupdate', () => {
      setCurrentTime(player.currentTime());
      setDuration(player.duration());

      // Update buffered progress
      const bufferedEnd = player.buffered().length > 0 ? player.buffered().end(0) : 0;
      setBuffered(bufferedEnd);
    });

    // Initialize subtitle display after player is ready
    setTimeout(() => {
      if (segments.length > 0) {
        initializeSubtitleDisplay();
      }
    }, 300);
  };






  // Handle video end
  const handleVideoEnd = () => {
    setIsPlaying(false);
    if (playbackMode === 'repeat' && repeatCount < maxRepeats) {
      setTimeout(() => {
        playCurrentSegment();
        setRepeatCount(prev => prev + 1);
      }, 1000);
    } else if (playbackMode === 'listen' && currentSegment < segments.length - 1) {
      // Auto-advance to next segment in listen mode
      setTimeout(() => {
        goToSegment(currentSegment + 1);
      }, 1500);
    }
  };

  // Play specific segment by index
  const playSegment = (segmentIndex) => {
    if (!playerRef.current || segments.length === 0) return;

    const segment = segments[segmentIndex];
    if (!segment) return;

    // Clear any existing timeout
    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
    }

    // Calculate precise timing for repeat mode, use regular timing for other modes
    const timing = playbackMode === 'repeat'
      ? calculatePreciseTiming(segment)
      : {
          startTime: segment.start,
          endTime: segment.end,
          duration: segment.duration
        };

    console.log(`Playing segment ${segmentIndex} in ${playbackMode} mode:`, timing);

    // Set player to precise start time
    playerRef.current.currentTime(timing.startTime);
    playerRef.current.play();

    // Use a more reliable approach: check current time periodically instead of relying on timeout duration
    const checkEndTime = () => {
      if (!playerRef.current) return;

      const currentTime = playerRef.current.currentTime();

      // Check if we've reached or passed the end time
      if (currentTime >= timing.endTime) {
        playerRef.current.pause();
        if (onSegmentComplete) {
          onSegmentComplete(segmentIndex, segment);
        }
        return;
      }

      // Continue checking every 50ms for precise timing
      segmentTimeoutRef.current = setTimeout(checkEndTime, 50);
    };

    // Start checking after a small delay to ensure playback has started
    segmentTimeoutRef.current = setTimeout(checkEndTime, 100);
  };

  // Play current segment
  const playCurrentSegment = () => {
    playSegment(currentSegment);
  };

  // Normal video playback functions
  const playVideo = () => {
    if (playerRef.current) {
      playerRef.current.play();
    }
  };

  const pauseVideo = () => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
  };

  const togglePlayPause = () => {
    if (!playerRef.current) return;

    if (playbackMode === 'normal') {
      // Normal video playback - toggle play/pause
      if (isPlaying) {
        pauseVideo();
      } else {
        playVideo();
      }
    } else {
      // ESL modes - use segment-based playback
      if (isPlaying) {
        pauseVideo();
      } else {
        playCurrentSegment();
      }
    }
  };

  // Handle video area click for play/pause
  const handleVideoClick = () => {
    togglePlayPause();
  };

  // Progress bar drag functionality
  const handleProgressBarClick = useCallback((e) => {
    if (!playerRef.current || !duration || isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    // Update video time
    playerRef.current.currentTime(newTime);

    // Immediately update React state for instant visual feedback
    setCurrentTime(newTime);
  }, [duration, isDragging]);

  const handleProgressBarMouseMove = useCallback((e) => {
    if (!isDragging || !playerRef.current || !duration || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const currentX = e.clientX;

    // Calculate position directly from current mouse position (more accurate)
    const clickX = currentX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    // Update video time during drag
    playerRef.current.currentTime(newTime);

    // Immediately update React state for instant visual feedback
    setCurrentTime(newTime);
  }, [isDragging, duration]);

  const handleProgressBarMouseDown = useCallback((e) => {
    if (!playerRef.current || !duration) return;

    setIsDragging(true);

    // Prevent text selection during drag
    e.preventDefault();

    // Handle the initial click/drag position immediately
    handleProgressBarMouseMove(e);
  }, [duration, handleProgressBarMouseMove]);

  const handleProgressBarMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse event handlers for drag
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e) => handleProgressBarMouseMove(e);
      const handleGlobalMouseUp = () => handleProgressBarMouseUp();

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, duration]);

  // Navigate to segment start position with enhanced timing (no auto-play)
  const navigateToSegmentStart = (segmentIndex) => {
    if (!playerRef.current || segments.length === 0) return;

    const segment = segments[segmentIndex];
    if (!segment) return;

    // Use enhanced timing for positioning to prevent cut-offs
    const timing = calculatePreciseTiming(segment);

    console.log(`Positioning at segment ${segmentIndex} start:`, {
      originalStart: segment.start,
      enhancedStart: timing.startTime,
      difference: (timing.startTime - segment.start).toFixed(3)
    });

    playerRef.current.currentTime(timing.startTime);
  };

  // Navigate to specific segment
  const goToSegment = (segmentIndex) => {
    if (segmentIndex < 0 || segmentIndex >= segments.length) return;

    setCurrentSegment(segmentIndex);
    setRepeatCount(0);

    // Notify parent component of segment change
    if (onProgress) {
      onProgress(segmentIndex, segments[segmentIndex]);
    }
    if (onSegmentChange) {
      onSegmentChange(segmentIndex, segments[segmentIndex]);
    }

    if (playerRef.current) {
      // Use enhanced timing for navigation to prevent cut-offs
      navigateToSegmentStart(segmentIndex);

      if (playbackMode !== 'normal') {
        playSegment(segmentIndex);
      }
    }

    // Force subtitle update immediately
    console.log('Navigated to segment:', segmentIndex, segments[segmentIndex]?.text);
  };

  // Toggle playback modes
  const setMode = (mode) => {
    setPlaybackMode(mode);
    setRepeatCount(0);
    
    if (mode === 'listen' || mode === 'repeat') {
      playCurrentSegment();
    }
  };

  // Navigation controls
  const goToPreviousSegment = (e) => {
    e?.preventDefault?.();
    goToSegment(currentSegment - 1);
  };

  const goToNextSegment = (e) => {
    e?.preventDefault?.();
    goToSegment(currentSegment + 1);
  };

  // Speed control
  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (playerRef.current) {
      playerRef.current.playbackRate(speed);
    }
  };

  // Expose functions to parent component through callback
  useEffect(() => {
    if (onPlayerReady) {
      onPlayerReady({
        playSegmentByIndex: (segmentIndex) => {
          if (segmentIndex >= 0 && segmentIndex < segments.length) {
            setCurrentSegment(segmentIndex);
            setTimeout(() => {
              // Navigate to enhanced start position then play
              navigateToSegmentStart(segmentIndex);
              playSegment(segmentIndex);
            }, 100);
          }
        },
        playCurrentSegment: () => {
          playCurrentSegment();
        },
        goToSegment: (segmentIndex) => {
          goToSegment(segmentIndex);
        },
        // Expose player reference for TranscriptPanel
        playerRef: playerRef,
        showWordHighlighting: false
      });
    }
  }, [segments, onPlayerReady]);

  // Get current segment data with fallback
  const currentSegmentData = segments[currentSegment] || (segments.length > 0 ? segments[0] : null);

  return (
    <div className={`esl-video-player ${className} h-full flex flex-col`}>
      {/* Clean Video Player Container - Only video and subtitles */}
      <div className="relative bg-black rounded-2xl overflow-hidden shadow-xl flex-shrink-0" style={{ height: '70%' }}>
        <VideoPlayer
          mediaFile={mediaFile}
          transcription={transcription}
          onReady={handlePlayerReady}
          onVideoClick={handleVideoClick}
          className="w-full h-full"
        />

        {/* Clean Subtitle Overlay - Only subtitles on video */}
        {showTranscript && segments.length > 0 && currentSegmentData && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6 pointer-events-none z-10">
            <div className="bg-black/80 backdrop-blur-sm rounded-xl px-8 py-4 text-center shadow-2xl border border-white/10">
              <p className="text-xl md:text-2xl leading-relaxed text-white font-medium tracking-wide break-words whitespace-pre-wrap">
                {currentSegmentData.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Integrated Control Panel - Single modern navbar */}
      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden mt-3 flex-shrink-0" style={{ height: '80px' }}>
        <div className="px-6 py-4">
          {/* Progress Bar - Thinner and more integrated */}
          <div className="mb-4">
            <div className="custom-progress-bar-control">
              <div
                ref={progressBarRef}
                className={`progress-track-control ${isDragging ? 'dragging' : ''}`}
                onClick={handleProgressBarClick}
                onMouseDown={handleProgressBarMouseDown}
              >
                {/* Buffered Progress */}
                <div
                  className="buffered-progress-control"
                  style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
                />
                {/* Play Progress */}
                <div
                  className="play-progress-control"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div
                    className={`progress-handle-control ${isDragging ? 'dragging' : ''}`}
                    onMouseDown={handleProgressBarMouseDown}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Integrated Control Row - Compact like reference image */}
          <div className="flex items-center justify-between">
            {/* Left Side - Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  goToPreviousSegment(e);
                }}
                disabled={currentSegment === 0}
                className="control-button-compact"
                title="Previous Phrase"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  togglePlayPause();
                }}
                className="control-button-compact play-button-compact"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  goToNextSegment(e);
                }}
                disabled={currentSegment === segments.length - 1}
                className="control-button-compact"
                title="Next Phrase"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>
            </div>

            {/* Center - Time Display and ESL Mode Controls */}
            <div className="flex items-center gap-4">
              {/* ESL Mode Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMode('normal')}
                  className={`mode-button-compact ${
                    playbackMode === 'normal'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  NORMAL
                </button>
                <button
                  onClick={() => setMode('listen')}
                  className={`mode-button-compact ${
                    playbackMode === 'listen'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  LISTEN
                </button>
                <button
                  onClick={() => setMode('repeat')}
                  className={`mode-button-compact ${
                    playbackMode === 'repeat'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  REPEAT
                </button>
              </div>

              {/* Time Display */}
              <div className="text-white text-sm font-medium bg-slate-700 px-3 py-1 rounded-lg">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Right Side - Settings Controls */}
            <div className="flex items-center gap-2">
              {/* Volume Control */}
              <button
                className="control-button-compact"
                title="Volume"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 9v6l4-2V7l-4-2z" />
                </svg>
              </button>

              {/* Playback Speed */}
              <div className="relative">
                <select
                  value={playbackSpeed}
                  onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                  className="speed-dropdown-compact"
                >
                  <option value={0.5} className="text-black">0.5x</option>
                  <option value={0.75} className="text-black">0.75x</option>
                  <option value={1} className="text-black">1x</option>
                  <option value={1.25} className="text-black">1.25x</option>
                  <option value={1.5} className="text-black">1.5x</option>
                </select>
              </div>

              {/* Subtitle Toggle */}
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className={`control-button-compact ${
                  showTranscript
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : ''
                }`}
                title="Toggle Subtitles"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                </svg>
              </button>

              {/* Fullscreen */}
              <button
                className="control-button-compact"
                title="Fullscreen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
