# Subtitle Editing Implementation

## Overview

This document outlines the implementation of subtitle editing functionality that allows users to edit transcription segments, modify timing, and save changes that are reflected in downloaded subtitle files.

## Features Implemented

### 1. **Enhanced Layout**
- **Wider Subtitle Section**: Changed from 3-column to 2-column layout (video + full-height transcript)
- **Full Height Display**: Transcript panel now extends from top to bottom of the page
- **Responsive Design**: Maintains functionality on different screen sizes

### 2. **Edit Toggle Functionality**
- **Edit Mode Toggle**: Button to switch between view and edit modes
- **Visual Indicators**: Edit mode shows blue border indicators on segments
- **Cancel Functionality**: Ability to cancel editing and revert to original content

### 3. **Segment Editing Capabilities**
- **Text Editing**: Full text editing with textarea for each segment
- **Timing Adjustment**: Start and end time editing with MM:SS.mmm format
- **Validation**: Ensures end time is after start time
- **Individual Segment Editing**: Click "Edit" button on any segment to modify it

### 4. **Save Functionality**
- **Backend Integration**: Saves changes to the server via API
- **File Regeneration**: Automatically regenerates VTT, SRT, and TXT files with updated content
- **Download Integration**: Downloaded files include all saved changes
- **Success Feedback**: Toast notifications for successful saves and errors

## Technical Implementation

### Backend Changes

#### New API Endpoint
```
PUT /api/transcriptions/{file_id}/update/
```

**Features:**
- Validates segment data (start/end times, text content)
- Updates the raw WhisperX output with edited segments
- Regenerates all subtitle files (VTT, SRT, TXT) with updated content
- Updates segment and word counts
- Preserves speaker information and word-level timing when available

#### Updated URL Configuration
- Added route for the update endpoint in `transcriptions/urls.py`

### Frontend Changes

#### Enhanced TranscriptPanel Component
**New Props:**
- `mediaFileId`: Required for API calls
- `transcriptionId`: For future use if needed

**New State Management:**
- `isEditMode`: Controls edit/view mode
- `editedSegments`: Stores modified segments
- `editingSegmentIndex`: Tracks which segment is being edited
- `isSaving`: Loading state for save operations

**New Components:**
- `EditableSegment`: Handles individual segment editing with form inputs
- Enhanced UI with edit buttons and save/cancel functionality

#### Updated Layout
**PlayerPage.jsx Changes:**
- Changed from `lg:grid-cols-3` to `lg:grid-cols-2`
- Added `h-screen` for full height layout
- Updated transcript panel container to use full height

### API Integration

#### New API Function
```javascript
updateTranscriptionSegments: (fileId, segments) => 
  api.put(`/transcriptions/${fileId}/update/`, { segments })
```

## User Experience

### Edit Workflow
1. **Enter Edit Mode**: Click "Edit" button in transcript header
2. **Select Segment**: Click "Edit" button on any segment to modify it
3. **Edit Content**: 
   - Modify start/end times using MM:SS.mmm format
   - Edit text content in textarea
4. **Save Changes**: Click "Save" on individual segment
5. **Save All**: Click "Save Changes" in header to persist to server
6. **Download**: Download updated VTT/SRT/TXT files with changes

### Visual Feedback
- **Edit Mode Indicators**: Blue borders and edit buttons
- **Active Editing**: Blue background for segment being edited
- **Loading States**: "Saving..." text during save operations
- **Success/Error Messages**: Toast notifications for user feedback

## Data Flow

### Editing Process
1. User enters edit mode → `isEditMode = true`
2. User clicks edit on segment → `editingSegmentIndex = segmentIndex`
3. User modifies content → Updates `editedSegments` array
4. User saves changes → API call to update backend
5. Backend regenerates subtitle files → Files ready for download
6. User downloads → Gets updated files with changes

### File Generation
1. **API receives updated segments** → Validates data
2. **Updates raw WhisperX output** → Preserves original structure
3. **Regenerates subtitle files**:
   - VTT: WebVTT format with updated timing and text
   - SRT: SubRip format with updated content
   - TXT: Plain text with updated transcription
4. **Updates metadata** → Segment count, word count

## Error Handling

### Validation
- **Time Validation**: Ensures end time > start time
- **Required Fields**: Validates start, end, and text fields
- **Format Validation**: Checks time format (MM:SS.mmm)

### Error Messages
- **Network Errors**: "Failed to save changes. Please try again."
- **Validation Errors**: Specific messages for timing issues
- **Missing Data**: "Cannot save changes - missing data"

## Benefits

### For Users
- **Easy Editing**: Intuitive interface for subtitle correction
- **Immediate Feedback**: Real-time validation and error messages
- **Persistent Changes**: Edits are saved and included in downloads
- **Professional Output**: Generated files maintain proper formatting

### For Developers
- **Maintainable Code**: Clean separation of concerns
- **Extensible**: Easy to add new editing features
- **Robust**: Comprehensive error handling and validation
- **Integrated**: Works seamlessly with existing transcription pipeline

## Future Enhancements

### Potential Improvements
1. **Bulk Editing**: Select and edit multiple segments at once
2. **Undo/Redo**: History management for editing actions
3. **Auto-save**: Periodic saving of changes
4. **Collaboration**: Multi-user editing capabilities
5. **Advanced Timing**: Visual timeline for precise timing adjustment
6. **Export Options**: Additional subtitle formats (ASS, WebVTT with styling)

## Testing Recommendations

### Manual Testing
1. **Edit Mode Toggle**: Verify edit/cancel functionality
2. **Segment Editing**: Test text and timing modifications
3. **Validation**: Test invalid time ranges and formats
4. **Save Process**: Verify successful saves and error handling
5. **Download Integration**: Confirm downloaded files include changes
6. **Layout**: Test responsive design on different screen sizes

### Automated Testing
1. **API Endpoint Tests**: Validate update functionality
2. **Component Tests**: Test EditableSegment component
3. **Integration Tests**: End-to-end editing workflow
4. **Error Handling Tests**: Invalid data scenarios

This implementation provides a comprehensive subtitle editing solution that integrates seamlessly with the existing ESL video application while maintaining high usability and reliability standards.
