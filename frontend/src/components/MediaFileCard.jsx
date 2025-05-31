import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { transcriptionAPI } from '../services/api';
import { formatFileSize, formatDuration, formatDate } from '../utils/formatters';

export const MediaFileCard = ({ file, onDelete, onRefresh }) => {
  const [transcriptionStatus, setTranscriptionStatus] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    // Poll for transcription status if file is processing
    if (file.is_processing) {
      startPolling();
    }
  }, [file.id, file.is_processing]);

  const startPolling = () => {
    if (polling) return;

    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const status = await transcriptionAPI.getTranscriptionStatus(file.id);
        setTranscriptionStatus(status);

        // Stop polling if completed or failed
        if (status.is_completed || status.has_failed) {
          clearInterval(pollInterval);
          setPolling(false);
          onRefresh(); // Refresh the parent list
        }
      } catch (error) {
        console.error('Error polling transcription status:', error);
        clearInterval(pollInterval);
        setPolling(false);
      }
    }, 5000); // Poll every 5 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(pollInterval);
      setPolling(false);
    };
  };

  const getStatusBadge = () => {
    const status = transcriptionStatus?.status || file.status;

    const statusConfig = {
      completed: { color: 'bg-green-100 text-green-800', text: 'Completed' },
      transcribing: { color: 'bg-blue-100 text-blue-800', text: 'Transcribing' },
      transcribing_chunked: { color: 'bg-blue-100 text-blue-800', text: 'Transcribing (Large File)' },
      processing_audio: { color: 'bg-yellow-100 text-yellow-800', text: 'Processing Audio' },
      pending_transcription: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending Transcription' },
      uploading: { color: 'bg-gray-100 text-gray-800', text: 'Uploading' },
      failed_transcription: { color: 'bg-red-100 text-red-800', text: 'Transcription Failed' },
      failed_extraction: { color: 'bg-red-100 text-red-800', text: 'Audio Extraction Failed' },
      failed_audio_too_large: { color: 'bg-red-100 text-red-800', text: 'File Too Large' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', text: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const getFileIcon = () => {
    if (file.file_type === 'video') {
      return '🎥';
    } else if (file.file_type === 'audio') {
      return '🎵';
    }
    return '📄';
  };

  const canPlay = () => {
    return file.is_completed || (transcriptionStatus?.transcription_available);
  };

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      {/* File Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getFileIcon()}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {file.filename_original}
            </h3>
            <p className="text-sm text-gray-500">
              {formatFileSize(file.filesize_bytes)} • {file.file_type}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {getStatusBadge()}
      </div>

      {/* File Details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Uploaded:</span>
          <span className="text-gray-900">{formatDate(file.upload_date)}</span>
        </div>

        {file.duration_seconds && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Duration:</span>
            <span className="text-gray-900">{formatDuration(file.duration_seconds)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Language:</span>
          <span className="text-gray-900">{file.language_transcription.toUpperCase()}</span>
        </div>
      </div>

      {/* Transcription Info */}
      {(file.is_completed || transcriptionStatus?.transcription_available) && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Transcription</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {transcriptionStatus?.word_count && (
              <div>
                <span className="text-gray-500">Words:</span>
                <span className="ml-1 font-medium">{transcriptionStatus.word_count}</span>
              </div>
            )}
            {transcriptionStatus?.segment_count && (
              <div>
                <span className="text-gray-500">Segments:</span>
                <span className="ml-1 font-medium">{transcriptionStatus.segment_count}</span>
              </div>
            )}
            {transcriptionStatus?.speaker_count && (
              <div>
                <span className="text-gray-500">Speakers:</span>
                <span className="ml-1 font-medium">{transcriptionStatus.speaker_count}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {file.has_failed && file.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-800">{file.error_message}</p>
        </div>
      )}

      {/* Processing Progress */}
      {file.is_processing && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            <span className="text-sm text-gray-600">Processing...</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-primary-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {canPlay() ? (
          <Link
            to={`/player/${file.id}`}
            className="flex-1 btn-primary text-center"
          >
            Play
          </Link>
        ) : (
          <button
            disabled
            className="flex-1 btn-primary opacity-50 cursor-not-allowed"
          >
            {file.is_processing ? 'Processing...' : 'Not Ready'}
          </button>
        )}

        <button
          onClick={() => onDelete(file.id)}
          className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
