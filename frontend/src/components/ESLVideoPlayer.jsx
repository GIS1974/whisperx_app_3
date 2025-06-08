import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { WordHighlighter } from './WordHighlighter';
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
  const [maxRepeats, setMaxRepeats] = useState(3);
  const [showTranscript, setShowTranscript] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showWordHighlighting, setShowWordHighlighting] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [forceSubtitleDisplay, setForceSubtitleDisplay] = useState(false);
  
  const playerRef = useRef(null);
  const segmentTimeoutRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);

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
    if (selectedSegmentIndex !== null && selectedSegmentIndex !== currentSegment) {
      setCurrentSegment(selectedSegmentIndex);
      // Don't auto-play here since it will be triggered by the parent
    }
  }, [selectedSegmentIndex]);

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
    const activeSegment = segments.findIndex((segment, index) => {
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

    // Update current segment if it has changed
    if (segmentToShow !== -1 && segmentToShow !== currentSegment) {
      console.log('Changing segment from', currentSegment, 'to', segmentToShow, segments[segmentToShow]?.text);
      setCurrentSegment(segmentToShow);
      if (onProgress) {
        onProgress(segmentToShow, segments[segmentToShow]);
      }
      if (onSegmentChange) {
        onSegmentChange(segmentToShow, segments[segmentToShow]);
      }
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
  }, [segments, currentSegment, onProgress, onSegmentChange, handleTimeUpdate]);

  // Initialize subtitle display when segments are loaded
  useEffect(() => {
    if (segments.length > 0) {
      // Force subtitle display when segments become available
      setForceSubtitleDisplay(true);
      if (playerRef.current) {
        setTimeout(() => {
          initializeSubtitleDisplay();
        }, 100);
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
          playCurrentSegment();
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

    // Initialize subtitle display immediately
    setTimeout(() => {
      initializeSubtitleDisplay();
    }, 100);
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

    // Prevent page scrolling during navigation
    event?.preventDefault?.();

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
  const goToPreviousSegment = (event) => {
    event?.preventDefault?.();
    goToSegment(currentSegment - 1);
  };

  const goToNextSegment = (event) => {
    event?.preventDefault?.();
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
        // Expose player reference and word highlighting state for TranscriptPanel
        playerRef: playerRef,
        showWordHighlighting: showWordHighlighting
      });
    }
  }, [segments, onPlayerReady, showWordHighlighting]);

  // Get current segment data with fallback
  const currentSegmentData = segments[currentSegment] || (segments.length > 0 ? segments[0] : null);

  return (
    <div className={`esl-video-player ${className} h-full flex flex-col`}>
      {/* Clean Video Player Container - Only video and subtitles */}
      <div className="relative bg-black rounded-xl overflow-hidden shadow-xl flex-shrink-0">
        <VideoPlayer
          mediaFile={mediaFile}
          transcription={transcription}
          onReady={handlePlayerReady}
          className="w-full aspect-video"
        />

        {/* Clean Subtitle Overlay - Only subtitles on video */}
        {showTranscript && segments.length > 0 && (forceSubtitleDisplay || currentSegmentData) && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6 pointer-events-none">
            <div className="subtitle-overlay">
              <p className="text-lg md:text-xl leading-relaxed text-white font-medium tracking-wide break-words whitespace-pre-wrap drop-shadow-lg">
                {currentSegmentData?.text || segments[0]?.text || 'Loading subtitles...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel - Separate section below player */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden mt-4 flex-shrink-0">
        <div className="px-6 py-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="custom-progress-bar-control">
              <div
                className="progress-track-control"
                onClick={(e) => {
                  if (!playerRef.current || !duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const percentage = clickX / rect.width;
                  const newTime = percentage * duration;
                  playerRef.current.currentTime(newTime);
                }}
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
                  <div className="progress-handle-control" />
                </div>
              </div>
            </div>
          </div>

          {/* Control Row */}
          <div className="flex items-center justify-between">
            {/* Left Side - Navigation Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  goToPreviousSegment(e);
                }}
                disabled={currentSegment === 0}
                className="control-button-panel"
                title="Previous Phrase"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (isPlaying) {
                    playerRef.current?.pause();
                  } else {
                    playCurrentSegment();
                  }
                }}
                className="control-button-panel play-button-panel"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="control-button-panel"
                title="Next Phrase"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>

              {/* Volume Control */}
              <button
                className="control-button-panel ml-2"
                title="Volume"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 9v6l4-2V7l-4-2z" />
                </svg>
              </button>
            </div>

            {/* Center - Time Display */}
            <div className="text-white text-sm font-medium bg-slate-700 px-3 py-1 rounded-lg">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Right Side - Settings Controls */}
            <div className="flex items-center gap-3">
              {/* Fullscreen */}
              <button
                className="control-button-panel"
                title="Fullscreen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>

              {/* Playback Speed */}
              <div className="relative">
                <select
                  value={playbackSpeed}
                  onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                  className="speed-dropdown-panel"
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
                className={`control-button-panel ${
                  showTranscript
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : ''
                }`}
                title="Toggle Subtitles"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ESL Mode Controls - Below Control Panel */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-4 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left Side - Mode Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode('normal')}
                className={`mode-button ${playbackMode === 'normal' ? 'active' : ''}`}
              >
                NORMAL
              </button>
              <button
                onClick={() => setMode('listen')}
                className={`mode-button ${playbackMode === 'listen' ? 'active' : ''}`}
              >
                LISTEN
              </button>
              <button
                onClick={() => setMode('repeat')}
                className={`mode-button ${playbackMode === 'repeat' ? 'active' : ''}`}
              >
                REPEAT
              </button>
            </div>

            {/* Right Side - Segment Counter */}
            <div className="text-gray-600 text-sm font-medium">
              Segment {currentSegment + 1} of {segments.length}
            </div>
          </div>
        </div>
      </div>

      {/* Subtitle Section - Clean and Simple */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-4 flex-1 subtitle-section">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Current Segment</h3>
            <div className="flex items-center gap-4">
              {playbackMode === 'repeat' && (
                <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                  Repeat {repeatCount + 1}/{maxRepeats}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current Segment Content */}
        <div className="p-6">
          {currentSegmentData ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-100">
                <p className="text-xl leading-relaxed text-gray-900 font-medium mb-4">
                  {currentSegmentData.text}
                </p>
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Duration: {currentSegmentData.duration.toFixed(1)}s
                  </span>
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                    </svg>
                    Time: {Math.floor(currentSegmentData.start / 60)}:{Math.floor(currentSegmentData.start % 60).toString().padStart(2, '0')} - {Math.floor(currentSegmentData.end / 60)}:{Math.floor(currentSegmentData.end % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Additional Settings for Repeat Mode */}
              {playbackMode === 'repeat' && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <h4 className="text-sm font-semibold text-orange-900 mb-3">Repeat Mode Settings</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-orange-800 mb-2 block">Max Repeats</label>
                      <select
                        value={maxRepeats}
                        onChange={(e) => setMaxRepeats(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                      >
                        <option value={1}>1 time</option>
                        <option value={2}>2 times</option>
                        <option value={3}>3 times</option>
                        <option value={5}>5 times</option>
                        <option value={10}>10 times</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                </svg>
              </div>
              <p className="text-gray-500">No segment selected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
