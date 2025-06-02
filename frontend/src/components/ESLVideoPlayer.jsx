import React, { useState, useRef, useEffect } from 'react';
import { VideoPlayer } from './VideoPlayer';

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
      // Only handle space key if not typing in an input
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        event.preventDefault();
        playCurrentSegment();
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
        }
      });
    }
  }, [segments, onPlayerReady]);

  const currentSegmentData = segments[currentSegment];

  return (
    <div className={`esl-video-player ${className}`}>
      {/* Main Video Player */}
      <VideoPlayer
        mediaFile={mediaFile}
        transcription={transcription}
        onReady={handlePlayerReady}
        className="mb-4"
      />

      {/* ESL Controls */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Mode Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Learning Mode</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('normal')}
              className={`px-4 py-2 rounded-lg font-medium ${
                playbackMode === 'normal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Normal Play
            </button>
            <button
              onClick={() => setMode('listen')}
              className={`px-4 py-2 rounded-lg font-medium ${
                playbackMode === 'listen'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Listen Mode
            </button>
            <button
              onClick={() => setMode('repeat')}
              className={`px-4 py-2 rounded-lg font-medium ${
                playbackMode === 'repeat'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Repeat Mode
            </button>
          </div>
        </div>

        {/* Segment Navigation */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">
              Segment {currentSegment + 1} of {segments.length}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousSegment}
                disabled={currentSegment === 0}
                className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⏮️
              </button>
              <button
                onClick={playCurrentSegment}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                🔊 Play Segment
              </button>
              <button
                onClick={goToNextSegment}
                disabled={currentSegment === segments.length - 1}
                className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⏭️
              </button>
            </div>
          </div>

          {/* Current Segment Text */}
          {currentSegmentData && showTranscript && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-lg leading-relaxed">{currentSegmentData.text}</p>
              <div className="text-sm text-gray-500 mt-2">
                Duration: {currentSegmentData.duration.toFixed(1)}s
                {playbackMode === 'repeat' && (
                  <span className="ml-4">
                    Repeat: {repeatCount + 1}/{maxRepeats}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Speed and Settings */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => changeSpeed(parseFloat(e.target.value))}
              className="px-3 py-1 border rounded-lg"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showTranscript}
                onChange={(e) => setShowTranscript(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show Transcript</span>
            </label>

            {playbackMode === 'repeat' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Max Repeats:</label>
                <select
                  value={maxRepeats}
                  onChange={(e) => setMaxRepeats(parseInt(e.target.value))}
                  className="px-2 py-1 border rounded"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
