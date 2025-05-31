import { useEffect, useRef } from 'react';
import { formatTimestamp } from '../utils/formatters';
import { LoadingSpinner } from './LoadingSpinner';

export const TranscriptPanel = ({ segments, activeSegmentIndex, onSegmentClick, loading }) => {
  const activeSegmentRef = useRef(null);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex]);

  if (loading) {
    return (
      <div className="card h-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transcript</h3>
        <LoadingSpinner size="medium" text="Loading transcript..." />
      </div>
    );
  }

  if (!segments || segments.length === 0) {
    return (
      <div className="card h-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transcript</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📝</div>
            <p>No transcript available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-96 flex flex-col">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Transcript</h3>
      
      <div className="transcript-panel flex-1">
        {segments.map((segment, index) => (
          <div
            key={index}
            ref={index === activeSegmentIndex ? activeSegmentRef : null}
            onClick={() => onSegmentClick(segment)}
            className={`transcript-segment ${
              index === activeSegmentIndex ? 'active' : ''
            }`}
          >
            {/* Timestamp */}
            <div className="flex items-start space-x-3">
              <span className="text-xs text-gray-500 font-mono mt-1 flex-shrink-0">
                {formatTimestamp(segment.start)}
              </span>
              
              <div className="flex-1">
                {/* Speaker label if available */}
                {segment.speaker && (
                  <div className="text-xs font-medium text-primary-600 mb-1">
                    {segment.speaker}
                  </div>
                )}
                
                {/* Segment text */}
                <div className="text-sm text-gray-900 leading-relaxed">
                  {segment.words ? (
                    // Render word-level highlighting if available
                    <WordLevelText 
                      words={segment.words} 
                      isActive={index === activeSegmentIndex}
                    />
                  ) : (
                    // Fallback to segment text
                    segment.text
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Transcript Stats */}
      <div className="border-t border-gray-200 pt-3 mt-3">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{segments.length} segments</span>
          <span>
            {segments.reduce((total, segment) => {
              return total + (segment.words ? segment.words.length : segment.text.split(' ').length);
            }, 0)} words
          </span>
        </div>
      </div>
    </div>
  );
};

// Component for word-level text rendering
const WordLevelText = ({ words, isActive }) => {
  return (
    <span>
      {words.map((word, index) => (
        <span
          key={index}
          className={`${
            isActive ? 'word-highlight' : ''
          } transition-colors duration-200`}
        >
          {word.word}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
};
