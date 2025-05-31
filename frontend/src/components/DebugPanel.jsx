import { useState, useEffect } from 'react';
import { mediaAPI } from '../services/api';

export const DebugPanel = ({ mediaFile }) => {
  const [debugInfo, setDebugInfo] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (mediaFile) {
      const mediaUrl = mediaAPI.getMediaFileUrl(mediaFile.id);
      
      setDebugInfo({
        mediaUrl,
        fileId: mediaFile.id,
        mimeType: mediaFile.mime_type,
        fileType: mediaFile.file_type,
        status: mediaFile.status,
        isCompleted: mediaFile.is_completed,
        hasStoragePath: !!mediaFile.storage_path_original,
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      });
    }
  }, [mediaFile]);

  const testMediaUrl = async () => {
    try {
      const response = await fetch(debugInfo.mediaUrl, { method: 'HEAD' });
      console.log('Media URL test response:', response.status, response.statusText);
      alert(`Media URL test: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.error('Media URL test error:', error);
      alert(`Media URL test error: ${error.message}`);
    }
  };

  if (!mediaFile) return null;

  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="font-medium text-gray-700">Debug Information</span>
        <svg
          className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>File ID:</strong> {debugInfo.fileId}
            </div>
            <div>
              <strong>MIME Type:</strong> {debugInfo.mimeType}
            </div>
            <div>
              <strong>File Type:</strong> {debugInfo.fileType}
            </div>
            <div>
              <strong>Status:</strong> {debugInfo.status}
            </div>
            <div>
              <strong>Is Completed:</strong> {debugInfo.isCompleted ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Has Storage Path:</strong> {debugInfo.hasStoragePath ? 'Yes' : 'No'}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <strong>API Base URL:</strong>
              <div className="bg-white p-2 rounded border text-xs font-mono break-all">
                {debugInfo.apiBaseUrl}
              </div>
            </div>
            <div>
              <strong>Media URL:</strong>
              <div className="bg-white p-2 rounded border text-xs font-mono break-all">
                {debugInfo.mediaUrl}
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={testMediaUrl}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              Test Media URL
            </button>
            <button
              onClick={() => window.open(debugInfo.mediaUrl, '_blank')}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
            >
              Open Media URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
