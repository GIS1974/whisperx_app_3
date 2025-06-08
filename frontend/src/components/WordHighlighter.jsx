import { useState, useEffect, useRef } from 'react';
import { transcriptionAPI } from '../services/api';

export const WordHighlighter = ({
  mediaFile,
  transcription,
  playerRef,
  isEnabled = true,
  className = ''
}) => {
  const [wordLevelData, setWordLevelData] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const overlayRef = useRef(null);

  // Load word-level VTT data
  useEffect(() => {
    if (!mediaFile || !transcription || !transcription.has_word_level_vtt || !isEnabled) {
      return;
    }

    const loadWordLevelData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const wordVttUrl = transcriptionAPI.getWordLevelSubtitleFileUrl(mediaFile.id);
        const response = await fetch(wordVttUrl);
        
        if (!response.ok) {
          throw new Error('Failed to load word-level subtitle data');
        }
        
        const vttText = await response.text();
        const parsedData = parseWordLevelVTT(vttText);
        setWordLevelData(parsedData);
      } catch (err) {
        console.error('Error loading word-level data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadWordLevelData();
  }, [mediaFile, transcription, isEnabled]);

  // Set up time update listener
  useEffect(() => {
    if (!playerRef?.current || !isEnabled) {
      return;
    }

    const handleTimeUpdate = () => {
      const playerCurrentTime = playerRef.current.currentTime();
      setCurrentTime(playerCurrentTime);

      // Update word highlighting if we have word-level data
      if (wordLevelData.length > 0) {
        const activeWordIndex = findActiveWordIndex(playerCurrentTime, wordLevelData);
        if (activeWordIndex !== currentWordIndex) {
          console.log('WordHighlighter: Word changed to index', activeWordIndex,
            activeWordIndex >= 0 ? wordLevelData[activeWordIndex] : null);
          setCurrentWordIndex(activeWordIndex);
        }
      }
    };

    const player = playerRef.current;
    player.on('timeupdate', handleTimeUpdate);

    return () => {
      player.off('timeupdate', handleTimeUpdate);
    };
  }, [playerRef, wordLevelData, currentWordIndex, isEnabled]);

  // Parse VTT content to extract word-level timing
  const parseWordLevelVTT = (vttText) => {
    const lines = vttText.split('\n');
    const words = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Skip WEBVTT header and empty lines
      if (line === 'WEBVTT' || line === '') {
        i++;
        continue;
      }

      // Check if this is a cue number
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
              
              // Extract word from VTT cue (remove speaker labels and styling)
              const wordMatch = textLine.match(/<c\.word-highlight>(.*?)<\/c>/);
              const word = wordMatch ? wordMatch[1] : textLine.replace(/<[^>]*>/g, '');
              
              if (word) {
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
  };

  // Convert VTT time format to seconds
  const parseVTTTime = (timeString) => {
    const [hours, minutes, seconds] = timeString.split(':');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
  };

  // Find the currently active word based on playback time
  const findActiveWordIndex = (currentTime, words) => {
    // First try exact match
    for (let i = 0; i < words.length; i++) {
      if (currentTime >= words[i].start && currentTime <= words[i].end) {
        return i;
      }
    }

    // If no exact match, find the word that should be playing based on sequence
    // Look for the word whose start time is closest to but not greater than current time
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // If current time is past this word's start but before the next word's start
      if (currentTime >= word.start) {
        const nextWord = words[i + 1];
        if (!nextWord || currentTime < nextWord.start) {
          return i;
        }
      }

      // Also track closest word as fallback
      const distance = Math.abs(currentTime - word.start);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    // Use closest word if within 2 seconds
    if (bestDistance <= 2.0) {
      return bestIndex;
    }

    return -1;
  };

  // Get current segment text with highlighted words
  const getCurrentSegmentWithHighlights = () => {
    if (!transcription?.segments) {
      return null;
    }

    // If no word is currently active, show the current segment based on player time
    if (currentWordIndex === -1) {
      if (!playerRef?.current) return null;

      const currentTime = playerRef.current.currentTime();
      const currentSegment = transcription.segments.find(segment =>
        currentTime >= segment.start && currentTime <= segment.end
      );

      if (currentSegment) {
        return {
          segment: currentSegment,
          highlightedText: currentSegment.text,
          currentWord: null
        };
      }
      return null;
    }

    const currentWord = wordLevelData[currentWordIndex];
    if (!currentWord) return null;

    // Find the segment that contains this word (with some tolerance for timing differences)
    const currentSegment = transcription.segments.find(segment => {
      const tolerance = 0.5; // 500ms tolerance
      return currentWord.start >= (segment.start - tolerance) &&
             currentWord.start <= (segment.end + tolerance);
    });

    if (!currentSegment) {
      // Fallback: find the closest segment
      let closestSegment = transcription.segments[0];
      let minDistance = Math.abs(currentWord.start - closestSegment.start);

      transcription.segments.forEach(segment => {
        const distance = Math.abs(currentWord.start - segment.start);
        if (distance < minDistance) {
          minDistance = distance;
          closestSegment = segment;
        }
      });

      // Use closest segment if within reasonable range (10 seconds)
      if (minDistance <= 10) {
        return {
          segment: closestSegment,
          highlightedText: closestSegment.text.replace(
            new RegExp(`\\b${escapeRegExp(currentWord.word)}\\b`, 'gi'),
            `<span class="current-word-highlight">${currentWord.word}</span>`
          ),
          currentWord
        };
      }

      return null;
    }

    // Create highlighted text by highlighting only the current word
    let highlightedText = currentSegment.text;

    // Use a more precise approach to highlight the exact current word
    const wordRegex = new RegExp(`\\b${escapeRegExp(currentWord.word)}\\b`, 'gi');
    let matchCount = 0;
    highlightedText = highlightedText.replace(wordRegex, (match) => {
      matchCount++;
      // Only highlight the first occurrence to avoid multiple highlights
      if (matchCount === 1) {
        return `<span class="current-word-highlight">${match}</span>`;
      }
      return match;
    });

    return {
      segment: currentSegment,
      highlightedText,
      currentWord
    };
  };

  // Escape special regex characters
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const segmentData = getCurrentSegmentWithHighlights();

  // Get current segment for display - always try to show something
  const getCurrentSegmentForDisplay = () => {
    if (segmentData) {
      return segmentData;
    }

    // Fallback: show current segment based on player time without word highlighting
    if (!transcription?.segments) {
      return null;
    }

    const currentSegment = transcription.segments.find(segment =>
      currentTime >= segment.start && currentTime <= segment.end
    );

    if (currentSegment) {
      return {
        segment: currentSegment,
        highlightedText: currentSegment.text,
        currentWord: null
      };
    }

    // Last resort: find the closest segment or the segment that should be playing
    if (transcription.segments.length > 0) {
      // First try to find a segment that contains or is close to the current time
      let bestSegment = null;
      let minDistance = Infinity;

      transcription.segments.forEach(segment => {
        // Check if current time is within the segment (with tolerance)
        if (currentTime >= (segment.start - 1) && currentTime <= (segment.end + 1)) {
          bestSegment = segment;
          minDistance = 0;
          return;
        }

        // Otherwise, find the closest segment
        const distanceToStart = Math.abs(currentTime - segment.start);
        const distanceToEnd = Math.abs(currentTime - segment.end);
        const distance = Math.min(distanceToStart, distanceToEnd);

        if (distance < minDistance) {
          minDistance = distance;
          bestSegment = segment;
        }
      });

      if (bestSegment && minDistance <= 10) { // Within 10 seconds
        return {
          segment: bestSegment,
          highlightedText: bestSegment.text,
          currentWord: null
        };
      }
    }

    return null;
  };

  const displayData = getCurrentSegmentForDisplay();

  // Add debug logging (only for significant changes)
  useEffect(() => {
    // Only log when word index changes or when there are issues
    if (currentWordIndex >= 0 && wordLevelData[currentWordIndex]) {
      console.log('WordHighlighter: Active word:', wordLevelData[currentWordIndex].word, 'at', wordLevelData[currentWordIndex].start.toFixed(2) + 's');
    }
  }, [currentWordIndex, wordLevelData]);

  // Handle early returns after all hooks have been called
  if (!isEnabled || !transcription?.has_word_level_vtt) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`word-highlighter ${className}`}>
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading word highlighting...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`word-highlighter ${className}`}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">Error loading word highlighting: {error}</p>
        </div>
      </div>
    );
  }

  // Don't render subtitles here - let ESLVideoPlayer handle subtitle display
  // This prevents subtitle blinking/jumping issues
  return null;
};

export default WordHighlighter;
