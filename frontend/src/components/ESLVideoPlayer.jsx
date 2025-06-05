import React, { useState, useRef, useEffect } from 'react';
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
  
  const playerRef = useRef(null);
  const segmentTimeoutRef = useRef(null);

  // Parse transcript segments from transcription data
  useEffect(() => {
    if (transcription && transcription.segments) {
      const parsedSegments = transcription.segments.map((segment, index) => ({
        id: index,
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
        duration: segment.end - segment.start
      }));
      setSegments(parsedSegments);
    }
  }, [transcription]);

  // Sync with external segment selection
  useEffect(() => {
    if (selectedSegmentIndex !== null && selectedSegmentIndex !== currentSegment) {
      setCurrentSegment(selectedSegmentIndex);
      // Don't auto-play here since it will be triggered by the parent
    }
  }, [selectedSegmentIndex]);

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

  // Handle player ready
  const handlePlayerReady = (player) => {
    playerRef.current = player;
    
    // Set up time update listener for segment tracking
    player.on('timeupdate', handleTimeUpdate);
    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('ended', handleVideoEnd);
  };

  // Handle time updates to track current segment
  const handleTimeUpdate = () => {
    if (!playerRef.current || segments.length === 0) return;

    const currentTime = playerRef.current.currentTime();
    const activeSegment = segments.findIndex(segment =>
      currentTime >= segment.start && currentTime <= segment.end
    );

    if (activeSegment !== -1 && activeSegment !== currentSegment) {
      setCurrentSegment(activeSegment);
      if (onProgress) {
        onProgress(activeSegment, segments[activeSegment]);
      }
      if (onSegmentChange) {
        onSegmentChange(activeSegment, segments[activeSegment]);
      }
    }
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

    playerRef.current.currentTime(segment.start);
    playerRef.current.play();

    // Set timeout to pause at segment end
    segmentTimeoutRef.current = setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.pause();
        if (onSegmentComplete) {
          onSegmentComplete(segmentIndex, segment);
        }
      }
    }, (segment.duration * 1000) / playbackSpeed);
  };

  // Play current segment
  const playCurrentSegment = () => {
    playSegment(currentSegment);
  };

  // Navigate to specific segment
  const goToSegment = (segmentIndex) => {
    if (segmentIndex < 0 || segmentIndex >= segments.length) return;

    setCurrentSegment(segmentIndex);
    setRepeatCount(0);

    // Notify parent component of segment change
    if (onSegmentChange) {
      onSegmentChange(segmentIndex, segments[segmentIndex]);
    }

    if (playerRef.current) {
      const segment = segments[segmentIndex];
      playerRef.current.currentTime(segment.start);

      if (playbackMode !== 'normal') {
        playSegment(segmentIndex);
      }
    }
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
  const goToPreviousSegment = () => {
    goToSegment(currentSegment - 1);
  };

  const goToNextSegment = () => {
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

  const currentSegmentData = segments[currentSegment];

  return (
    <div className={`esl-video-player ${className}`}>
      {/* Main Video Player Container with Modern Styling */}
      <div className="relative mb-6 bg-black rounded-2xl overflow-hidden shadow-2xl">
        <VideoPlayer
          mediaFile={mediaFile}
          transcription={transcription}
          onReady={handlePlayerReady}
          className="w-full aspect-video"
        />

        {/* Subtitle Overlay - Positioned over video */}
        {currentSegmentData && showTranscript && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6 pointer-events-none">
            <div className="bg-black/90 backdrop-blur-md rounded-2xl px-8 py-4 text-center shadow-2xl border border-white/10">
              <p className="text-2xl leading-relaxed text-white font-medium tracking-wide">
                {currentSegmentData.text}
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

        {/* Video Overlay Controls */}
        <div className="absolute top-4 right-4 flex items-center gap-3 pointer-events-auto">
          {/* Speed Control */}
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2">
            <select
              value={playbackSpeed}
              onChange={(e) => changeSpeed(parseFloat(e.target.value))}
              className="bg-transparent text-white text-sm border-none outline-none cursor-pointer"
            >
              <option value={0.5} className="bg-black">0.5x</option>
              <option value={0.75} className="bg-black">0.75x</option>
              <option value={1} className="bg-black">1x</option>
              <option value={1.25} className="bg-black">1.25x</option>
              <option value={1.5} className="bg-black">1.5x</option>
            </select>
          </div>

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

      {/* Modern ESL Controls */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header with Segment Info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">ESL Learning Controls</h3>
              <p className="text-sm text-gray-600">
                Segment {currentSegment + 1} of {segments.length}
                {currentSegmentData && (
                  <span className="ml-2">• {currentSegmentData.duration.toFixed(1)}s</span>
                )}
              </p>
            </div>
            {playbackMode === 'repeat' && (
              <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                Repeat {repeatCount + 1}/{maxRepeats}
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Learning Mode Selection */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Learning Mode</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div className="text-xs text-gray-500 mt-1">Practice segments</div>
              </button>
            </div>
          </div>

          {/* Segment Navigation */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Segment Navigation</h4>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={goToPreviousSegment}
                disabled={currentSegment === 0}
                className="p-3 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title="Previous Segment"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              <button
                onClick={playCurrentSegment}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Play Segment
              </button>

              <button
                onClick={goToNextSegment}
                disabled={currentSegment === segments.length - 1}
                className="p-3 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
