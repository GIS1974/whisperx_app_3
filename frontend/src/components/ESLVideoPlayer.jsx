import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { WordHighlighter } from './WordHighlighter';

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
  const [forceSubtitleDisplay, setForceSubtitleDisplay] = useState(false);
  
  const playerRef = useRef(null);
  const segmentTimeoutRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);

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
    <div className={`esl-video-player ${className} flex flex-col`}>
      {/* Main Video Player Container with Modern Styling - Sticky */}
      <div className="relative mb-6 bg-black rounded-2xl overflow-hidden shadow-2xl sticky top-20 z-10">
        <VideoPlayer
          mediaFile={mediaFile}
          transcription={transcription}
          onReady={handlePlayerReady}
          className="w-full aspect-video"
        />

        {/* Subtitle Overlay - Positioned over video with transparency */}
        {showTranscript && segments.length > 0 && (forceSubtitleDisplay || currentSegmentData) && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-5xl px-6 pointer-events-none">
            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-8 py-6 text-center shadow-2xl border border-white/10">
              <p className="text-2xl md:text-3xl leading-relaxed text-white font-medium tracking-wide break-words whitespace-pre-wrap drop-shadow-lg">
                {currentSegmentData?.text || segments[0]?.text || 'Loading subtitles...'}
              </p>
            </div>
          </div>
        )}

        {/* Word Highlighting Overlay - Disabled for now */}
        {false && showWordHighlighting && transcription?.has_word_level_vtt && (
          <WordHighlighter
            mediaFile={mediaFile}
            transcription={transcription}
            playerRef={playerRef}
            isEnabled={showWordHighlighting}
            className="absolute inset-0 pointer-events-none"
          />
        )}

        {/* Video Overlay Controls - Removed duplicate speed control */}
        <div className="absolute top-4 right-4 flex items-center gap-3 pointer-events-auto">
          {/* Settings Toggle */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`p-2 rounded-xl backdrop-blur-sm transition-all duration-200 ${
              showTranscript
                ? 'bg-blue-600/80 text-white'
                : 'bg-black/70 text-white/70 hover:text-white'
            }`}
            title="Toggle Subtitles"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modern ESL Controls - Scrollable */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[60vh] overflow-y-auto">
        {/* Header with Segment Info */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Learning Controls</h3>
              <p className="text-sm text-gray-600">
                Segment {currentSegment + 1} of {segments.length}
                {currentSegmentData && (
                  <span className="ml-2">• {currentSegmentData.duration.toFixed(1)}s</span>
                )}
              </p>
            </div>
            {playbackMode === 'repeat' && (
              <div className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full text-sm font-medium">
                Repeat {repeatCount + 1}/{maxRepeats}
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Learning Mode Selection */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Learning Mode</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setMode('normal')}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  playbackMode === 'normal'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm font-medium">Normal Play</div>
                <div className="text-xs text-gray-500 mt-1">Continuous playback</div>
              </button>

              <button
                onClick={() => setMode('listen')}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  playbackMode === 'listen'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </div>
                <div className="text-sm font-medium">Listen Mode</div>
                <div className="text-xs text-gray-500 mt-1">Segment by segment</div>
              </button>

              <button
                onClick={() => setMode('repeat')}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  playbackMode === 'repeat'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="text-sm font-medium">Repeat Mode</div>
                <div className="text-xs text-gray-500 mt-1">
                  Practice segments
                  {currentSegmentData?.words?.length > 0 && (
                    <span className="block text-blue-600">with enhanced word-level timing</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Segment Navigation */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Navigation</h4>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  goToPreviousSegment(e);
                }}
                disabled={currentSegment === 0}
                className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                title="Previous Segment"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  playCurrentSegment();
                }}
                className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Play Segment
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  goToNextSegment(e);
                }}
                disabled={currentSegment === segments.length - 1}
                className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                title="Next Segment"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Current Segment Display */}
          {currentSegmentData && (
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 mb-6 border border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Current Segment</h4>
              <p className="text-xl leading-relaxed text-gray-900 font-medium mb-3">
                {currentSegmentData.text}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {currentSegmentData.duration.toFixed(1)}s
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                  </svg>
                  {Math.floor(currentSegmentData.start / 60)}:{Math.floor(currentSegmentData.start % 60).toString().padStart(2, '0')} - {Math.floor(currentSegmentData.end / 60)}:{Math.floor(currentSegmentData.end % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          {/* Settings Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Playback Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Playback Settings</h4>

              {/* Speed Control */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Playback Speed</label>
                <select
                  value={playbackSpeed}
                  onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0.5}>0.5x (Slow)</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x (Normal)</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x (Fast)</option>
                </select>
              </div>

              {playbackMode === 'repeat' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Max Repeats</label>
                  <select
                    value={maxRepeats}
                    onChange={(e) => setMaxRepeats(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>1 time</option>
                    <option value={2}>2 times</option>
                    <option value={3}>3 times</option>
                    <option value={5}>5 times</option>
                    <option value={10}>10 times</option>
                  </select>
                </div>
              )}
            </div>

            {/* Display Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Display Settings</h4>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTranscript}
                    onChange={(e) => setShowTranscript(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show Subtitles</span>
                </label>

                {transcription?.has_word_level_vtt && (
                  <label className="flex items-center gap-3 cursor-pointer opacity-50">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={true}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Word Highlighting (Coming Soon)</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Keyboard Shortcuts</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-800">
                <div><kbd className="px-2 py-1 bg-white rounded text-xs">Space</kbd> Play current segment</div>
                <div><kbd className="px-2 py-1 bg-white rounded text-xs">←/→</kbd> Previous/Next segment</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
