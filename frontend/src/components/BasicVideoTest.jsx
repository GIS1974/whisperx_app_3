import { useState } from 'react';

export const BasicVideoTest = () => {
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testUrl = 'http://localhost:8000/api/media/b347e4ec-d9ed-4c91-a318-d852db4ce834/serve/';

  const handleLoadStart = () => addLog('HTML5 Video: loadstart');
  const handleLoadedMetadata = () => addLog('HTML5 Video: loadedmetadata');
  const handleCanPlay = () => addLog('HTML5 Video: canplay');
  const handleCanPlayThrough = () => addLog('HTML5 Video: canplaythrough');
  const handleError = (e) => {
    const video = e.target;
    addLog(`HTML5 Video: error - Code: ${video.error?.code}, Message: ${video.error?.message}`);
  };

  const testFetch = async () => {
    addLog('Testing fetch request...');
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-1023'
        }
      });
      addLog(`Fetch response: ${response.status} ${response.statusText}`);
      addLog(`Content-Type: ${response.headers.get('content-type')}`);
      addLog(`Content-Length: ${response.headers.get('content-length')}`);
      addLog(`Accept-Ranges: ${response.headers.get('accept-ranges')}`);
    } catch (error) {
      addLog(`Fetch error: ${error.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Basic Video Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Player */}
        <div>
          <h2 className="text-xl font-semibold mb-4">HTML5 Video Element</h2>
          <div className="bg-black rounded-lg overflow-hidden mb-4">
            <video
              controls
              preload="metadata"
              className="w-full h-auto"
              onLoadStart={handleLoadStart}
              onLoadedMetadata={handleLoadedMetadata}
              onCanPlay={handleCanPlay}
              onCanPlayThrough={handleCanPlayThrough}
              onError={handleError}
            >
              <source src={testUrl} type="video/mp4" />
              <track
                kind="subtitles"
                src="http://localhost:8000/api/transcriptions/b347e4ec-d9ed-4c91-a318-d852db4ce834/serve/vtt/"
                srcLang="en"
                label="English"
                default
              />
              Your browser does not support the video tag.
            </video>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={testFetch}
              className="btn-primary"
            >
              Test Fetch Request
            </button>
            <div className="text-sm text-gray-600">
              <p><strong>Video URL:</strong> {testUrl}</p>
            </div>
          </div>
        </div>

        {/* Debug Logs */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
          <button
            onClick={() => setLogs([])}
            className="btn-secondary mt-2"
          >
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  );
};
