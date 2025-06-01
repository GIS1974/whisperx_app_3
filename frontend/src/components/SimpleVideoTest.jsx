import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export const SimpleVideoTest = () => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState('Initializing...');
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog('Starting Video.js test');
    
    const initPlayer = () => {
      if (!videoRef.current) {
        addLog('Video element not found');
        return;
      }

      addLog('Video element found, initializing Video.js');
      setStatus('Initializing Video.js...');

      try {
        const player = videojs(videoRef.current, {
          controls: true,
          fluid: true,
          responsive: true,
        }, () => {
          addLog('Video.js player ready callback fired');
          setStatus('Player ready');
        });

        playerRef.current = player;

        // Add event listeners
        player.on('loadstart', () => addLog('Event: loadstart'));
        player.on('loadedmetadata', () => addLog('Event: loadedmetadata'));
        player.on('canplay', () => addLog('Event: canplay'));
        player.on('error', (e) => {
          addLog(`Event: error - ${JSON.stringify(player.error())}`);
          setStatus('Error occurred');
        });

        // Set a test video source
        const testUrl = 'http://localhost:8000/api/media/b347e4ec-d9ed-4c91-a318-d852db4ce834/serve/';
        addLog(`Setting video source: ${testUrl}`);
        setStatus('Loading video...');
        
        player.src({
          src: testUrl,
          type: 'video/mp4'
        });

        // Add subtitles
        const vttUrl = 'http://localhost:8000/api/transcriptions/b347e4ec-d9ed-4c91-a318-d852db4ce834/serve/vtt/';
        addLog(`Adding subtitles: ${vttUrl}`);

        player.addRemoteTextTrack({
          kind: 'subtitles',
          src: vttUrl,
          srclang: 'en',
          label: 'English Subtitles',
          default: true,
        }, false);

        // Enable subtitles by default
        setTimeout(() => {
          const textTracks = player.textTracks();
          addLog(`Text tracks found: ${textTracks.length}`);
          if (textTracks.length > 0) {
            textTracks[0].mode = 'showing';
            addLog('Subtitles enabled');
          }
        }, 1000);

      } catch (error) {
        addLog(`Error initializing Video.js: ${error.message}`);
        setStatus('Initialization failed');
      }
    };

    // Small delay to ensure DOM is ready
    const timeout = setTimeout(initPlayer, 100);

    return () => {
      clearTimeout(timeout);
      if (playerRef.current && !playerRef.current.isDisposed()) {
        try {
          playerRef.current.dispose();
        } catch (error) {
          addLog(`Error disposing player: ${error.message}`);
        }
      }
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Video.js Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Player */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Video Player</h2>
          <div className="bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="video-js vjs-default-skin w-full"
              controls
              preload="auto"
              data-setup="{}"
            >
              <p className="vjs-no-js">
                To view this video please enable JavaScript, and consider upgrading to a web browser that
                <a href="https://videojs.com/html5-video-support/" target="_blank" rel="noopener noreferrer">
                  supports HTML5 video
                </a>
              </p>
            </video>
          </div>
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <strong>Status:</strong> {status}
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
        </div>
      </div>
    </div>
  );
};
