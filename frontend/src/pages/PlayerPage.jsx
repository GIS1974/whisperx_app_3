import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { mediaAPI, transcriptionAPI } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

import { ESLVideoPlayer } from '../components/ESLVideoPlayer';
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

  // Video player state (simplified for transcript panel)
  const playerRef = useRef(null);
  const [eslVideoPlayerAPI, setEslVideoPlayerAPI] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [currentSegment, setCurrentSegment] = useState(null);
  const [focusMode, setFocusMode] = useState(false);

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
      console.log('=== FETCHING TRANSCRIPTION ===');
      const transcriptionData = await transcriptionAPI.getTranscription(fileId);
      console.log('Transcription data received:', transcriptionData);

      // Parse segments from raw output for transcript display
      if (transcriptionData.raw_whisperx_output?.segments) {
        console.log('Setting segments from raw_whisperx_output:', transcriptionData.raw_whisperx_output.segments.length, 'segments');
        console.log('First few segments:', transcriptionData.raw_whisperx_output.segments.slice(0, 10));
        setSegments(transcriptionData.raw_whisperx_output.segments);

        // Add segments to transcription object for WordHighlighter
        const transcriptionWithSegments = {
          ...transcriptionData,
          segments: transcriptionData.raw_whisperx_output.segments
        };
        setTranscription(transcriptionWithSegments);
      } else {
        console.log('No segments found in raw_whisperx_output');
        // Set transcription without segments if no segments available
        setTranscription(transcriptionData);
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

  // Handler for transcript panel navigation
  const handleSegmentClick = (segment) => {
    // Update local state for transcript panel highlighting
    const segmentIndex = segments.findIndex(s => s.start === segment.start);
    setActiveSegmentIndex(segmentIndex);
    setCurrentSegment(segment);

    // Trigger playback through ESLVideoPlayer
    if (eslVideoPlayerAPI && eslVideoPlayerAPI.playSegmentByIndex) {
      eslVideoPlayerAPI.playSegmentByIndex(segmentIndex);
    }
  };

  // Handler for ESLVideoPlayer segment changes
  const handleSegmentChange = (segmentIndex, segment) => {
    setActiveSegmentIndex(segmentIndex);
    setCurrentSegment(segment);
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Compact File Info Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="border-l border-gray-300 h-5"></div>
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-bold text-gray-900">{mediaFile.filename_original}</h1>
              <div className="flex items-center space-x-3 text-sm text-gray-500">
                <span className="capitalize">{mediaFile.file_type}</span>
                <span>•</span>
                <span>{mediaFile.language_transcription?.toUpperCase()}</span>
                <span>•</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(mediaFile.status)}`}>
                  {getStatusText(mediaFile.status)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Fixed height */}
      <div className="flex-1 overflow-hidden">
        {/* Processing Status */}
        {mediaFile.is_processing && (
          <div className="h-full flex items-center justify-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
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
          </div>
        )}

        {/* Error Status */}
        {mediaFile.has_failed && (
          <div className="h-full flex items-center justify-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <h3 className="text-sm font-medium text-red-800">Processing Failed</h3>
              <p className="text-sm text-red-700 mt-1">{mediaFile.error_message}</p>
            </div>
          </div>
        )}

        {/* ESL Video Player - Fixed Layout */}
        {mediaFile.is_completed && (
          <div className="h-full flex gap-6 p-6">
            {/* Video Player Column - Takes 70% width */}
            <div className="w-[70%] flex flex-col overflow-hidden">
              {/* ESL Video Player with integrated controls */}
              <div className="h-full overflow-hidden">
                <ESLVideoPlayer
                  mediaFile={mediaFile}
                  transcription={transcription}
                  selectedSegmentIndex={activeSegmentIndex}
                  onProgress={(segmentIndex, segment) => {
                    setActiveSegmentIndex(segmentIndex);
                    setCurrentSegment(segment);
                  }}
                  onSegmentComplete={(segmentIndex, segment) => {
                    // Handle segment completion for analytics or progress tracking
                    console.log('Segment completed:', segmentIndex, segment);
                  }}
                  onSegmentChange={handleSegmentChange}
                  onPlayerReady={setEslVideoPlayerAPI}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Transcript Panel Column - Takes 30% width */}
            <div className="w-[30%] flex flex-col overflow-hidden">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">Interactive Transcript</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">Focus Mode</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={focusMode}
                          onChange={(e) => setFocusMode(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                      {focusMode
                        ? "Auto-scroll disabled"
                        : "Click segments to jump"
                      }
                    </p>
                    {/* Download Options - Compact */}
                    {transcription && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => downloadSubtitle('vtt')}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          title="Download VTT"
                        >
                          VTT
                        </button>
                        <button
                          onClick={() => downloadSubtitle('srt')}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          title="Download SRT"
                        >
                          SRT
                        </button>
                        <button
                          onClick={() => downloadSubtitle('txt')}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          title="Download TXT"
                        >
                          TXT
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  {transcription ? (
                    <TranscriptPanel
                      segments={segments}
                      activeSegmentIndex={activeSegmentIndex}
                      currentTime={currentTime}
                      onSegmentClick={handleSegmentClick}
                      onWordClick={(time, word) => {
                        // Find the segment containing this word and select it
                        const segmentIndex = segments.findIndex(segment =>
                          time >= segment.start && time <= segment.end
                        );

                        if (segmentIndex !== -1) {
                          const segment = segments[segmentIndex];
                          setActiveSegmentIndex(segmentIndex);
                          setCurrentSegment(segment);

                          // Trigger playback through ESLVideoPlayer
                          if (eslVideoPlayerAPI && eslVideoPlayerAPI.playSegmentByIndex) {
                            eslVideoPlayerAPI.playSegmentByIndex(segmentIndex);
                          }
                        }
                      }}
                      showSearch={true}
                      showStats={true}
                      mediaFileId={mediaFile.id}
                      transcriptionId={transcription.id}
                      onTranscriptionUpdate={fetchTranscription}
                      focusMode={focusMode}
                      // Word highlighting props - disabled for now
                      playerRef={eslVideoPlayerAPI?.playerRef}
                      transcription={transcription}
                      showWordHighlighting={false}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full p-8">
                      <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Transcript</h3>
                        <p className="text-gray-500">Transcript will appear here once transcription data is loaded.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
