import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { mediaAPI, transcriptionAPI } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DebugPanel } from '../components/DebugPanel';
import { VideoPlayer } from '../components/VideoPlayer';
import { ESLControls } from '../components/ESLControls';
import { TranscriptPanel } from '../components/TranscriptPanel';

export const PlayerPage = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();

  // Basic state
  const [mediaFile, setMediaFile] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [segments, setSegments] = useState([]);

  // Video player state
  const playerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ESL features state
  const [listenRepeatMode, setListenRepeatMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [audioMuted, setAudioMuted] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [currentSegment, setCurrentSegment] = useState(null);

  useEffect(() => {
    fetchMediaFile();
  }, [fileId]);

  useEffect(() => {
    if (mediaFile && mediaFile.is_completed) {
      fetchTranscription();
    }
  }, [mediaFile]);

  const fetchMediaFile = async () => {
    try {
      setLoading(true);
      const file = await mediaAPI.getMediaFile(fileId);
      setMediaFile(file);

      if (!file.is_completed && !file.has_failed) {
        // Start polling for completion
        startStatusPolling();
      }
    } catch (error) {
      console.error('Error fetching media file:', error);
      setError('Failed to load media file');
      toast.error('Failed to load media file');
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscription = async () => {
    try {
      const transcriptionData = await transcriptionAPI.getTranscription(fileId);
      setTranscription(transcriptionData);

      // Parse segments from raw output for transcript display
      if (transcriptionData.raw_whisperx_output?.segments) {
        setSegments(transcriptionData.raw_whisperx_output.segments);
      }
    } catch (error) {
      console.error('Error fetching transcription:', error);
      // Don't show error toast as transcription might still be processing
    }
  };

  const startStatusPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await transcriptionAPI.getTranscriptionStatus(fileId);

        if (status.is_completed) {
          clearInterval(pollInterval);
          await fetchMediaFile();
          await fetchTranscription();
          toast.success('Transcription completed!');
        } else if (status.has_failed) {
          clearInterval(pollInterval);
          await fetchMediaFile();
          toast.error('Transcription failed');
        }
      } catch (error) {
        console.error('Error polling status:', error);
        clearInterval(pollInterval);
      }
    }, 5000);

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  };

  const downloadSubtitle = async (format) => {
    try {
      const response = await transcriptionAPI.downloadSubtitleFile(fileId, format);

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${mediaFile.filename_original}_${format}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} file downloaded`);
    } catch (error) {
      console.error(`Error downloading ${format}:`, error);
      toast.error(`Failed to download ${format.toUpperCase()} file`);
    }
  };

  // Player event handlers
  const handlePlayerReady = (playerInstance) => {
    setPlayer(playerInstance);
    playerRef.current = playerInstance;

    // Set up player event listeners
    playerInstance.on('timeupdate', handleTimeUpdate);
    playerInstance.on('loadedmetadata', () => {
      setDuration(playerInstance.duration());
    });

    // Apply initial settings
    playerInstance.playbackRate(playbackSpeed);
    playerInstance.muted(audioMuted);
  };

  const handleTimeUpdate = () => {
    if (!playerRef.current || segments.length === 0) return;

    const time = playerRef.current.currentTime();
    setCurrentTime(time);

    // Find active segment based on current time
    const activeIndex = segments.findIndex(segment =>
      time >= segment.start && time <= segment.end
    );

    if (activeIndex !== -1 && activeIndex !== activeSegmentIndex) {
      setActiveSegmentIndex(activeIndex);
      setCurrentSegment(segments[activeIndex]);

      // Handle listen-and-repeat mode
      if (listenRepeatMode && activeIndex > activeSegmentIndex) {
        // Pause at the end of the current segment
        const segment = segments[activeIndex];
        setTimeout(() => {
          if (playerRef.current && playerRef.current.currentTime() >= segment.end - 0.1) {
            playerRef.current.pause();
          }
        }, (segment.end - time) * 1000);
      }
    }
  };

  // ESL control handlers
  const handleListenRepeatToggle = (enabled) => {
    setListenRepeatMode(enabled);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (playerRef.current) {
      playerRef.current.playbackRate(speed);
    }
  };

  const handleMuteToggle = (muted) => {
    setAudioMuted(muted);
    if (playerRef.current) {
      playerRef.current.muted(muted);
    }
  };

  const handleReplaySegment = () => {
    if (currentSegment && playerRef.current) {
      playerRef.current.currentTime(currentSegment.start);
      playerRef.current.play();
    }
  };

  const handlePlayNextSegment = () => {
    if (activeSegmentIndex < segments.length - 1 && playerRef.current) {
      const nextSegment = segments[activeSegmentIndex + 1];
      playerRef.current.currentTime(nextSegment.start);
      playerRef.current.play();
    }
  };

  const handleSegmentClick = (segment) => {
    if (playerRef.current) {
      playerRef.current.currentTime(segment.start);
      playerRef.current.play();
    }
  };

  // Helper functions for status display
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
      case 'transcribing':
      case 'transcribing_chunked':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'failed_transcription':
        return 'bg-red-100 text-red-800';
      case 'uploaded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'transcribing':
        return 'Transcribing';
      case 'transcribing_chunked':
        return 'Transcribing (Large File)';
      case 'failed':
        return 'Failed';
      case 'failed_transcription':
        return 'Transcription Failed';
      case 'uploaded':
        return 'Uploaded';
      default:
        return status;
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading media file..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-xl mb-4">{error}</div>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!mediaFile) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-xl mb-4">Media file not found</div>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Back Navigation */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-gray-600 hover:text-blue-600 transition-colors duration-200"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{mediaFile.filename_original}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                </svg>
                <span className="capitalize">{mediaFile.file_type}</span>
              </span>
              <span>•</span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                {mediaFile.language_transcription?.toUpperCase()}
              </span>
              <span>•</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(mediaFile.status)}`}>
                {getStatusText(mediaFile.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Status */}
      {mediaFile.is_processing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mr-3"></div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Processing in progress</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Your file is being processed. Transcription will be available shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Status */}
      {mediaFile.has_failed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800">Processing Failed</h3>
          <p className="text-sm text-red-700 mt-1">{mediaFile.error_message}</p>
        </div>
      )}

      {/* Video Player and ESL Features */}
      {mediaFile.is_completed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <VideoPlayer
                mediaFile={mediaFile}
                transcription={transcription}
                subtitles={segments}
                onReady={handlePlayerReady}
                onTimeUpdate={handleTimeUpdate}
                className="w-full"
              />
            </div>

            {/* ESL Controls - Only show when transcription is available */}
            {transcription && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <ESLControls
                  listenRepeatMode={listenRepeatMode}
                  playbackSpeed={playbackSpeed}
                  audioMuted={audioMuted}
                  currentSegment={currentSegment}
                  onListenRepeatToggle={handleListenRepeatToggle}
                  onSpeedChange={handleSpeedChange}
                  onMuteToggle={handleMuteToggle}
                  onReplaySegment={handleReplaySegment}
                  onPlayNextSegment={handlePlayNextSegment}
                  canPlayNext={activeSegmentIndex < segments.length - 1}
                />
              </div>
            )}

            {/* Download Options - Only show when transcription is available */}
            {transcription && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Transcript</h3>
                <div className="flex space-x-3">
                  <button
                    onClick={() => downloadSubtitle('vtt')}
                    className="btn-primary text-sm"
                  >
                    Download VTT
                  </button>
                  <button
                    onClick={() => downloadSubtitle('srt')}
                    className="btn-primary text-sm"
                  >
                    Download SRT
                  </button>
                  <button
                    onClick={() => downloadSubtitle('txt')}
                    className="btn-primary text-sm"
                  >
                    Download TXT
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  VTT: WebVTT format for web players • SRT: SubRip format for video players • TXT: Plain text format
                </p>
              </div>
            )}

            {/* Transcription Loading State */}
            {!transcription && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mr-3"></div>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Loading Transcription</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Transcription data is being loaded. ESL features will be available shortly.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transcript Panel Column */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
              {transcription ? (
                <TranscriptPanel
                  segments={segments}
                  activeSegmentIndex={activeSegmentIndex}
                  currentTime={currentTime}
                  onSegmentClick={handleSegmentClick}
                />
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Transcript</h3>
                  <p className="text-gray-500">Transcript will appear here once transcription data is loaded.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fallback for incomplete transcription */}
      {mediaFile.is_completed && !transcription && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcription Results</h2>
          <p className="text-gray-500 text-center py-8">Transcription data not available</p>
        </div>
      )}

      {/* Debug Information */}
      {mediaFile && (
        <DebugPanel mediaFile={mediaFile} />
      )}
    </div>
  );
};
