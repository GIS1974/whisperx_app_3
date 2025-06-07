import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { mediaAPI, uploadUtils } from '../services/api';
import { formatFileSize, formatProgress } from '../utils/formatters';
import { DebugPanel } from '../components/DebugPanel';

export const UploadPage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [language, setLanguage] = useState('en');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadId, setUploadId] = useState(null);
  const navigate = useNavigate();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
  ];

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!uploadUtils.validateFileType(file)) {
      toast.error('Invalid file type. Please select an MP3, MP4, or MKV file.');
      return;
    }

    // Validate file size
    if (!uploadUtils.validateFileSize(file)) {
      toast.error('File size exceeds 1GB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');

    try {
      // Generate upload ID
      const newUploadId = crypto.randomUUID();
      setUploadId(newUploadId);

      // Calculate chunks
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks
      const totalChunks = uploadUtils.calculateChunks(selectedFile.size, chunkSize);
      
      setUploadStatus(`Uploading ${totalChunks} chunks...`);

      // Upload chunks
      for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
        const chunk = uploadUtils.createChunk(selectedFile, chunkNumber, chunkSize);
        
        const chunkData = {
          upload_id: newUploadId,
          chunk_number: chunkNumber,
          total_chunks: totalChunks,
          filename: selectedFile.name,
          file_type: uploadUtils.getFileTypeCategory(selectedFile),
          total_size: selectedFile.size,
          chunk_file: chunk,
        };

        try {
          const response = await mediaAPI.uploadChunk(chunkData);
          
          // Update progress
          const progress = formatProgress(chunkNumber + 1, totalChunks);
          setUploadProgress(progress);
          setUploadStatus(`Uploaded chunk ${chunkNumber + 1} of ${totalChunks}`);

          // If upload is complete
          if (response.upload_complete) {
            setUploadStatus('Processing file...');
            
            // Create media file entry with language
            const mediaFileData = {
              filename_original: selectedFile.name,
              filesize_bytes: selectedFile.size,
              file_type: uploadUtils.getFileTypeCategory(selectedFile),
              mime_type: selectedFile.type,
              language_transcription: language,
            };

            // The backend should have already created the MediaFile during chunk assembly
            if (response.media_file_id) {
              toast.success('File uploaded successfully! Processing will begin shortly.');
              navigate(`/player/${response.media_file_id}`);
              return;
            }
          }
        } catch (chunkError) {
          console.error(`Error uploading chunk ${chunkNumber}:`, chunkError);
          throw new Error(`Failed to upload chunk ${chunkNumber + 1}`);
        }
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed. Please try again.');
      
      // Cancel upload if we have an upload ID
      if (uploadId) {
        try {
          await mediaAPI.cancelUpload(uploadId);
        } catch (cancelError) {
          console.error('Error canceling upload:', cancelError);
        }
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      setUploadId(null);
    }
  };

  const handleCancel = async () => {
    if (uploadId) {
      try {
        await mediaAPI.cancelUpload(uploadId);
        toast.info('Upload cancelled');
      } catch (error) {
        console.error('Error canceling upload:', error);
      }
    }
    
    setUploading(false);
    setUploadProgress(0);
    setUploadStatus('');
    setUploadId(null);
    setSelectedFile(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Media File</h1>
        <p className="text-gray-600 mt-1">
          Upload audio (.mp3) or video (.mp4, .mkv) files for transcription
        </p>
      </div>

      {/* Upload Form */}
      <div className="card">
        <div className="space-y-6">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".mp3,.mp4,.mkv"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  MP3, MP4, MKV up to 1GB
                </p>
              </div>
            </div>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Selected File</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="text-gray-900 font-medium">{selectedFile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Size:</span>
                  <span className="text-gray-900">{formatFileSize(selectedFile.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="text-gray-900">{selectedFile.type}</span>
                </div>
              </div>
            </div>
          )}

          {/* Language Selection */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
              Transcription Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={uploading}
              className="input-field"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{uploadStatus}</span>
                <span className="text-gray-900 font-medium">{uploadProgress}%</span>
              </div>
              <div className="upload-progress">
                <div
                  className="upload-progress-bar"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            {uploading ? (
              <button
                onClick={handleCancel}
                className="flex-1 btn-secondary"
              >
                Cancel Upload
              </button>
            ) : (
              <>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload and Transcribe
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Guidelines */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Guidelines</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            Supported formats: MP3 (audio), MP4 and MKV (video)
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            Maximum file size: 1GB
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            Clear audio quality improves transcription accuracy
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            Processing time depends on file length and complexity
          </li>
          <li className="flex items-start">
            <span className="text-yellow-500 mr-2">⚠</span>
            Large files may take several minutes to process
          </li>
        </ul>
      </div>

      {/* Debug Panel for development */}
      {import.meta.env.DEV && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Development Debug</h3>
          <div className="text-sm text-gray-600">
            <p><strong>Environment:</strong> {import.meta.env.MODE}</p>
            <p><strong>API Base URL:</strong> {import.meta.env.VITE_API_BASE_URL}</p>
            <p><strong>Build Time:</strong> {new Date().toISOString()}</p>
          </div>
        </div>
      )}
    </div>
  );
};
