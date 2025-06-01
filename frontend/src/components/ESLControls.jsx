export const ESLControls = ({
  listenRepeatMode,
  onListenRepeatToggle,
  playbackSpeed,
  onSpeedChange,
  audioMuted,
  onMuteToggle,
  onReplaySegment,
  onPlayNextSegment,
  currentSegment,
  canPlayNext,
}) => {
  const canReplay = currentSegment !== null;
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-gray-900 mb-4">ESL Learning Controls</h3>
      
      <div className="space-y-4">
        {/* Listen and Repeat Mode */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Listen-and-Repeat Mode</h4>
            <p className="text-sm text-gray-600">Automatically pause after each subtitle segment</p>
          </div>
          <button
            onClick={() => onListenRepeatToggle(!listenRepeatMode)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              listenRepeatMode ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                listenRepeatMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Segment Controls */}
        <div className="flex space-x-2">
          <button
            onClick={onReplaySegment}
            disabled={!canReplay}
            className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 Replay Current Segment
          </button>
          <button
            onClick={onPlayNextSegment}
            disabled={!canPlayNext}
            className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⏭️ Play Next Segment
          </button>
        </div>

        {/* Playback Speed Control */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Playback Speed</h4>
          <div className="flex space-x-1">
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-3 py-1 text-sm rounded-md transition-colors duration-200 ${
                  playbackSpeed === speed
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Audio Mute Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Mute Original Audio</h4>
            <p className="text-sm text-gray-600">Practice shadowing without original audio</p>
          </div>
          <button
            onClick={() => onMuteToggle(!audioMuted)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              audioMuted ? 'bg-red-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                audioMuted ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* ESL Tips */}
        <div className="bg-blue-50 rounded-lg p-3 mt-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 ESL Learning Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use Listen-and-Repeat mode to practice pronunciation</li>
            <li>• Slow down playback speed for better comprehension</li>
            <li>• Mute audio and practice shadowing with subtitles</li>
            <li>• Click on transcript segments to jump to specific parts</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
