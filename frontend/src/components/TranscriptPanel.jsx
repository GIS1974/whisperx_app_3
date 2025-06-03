import React, { useEffect, useRef, useState } from 'react';
import { formatTimestamp } from '../utils/formatters';
import { LoadingSpinner } from './LoadingSpinner';
import { transcriptionAPI } from '../services/api';
import { toast } from 'react-toastify';

export const TranscriptPanel = ({
  segments,
  activeSegmentIndex,
  currentTime,
  onSegmentClick,
  onWordClick,
  loading,
  showSearch = true,
  showStats = true,
  mediaFileId,
  transcriptionId,
  onTranscriptionUpdate
}) => {
  const activeSegmentRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSegments, setFilteredSegments] = useState(segments || []);

  // Editing state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSegments, setEditedSegments] = useState([]);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize edited segments when segments change
  useEffect(() => {
    if (segments) {
      // Only reset editedSegments if we don't have unsaved changes
      // This prevents losing edits when the parent component refreshes data
      if (!hasUnsavedChanges && editedSegments.length === 0) {
        // Add original index to each segment for tracking
        const segmentsWithIndex = segments.map((segment, index) => ({
          ...segment,
          originalIndex: index
        }));
        setEditedSegments(segmentsWithIndex);
      }
    }
  }, [segments, hasUnsavedChanges, editedSegments.length]);

  // Update filtered segments when segments or search term changes
  useEffect(() => {
    // Always use the most recent segments data
    // If we have editedSegments and they're not empty, use those
    // Otherwise use the original segments
    const sourceSegments = (editedSegments && editedSegments.length > 0) ? editedSegments : segments;

    if (!sourceSegments) {
      setFilteredSegments([]);
      return;
    }

    if (!searchTerm.trim()) {
      setFilteredSegments(sourceSegments);
    } else {
      const filtered = sourceSegments.filter(segment =>
        segment.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSegments(filtered);
    }
  }, [segments, editedSegments, searchTerm]);

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

  // Editing functions
  const toggleEditMode = () => {
    if (isEditMode) {
      // Cancel editing - reset to original segments and clear search
      // Only clear editedSegments if we're canceling (not if we just saved)
      const segmentsWithIndex = segments.map((segment, index) => ({
        ...segment,
        originalIndex: index
      }));
      setEditedSegments(segmentsWithIndex);
      setEditingSegmentIndex(null);
      setSearchTerm(''); // Clear search to return to normal view
      setHasUnsavedChanges(false); // Clear unsaved changes flag when canceling
    } else {
      // Enter edit mode - initialize editedSegments with current segments
      // Use editedSegments if they exist (from previous edits), otherwise use original segments
      const sourceSegments = (editedSegments && editedSegments.length > 0) ? editedSegments : segments;
      const segmentsWithIndex = sourceSegments.map((segment, index) => ({
        ...segment,
        originalIndex: segment.originalIndex !== undefined ? segment.originalIndex : index
      }));
      setEditedSegments(segmentsWithIndex);

    }
    setIsEditMode(!isEditMode);
  };

  const startEditingSegment = (index) => {
    setEditingSegmentIndex(index);
  };

  const stopEditingSegment = () => {
    setEditingSegmentIndex(null);
  };

  const updateSegment = (index, field, value) => {
    setEditedSegments(prevSegments => {
      const updatedSegments = [...prevSegments];

      // Ensure the segment exists at the index
      if (updatedSegments[index]) {
        updatedSegments[index] = {
          ...updatedSegments[index],
          [field]: value
        };
      } else {
        console.error('No segment found at index:', index);
        return prevSegments; // Return unchanged state
      }

      return updatedSegments;
    });

    // Mark that we have unsaved changes
    setHasUnsavedChanges(true);
  };

  const saveChanges = async () => {
    if (!mediaFileId || !editedSegments.length) {
      toast.error('Cannot save changes - missing data');
      return;
    }

    setIsSaving(true);
    try {
      const response = await transcriptionAPI.updateTranscriptionSegments(mediaFileId, editedSegments);
      toast.success('Transcript updated successfully!');

      // Clear the unsaved changes flag since we just saved
      setHasUnsavedChanges(false);

      // Call parent component to refresh transcription data first
      if (onTranscriptionUpdate) {
        await onTranscriptionUpdate();
      }

      // Exit edit mode but keep the editedSegments so changes remain visible
      setIsEditMode(false);
      setEditingSegmentIndex(null);
      // Note: We don't clear editedSegments here so the changes remain visible
    } catch (error) {
      console.error('Error saving changes:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimeForInput = (seconds) => {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const ms = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const parseTimeFromInput = (timeString) => {
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;

    const minutes = parseInt(parts[0]) || 0;
    const secondsParts = parts[1].split('.');
    const seconds = parseInt(secondsParts[0]) || 0;
    const ms = parseInt(secondsParts[1]) || 0;

    return minutes * 60 + seconds + ms / 1000;
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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Transcript</h3>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            {filteredSegments.length} segments
          </div>

          {/* Edit Toggle */}
          <button
            onClick={toggleEditMode}
            disabled={isSaving}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              isEditMode
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isEditMode ? 'Cancel Edit' : 'Edit Mode'}
          </button>

          {/* Save Button */}
          {isEditMode && (
            <button
              onClick={saveChanges}
              disabled={isSaving}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                isSaving
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
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
          filteredSegments.map((segment, filteredIndex) => {
            // Use the originalIndex property if available, otherwise fall back to finding it
            const originalIndex = segment.originalIndex !== undefined
              ? segment.originalIndex
              : segments.findIndex(s => s.start === segment.start && s.text === segment.text);

            // Create a unique key that includes the segment content to force re-render when text changes
            const segmentKey = `${originalIndex}-${segment.start}-${segment.text.substring(0, 20)}`;

            return (
              <EditableSegment
                key={segmentKey}
                segment={segment}
                index={originalIndex}
                isActive={originalIndex === activeSegmentIndex}
                isEditMode={isEditMode}
                isEditing={editingSegmentIndex === originalIndex}
                onSegmentClick={onSegmentClick}
                onWordClick={onWordClick}
                onStartEdit={() => startEditingSegment(originalIndex)}
                onStopEdit={stopEditingSegment}
                onUpdateSegment={updateSegment}
                highlightSearchTerm={highlightSearchTerm}
                formatTimeForInput={formatTimeForInput}
                parseTimeFromInput={parseTimeFromInput}
                ref={originalIndex === activeSegmentIndex ? activeSegmentRef : null}
              />
            );
          })
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

// Component for editable segment
const EditableSegment = React.forwardRef(({
  segment,
  index,
  isActive,
  isEditMode,
  isEditing,
  onSegmentClick,
  onWordClick,
  onStartEdit,
  onStopEdit,
  onUpdateSegment,
  highlightSearchTerm,
  formatTimeForInput,
  parseTimeFromInput
}, ref) => {
  const [localText, setLocalText] = useState(segment.text);
  const [localStartTime, setLocalStartTime] = useState(formatTimeForInput(segment.start));
  const [localEndTime, setLocalEndTime] = useState(formatTimeForInput(segment.end));

  // Update local state when segment changes
  useEffect(() => {
    setLocalText(segment.text);
    setLocalStartTime(formatTimeForInput(segment.start));
    setLocalEndTime(formatTimeForInput(segment.end));
  }, [segment, formatTimeForInput]);

  const handleSaveEdit = () => {
    const startSeconds = parseTimeFromInput(localStartTime);
    const endSeconds = parseTimeFromInput(localEndTime);

    if (endSeconds <= startSeconds) {
      toast.error('End time must be after start time');
      return;
    }

    onUpdateSegment(index, 'text', localText);
    onUpdateSegment(index, 'start', startSeconds);
    onUpdateSegment(index, 'end', endSeconds);

    // Exit edit mode for this segment after saving
    onStopEdit();
  };

  const handleCancelEdit = () => {
    setLocalText(segment.text);
    setLocalStartTime(formatTimeForInput(segment.start));
    setLocalEndTime(formatTimeForInput(segment.end));
  };

  return (
    <div
      ref={ref}
      className={`transcript-segment ${isActive ? 'active' : ''} ${
        isEditMode ? 'border-l-4 border-blue-200' : ''
      }`}
    >
      {isEditing ? (
        // Edit mode
        <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
          {/* Time inputs */}
          <div className="flex space-x-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="text"
                value={localStartTime}
                onChange={(e) => setLocalStartTime(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="MM:SS.mmm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="text"
                value={localEndTime}
                onChange={(e) => setLocalEndTime(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="MM:SS.mmm"
              />
            </div>
          </div>

          {/* Text input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Text</label>
            <textarea
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Segment text..."
            />
          </div>

          {/* Action buttons */}
          <div className="flex space-x-2">
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // View mode
        <div
          onClick={() => !isEditMode && onSegmentClick(segment)}
          className={`flex items-start space-x-3 p-2 rounded-lg transition-colors ${
            !isEditMode
              ? 'cursor-pointer hover:bg-gray-50'
              : ''
          } ${
            isActive
              ? 'bg-blue-50 border-l-4 border-blue-500'
              : ''
          }`}
        >
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
              {/* Always show the segment.text to ensure edited text is displayed */}
              <span>{highlightSearchTerm(segment.text)}</span>
            </div>

            {/* Edit button in edit mode */}
            {isEditMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit();
                }}
                className="mt-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// Component for word-level text rendering
const WordLevelText = ({ words, isActive, onWordClick, highlightSearchTerm }) => {
  return (
    <span>
      {words.map((word, index) => (
        <span
          key={index}
          onClick={(e) => {
            if (onWordClick && word.start !== undefined) {
              e.stopPropagation();
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
