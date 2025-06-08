import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  onTranscriptionUpdate,
  focusMode = false,
  // Word highlighting props
  playerRef = null,
  transcription = null,
  showWordHighlighting = false
}) => {
  const activeSegmentRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrolledSegmentRef = useRef(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSegments, setFilteredSegments] = useState(segments || []);

  // Editing state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSegments, setEditedSegments] = useState([]);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Word highlighting state
  const [wordLevelData, setWordLevelData] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isLoadingWords, setIsLoadingWords] = useState(false);

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

  // Update filtered segments when segments, search term changes
  // Note: Focus mode no longer filters segments - it only affects scrolling behavior
  useEffect(() => {
    // Always use the most recent segments data
    // If we have editedSegments and they're not empty, use those
    // Otherwise use the original segments
    const sourceSegments = (editedSegments && editedSegments.length > 0) ? editedSegments : segments;

    if (!sourceSegments) {
      setFilteredSegments([]);
      return;
    }

    let filtered = sourceSegments;

    // Focus mode no longer filters segments - show all segments for scrolling
    // Focus mode only affects auto-scrolling behavior to keep current phrase visible

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(segment =>
        segment.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSegments(filtered);
  }, [segments, editedSegments, searchTerm]);

  // Word highlighting helper functions (defined before useEffects that use them)
  const parseWordLevelVTT = useCallback((vttText) => {
    const lines = vttText.split('\n');
    const words = [];
    let i = 0;

    const parseVTTTime = (timeString) => {
      const [hours, minutes, seconds] = timeString.split(':');
      return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
    };

    while (i < lines.length) {
      const line = lines[i].trim();

      if (/^\d+$/.test(line)) {
        i++; // Move to timing line

        if (i < lines.length) {
          const timingLine = lines[i].trim();
          const timingMatch = timingLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);

          if (timingMatch) {
            const startTime = parseVTTTime(timingMatch[1]);
            const endTime = parseVTTTime(timingMatch[2]);

            i++; // Move to text line
            if (i < lines.length) {
              const textLine = lines[i].trim();

              const wordMatch = textLine.match(/<c\.word-highlight>(.*?)<\/c>/);
              const word = wordMatch ? wordMatch[1] : textLine.replace(/<[^>]*>/g, '');

              if (word && word !== '¶¶') {
                words.push({
                  word: word.trim(),
                  start: startTime,
                  end: endTime,
                  index: words.length
                });
              }
            }
          }
        }
      }
      i++;
    }

    return words;
  }, []);

  const loadWordLevelData = useCallback(async () => {
    if (!mediaFileId) return;

    setIsLoadingWords(true);
    try {
      const vttText = await transcriptionAPI.getWordLevelVTT(mediaFileId);
      console.log('Word-level VTT response type:', typeof vttText);
      console.log('Word-level VTT response length:', vttText?.length);

      if (!vttText || typeof vttText !== 'string') {
        console.error('VTT text is not a string:', vttText);
        return;
      }

      const words = parseWordLevelVTT(vttText);
      console.log('Parsed words:', words.length, 'words');
      console.log('First few words:', words.slice(0, 5));
      setWordLevelData(words);
    } catch (error) {
      console.error('Error loading word-level data:', error);
    } finally {
      setIsLoadingWords(false);
    }
  }, [mediaFileId, parseWordLevelVTT]);

  const findActiveWordIndex = (currentTime, words) => {
    return words.findIndex(word =>
      currentTime >= word.start && currentTime <= word.end
    );
  };

  // Auto-scroll to active segment (only when focus mode is enabled)
  useEffect(() => {
    // Only auto-scroll when focus mode is enabled and we have an active segment
    if (focusMode && activeSegmentIndex >= 0 && activeSegmentRef.current) {
      // Debounce rapid segment changes to prevent erratic scrolling
      if (lastScrolledSegmentRef.current === activeSegmentIndex) {
        return; // Don't scroll if we already scrolled to this segment
      }

      // Clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Use a delay to debounce rapid segment changes
      scrollTimeoutRef.current = setTimeout(() => {
        // Check if we still need to scroll (segment might have changed again)
        if (lastScrolledSegmentRef.current === activeSegmentIndex) {
          return;
        }

        // Find the transcript panel container
        const transcriptPanel = activeSegmentRef.current?.closest('.transcript-panel');
        if (transcriptPanel && activeSegmentRef.current) {
          // Get the position of the active segment relative to the transcript panel
          const elementTop = activeSegmentRef.current.offsetTop;
          const elementHeight = activeSegmentRef.current.offsetHeight;

          // Calculate the header height more accurately
          // The header is in the parent PlayerPage component, not in TranscriptPanel
          // We need to account for:
          // 1. The TranscriptPanel's own header (segment count + search)
          // 2. Some padding to ensure visibility

          // Find the TranscriptPanel's own header elements
          const transcriptContainer = transcriptPanel.parentElement;
          let headerHeight = 0;

          if (transcriptContainer) {
            // Look for the header elements within the TranscriptPanel component
            const headerElements = transcriptContainer.querySelectorAll('.flex.items-center.justify-between, .relative.mb-4');
            headerElements.forEach(el => {
              headerHeight += el.offsetHeight;
            });

            // Add margins and padding (mb-4 = 16px, plus other spacing)
            headerHeight += 60; // Increased to ensure proper clearance
          }

          // Use scrollIntoView with better positioning options
          // This should respect the CSS scroll-margin-top we set
          activeSegmentRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start', // Align to the start of the visible area
            inline: 'nearest'
          });

          // Remember that we scrolled to this segment
          lastScrolledSegmentRef.current = activeSegmentIndex;
        }
      }, 300); // Longer delay to reduce rapid scrolling

      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [activeSegmentIndex, focusMode]);

  // Load word-level data for highlighting
  useEffect(() => {
    if (showWordHighlighting && transcription?.has_word_level_vtt && mediaFileId) {
      loadWordLevelData();
    }
  }, [showWordHighlighting, transcription, mediaFileId, loadWordLevelData]);

  // Set up time update listener for word highlighting
  useEffect(() => {
    if (!playerRef?.current || !wordLevelData.length || !showWordHighlighting) {
      return;
    }

    const handleTimeUpdate = () => {
      const currentTime = playerRef.current.currentTime();
      const activeWordIndex = findActiveWordIndex(currentTime, wordLevelData);

      if (activeWordIndex !== currentWordIndex) {
        console.log('Word highlighting update:', {
          currentTime,
          activeWordIndex,
          currentWord: wordLevelData[activeWordIndex],
          showWordHighlighting
        });
        setCurrentWordIndex(activeWordIndex);
      }
    };

    const player = playerRef.current;
    player.on('timeupdate', handleTimeUpdate);

    return () => {
      player.off('timeupdate', handleTimeUpdate);
    };
  }, [playerRef, wordLevelData, currentWordIndex, showWordHighlighting]);

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

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

  // Highlight current word in text
  const highlightCurrentWord = (text, segmentIndex) => {
    if (!showWordHighlighting || currentWordIndex === -1 || !wordLevelData[currentWordIndex]) {
      return highlightSearchTerm(text);
    }

    const currentWord = wordLevelData[currentWordIndex];

    // Find the segment that corresponds to this segmentIndex
    const currentSegment = segments[segmentIndex];
    if (!currentSegment) {
      return highlightSearchTerm(text);
    }

    // Check if the current word belongs to this segment (with timing tolerance)
    const tolerance = 1.0; // 1 second tolerance
    const wordBelongsToSegment = currentWord.start >= (currentSegment.start - tolerance) &&
                                 currentWord.start <= (currentSegment.end + tolerance);

    // Only highlight if the word belongs to this specific segment
    if (!wordBelongsToSegment) {
      return highlightSearchTerm(text);
    }

    let highlightedText = text;

    // Apply search highlighting first
    if (searchTerm.trim()) {
      const searchRegex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
      const searchParts = highlightedText.split(searchRegex);
      highlightedText = searchParts.map((part, index) =>
        searchRegex.test(part) ? `<mark class="bg-yellow-200 px-1 rounded">${part}</mark>` : part
      ).join('');
    }

    // Then apply word highlighting - only highlight the first occurrence to avoid duplicates
    const wordRegex = new RegExp(`\\b${escapeRegExp(currentWord.word)}\\b`, 'gi');
    let matchCount = 0;
    highlightedText = highlightedText.replace(wordRegex, (match) => {
      matchCount++;
      // Only highlight the first occurrence
      if (matchCount === 1) {
        return `<span class="current-word-highlight bg-blue-200 px-1 rounded font-medium">${match}</span>`;
      }
      return match;
    });

    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
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
                highlightCurrentWord={highlightCurrentWord}
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
  highlightCurrentWord,
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

    if (startSeconds < 0) {
      toast.error('Start time cannot be negative');
      return;
    }

    if (!localText.trim()) {
      toast.error('Segment text cannot be empty');
      return;
    }

    onUpdateSegment(index, 'text', localText.trim());
    onUpdateSegment(index, 'start', startSeconds);
    onUpdateSegment(index, 'end', endSeconds);

    // Exit edit mode for this segment after saving
    onStopEdit();
    toast.success('Segment updated successfully');
  };

  const handleCancelEdit = () => {
    setLocalText(segment.text);
    setLocalStartTime(formatTimeForInput(segment.start));
    setLocalEndTime(formatTimeForInput(segment.end));
    onStopEdit(); // Close the editing window
  };

  // Time adjustment helpers
  const adjustTime = (timeString, adjustment) => {
    const currentSeconds = parseTimeFromInput(timeString);
    const newSeconds = Math.max(0, currentSeconds + adjustment);
    return formatTimeForInput(newSeconds);
  };

  const adjustStartTime = (adjustment) => {
    setLocalStartTime(prev => adjustTime(prev, adjustment));
  };

  const adjustEndTime = (adjustment) => {
    setLocalEndTime(prev => adjustTime(prev, adjustment));
  };

  // Validation helpers
  const isValidTimeRange = () => {
    const startSeconds = parseTimeFromInput(localStartTime);
    const endSeconds = parseTimeFromInput(localEndTime);
    return endSeconds > startSeconds && startSeconds >= 0;
  };

  const getDuration = () => {
    const startSeconds = parseTimeFromInput(localStartTime);
    const endSeconds = parseTimeFromInput(localEndTime);
    return Math.max(0, endSeconds - startSeconds);
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
        <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          {/* Time inputs with visual controls */}
          <div className="space-y-4">
            {/* Start Time Controls */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time</label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => adjustStartTime(-0.2)}
                  className="px-3 py-2 text-sm font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  title="Subtract 0.2s"
                >
                  −
                </button>
                <input
                  type="text"
                  value={localStartTime}
                  onChange={(e) => setLocalStartTime(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-center"
                  placeholder="MM:SS.mmm"
                />
                <button
                  onClick={() => adjustStartTime(0.2)}
                  className="px-3 py-2 text-sm font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  title="Add 0.2s"
                >
                  +
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Click − or + to adjust by 0.2 seconds
              </div>
            </div>

            {/* End Time Controls */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => adjustEndTime(-0.2)}
                  className="px-3 py-2 text-sm font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  title="Subtract 0.2s"
                >
                  −
                </button>
                <input
                  type="text"
                  value={localEndTime}
                  onChange={(e) => setLocalEndTime(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-center"
                  placeholder="MM:SS.mmm"
                />
                <button
                  onClick={() => adjustEndTime(0.2)}
                  className="px-3 py-2 text-sm font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  title="Add 0.2s"
                >
                  +
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Click − or + to adjust by 0.2 seconds
              </div>
            </div>
          </div>

          {/* Duration display with validation */}
          <div className={`rounded-lg p-3 border ${
            isValidTimeRange()
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Duration:</span>
              <div className="flex items-center space-x-2">
                <span className={`font-mono font-semibold ${
                  isValidTimeRange() ? 'text-green-600' : 'text-red-600'
                }`}>
                  {getDuration().toFixed(2)}s
                </span>
                {isValidTimeRange() ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-red-600">⚠️</span>
                )}
              </div>
            </div>
            {!isValidTimeRange() && (
              <div className="text-xs text-red-600 mt-1">
                End time must be after start time
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Segment Text</label>
            <textarea
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-none"
              rows={3}
              placeholder="Enter segment text..."
            />
            <div className="text-xs text-gray-500">
              Characters: {localText.length}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Make sure end time is after start time
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!isValidTimeRange() || !localText.trim()}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                  isValidTimeRange() && localText.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : (
        // View mode
        <div
          onClick={() => !isEditMode && onSegmentClick(segment)}
          className={`group flex items-start space-x-4 p-4 rounded-2xl transition-all duration-200 ${
            !isEditMode
              ? 'cursor-pointer hover:bg-slate-50 hover:shadow-md'
              : ''
          } ${
            isActive
              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 shadow-lg'
              : 'hover:border-l-2 hover:border-gray-300'
          }`}
        >
          <div className="flex flex-col items-center space-y-1 flex-shrink-0">
            <span className={`text-xs font-mono px-3 py-2 rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-blue-500 text-white font-semibold shadow-md'
                : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
            }`}>
              {formatTimestamp(segment.start)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Speaker label if available */}
            {segment.speaker && (
              <div className="text-xs font-medium text-blue-600 mb-2 bg-blue-100 px-2 py-1 rounded-md inline-block">
                {segment.speaker}
              </div>
            )}

            {/* Segment text */}
            <div className="text-sm text-gray-900 leading-relaxed">
              {/* Only use search highlighting, no word highlighting in transcript panel */}
              <span className="break-words">{highlightSearchTerm(segment.text)}</span>
            </div>

            {/* Edit button in edit mode */}
            {isEditMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit();
                }}
                className="mt-3 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors shadow-sm"
              >
                ✏️ Edit
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
