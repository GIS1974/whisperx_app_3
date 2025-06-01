import { useState, useEffect } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { mediaAPI } from '../services/api';

export const TestPlayerPage = () => {
  const [testData, setTestData] = useState(null);
  const [urlTestResult, setUrlTestResult] = useState(null);
  const [isTestingUrl, setIsTestingUrl] = useState(false);

  useEffect(() => {
    // Test data for the video player
    const mockMediaFile = {
      id: 'b347e4ec-d9ed-4c91-a318-d852db4ce834',
      filename_original: 'Gilmore Girls-S1E3-720P.mp4',
      mime_type: 'video/mp4',
      file_type: 'video'
    };

    const mockSegments = [
      {
        start: 0.0,
        end: 3.5,
        text: "Dinner was lovely, Emily."
      },
      {
        start: 4.0,
        end: 7.2,
        text: "Mira does make a perfect cassoulet."
      },
      {
        start: 8.0,
        end: 10.5,
        text: "Who's Mira?"
      }
    ];

    setTestData({ mediaFile: mockMediaFile, segments: mockSegments });
  }, []);

  const handlePlayerReady = (player) => {
    console.log('Test Player Ready:', player);
  };

  const handleTimeUpdate = () => {
    console.log('Test Time Update');
  };

  const testMediaUrl = async () => {
    if (!testData) return;

    setIsTestingUrl(true);
    setUrlTestResult(null);

    try {
      const url = mediaAPI.getMediaFileUrl(testData.mediaFile.id);
      console.log('Testing URL:', url);

      // Try HEAD first, fallback to GET with range if HEAD fails
      let response;
      try {
        response = await fetch(url, {
          method: 'HEAD',
          mode: 'cors'
        });
      } catch (headError) {
        console.log('HEAD request failed, trying GET with range:', headError.message);
        // Try GET with a small range to avoid downloading the whole file
        response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Range': 'bytes=0-1023' // Just get first 1KB
          }
        });
      }

      setUrlTestResult({
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: url,
        method: response.status === 206 ? 'GET (Range)' : 'HEAD'
      });
    } catch (error) {
      console.error('URL test failed:', error);
      setUrlTestResult({
        success: false,
        error: error.message,
        url: mediaAPI.getMediaFileUrl(testData.mediaFile.id)
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  if (!testData) {
    return <div>Loading test data...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Video Player Test</h1>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Test Video Player</h2>
        <VideoPlayer
          mediaFile={testData.mediaFile}
          subtitles={testData.segments}
          onReady={handlePlayerReady}
          onTimeUpdate={handleTimeUpdate}
          className="w-full"
        />
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-md font-semibold mb-2">Debug Info</h3>
        <div className="space-y-2 text-sm">
          <div>
            <strong>Media File ID:</strong> {testData.mediaFile.id}
          </div>
          <div>
            <strong>Generated URL:</strong>
            <a
              href={mediaAPI.getMediaFileUrl(testData.mediaFile.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 ml-2 break-all"
            >
              {mediaAPI.getMediaFileUrl(testData.mediaFile.id)}
            </a>
          </div>
          <div>
            <strong>MIME Type:</strong> {testData.mediaFile.mime_type}
          </div>
          <div className="mt-3">
            <button
              onClick={testMediaUrl}
              disabled={isTestingUrl}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm"
            >
              {isTestingUrl ? 'Testing...' : 'Test Media URL'}
            </button>
          </div>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer font-medium">Full Test Data</summary>
          <pre className="text-xs text-gray-700 mt-2 overflow-auto">
            {JSON.stringify(testData, null, 2)}
          </pre>
        </details>
      </div>

      {urlTestResult && (
        <div className={`mt-4 rounded-lg p-4 ${urlTestResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <h3 className="text-md font-semibold mb-2">URL Test Result</h3>
          {urlTestResult.success ? (
            <div className="text-green-800 text-sm space-y-1">
              <div><strong>✅ Success!</strong> Status: {urlTestResult.status} {urlTestResult.statusText}</div>
              <div><strong>Method:</strong> {urlTestResult.method || 'HEAD'}</div>
              <div><strong>URL:</strong> {urlTestResult.url}</div>
              <details className="mt-2">
                <summary className="cursor-pointer">Response Headers</summary>
                <pre className="text-xs mt-1 overflow-auto">
                  {JSON.stringify(urlTestResult.headers, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="text-red-800 text-sm space-y-1">
              <div><strong>❌ Failed!</strong> {urlTestResult.error}</div>
              <div><strong>URL:</strong> {urlTestResult.url}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 bg-blue-50 rounded-lg p-4">
        <h3 className="text-md font-semibold mb-2">Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Open browser console (F12) to see debug logs</li>
          <li>• Check if media source URL is being generated correctly</li>
          <li>• Verify if Video.js player initializes properly</li>
          <li>• Look for any network requests to the media serving endpoint</li>
        </ul>
      </div>
    </div>
  );
};
