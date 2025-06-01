import { useEffect, useRef, useState } from 'react';
import { formatTimestamp } from '../utils/formatters';
import { LoadingSpinner } from './LoadingSpinner';

export const TranscriptPanel = ({
  segments,
  activeSegmentIndex,
  currentTime,
  onSegmentClick,
  onWordClick,
  loading,
  showSearch = true,
  showStats = true
}) => {
  const activeSegmentRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSegments, setFilteredSegments] = useState(segments || []);

  // Update filtered segments when segments or search term changes
  useEffect(() => {
    if (!segments) {
      setFilteredSegments([]);
      return;
    }

    if (!searchTerm.trim()) {
      setFilteredSegments(segments);
    } else {
      const filtered = segments.filter(segment =>
        segment.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSegments(filtered);
    }
  }, [segments, searchTerm]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex]);

  // Highlight search terms in text
  const highlightSearchTerm = (text) => {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Transcript</h3>
        <div className="text-sm text-gray-500">
          {filteredSegments.length} segments
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            🔍
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="transcript-panel flex-1">
        {filteredSegments.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm">No matching segments found</p>
            </div>
          </div>
        ) : (
          filteredSegments.map((segment, index) => (
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
                        onWordClick={onWordClick}
                        highlightSearchTerm={highlightSearchTerm}
                      />
                    ) : (
                      // Fallback to segment text with search highlighting
                      <span>{highlightSearchTerm(segment.text)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transcript Stats */}
      {showStats && (
        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {searchTerm ? `${filteredSegments.length}/${segments.length}` : segments.length} segments
            </span>
            <span>
              {segments.reduce((total, segment) => {
                return total + (segment.words ? segment.words.length : segment.text.split(' ').length);
              }, 0)} words
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Component for word-level text rendering
const WordLevelText = ({ words, isActive, onWordClick, highlightSearchTerm }) => {
  return (
    <span>
      {words.map((word, index) => (
        <span
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            if (onWordClick && word.start !== undefined) {
              onWordClick(word.start, word);
            }
          }}
          className={`${
            isActive ? 'word-highlight' : ''
          } ${onWordClick ? 'hover:bg-blue-200 hover:rounded px-0.5 cursor-pointer' : ''} transition-colors duration-200`}
          title={word.start ? `${Math.floor(word.start / 60)}:${Math.floor(word.start % 60).toString().padStart(2, '0')}` : ''}
        >
          {highlightSearchTerm ? highlightSearchTerm(word.word || word.text) : (word.word || word.text)}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
};
