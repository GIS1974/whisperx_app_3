import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid, remove it and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (credentials) => api.post('/auth/login/', credentials),
  register: (userData) => api.post('/auth/register/', userData),
  logout: () => api.post('/auth/logout/'),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (profileData) => api.put('/auth/profile/', profileData),
  changePassword: (passwordData) => api.post('/auth/change-password/', passwordData),
};

// Media Files API
export const mediaAPI = {
  // Get list of media files
  getMediaFiles: (params = {}) => api.get('/media/', { params }),
  
  // Get specific media file
  getMediaFile: (fileId) => api.get(`/media/${fileId}/`),
  
  // Create media file entry
  createMediaFile: (fileData) => api.post('/media/', fileData),
  
  // Delete media file
  deleteMediaFile: (fileId) => api.delete(`/media/${fileId}/`),
  
  // Upload chunk
  uploadChunk: (chunkData) => {
    const formData = new FormData();
    Object.keys(chunkData).forEach(key => {
      formData.append(key, chunkData[key]);
    });
    
    return api.post('/media/upload/chunk/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Cancel upload
  cancelUpload: (uploadId) => api.delete(`/media/upload/${uploadId}/cancel/`),
  
  // Get media file URL for serving
  getMediaFileUrl: (fileId) => `${API_BASE_URL}/media/${fileId}/serve/`,
  
  // Get audio file URL for serving
  getAudioFileUrl: (fileId) => `${API_BASE_URL}/media/${fileId}/audio/`,
};

// Transcriptions API
export const transcriptionAPI = {
  // Get transcription details
  getTranscription: (fileId, includeRaw = false) =>
    api.get(`/transcriptions/${fileId}/`, {
      params: { include_raw: includeRaw }
    }),

  // Get transcription status
  getTranscriptionStatus: (fileId) => api.get(`/transcriptions/${fileId}/status/`),

  // Update transcription segments
  updateTranscriptionSegments: (fileId, segments) =>
    api.put(`/transcriptions/${fileId}/update/`, { segments }),

  // Download subtitle file
  downloadSubtitleFile: (fileId, fileType) => {
    return api.get(`/transcriptions/${fileId}/download/${fileType}/`, {
      responseType: 'blob',
    });
  },

  // Get subtitle file URL for serving (for video player)
  getSubtitleFileUrl: (fileId, fileType) =>
    `${API_BASE_URL}/transcriptions/${fileId}/serve/${fileType}/`,

  // Get word-level subtitle file URL for word highlighting
  getWordLevelSubtitleFileUrl: (fileId) =>
    `${API_BASE_URL}/transcriptions/${fileId}/serve/word_vtt/`,

  // Get word-level VTT content for word highlighting
  getWordLevelVTT: (fileId) => {
    return api.get(`/transcriptions/${fileId}/serve/word_vtt/`, {
      responseType: 'text',
    });
  },
};

// File upload utilities
export const uploadUtils = {
  // Calculate number of chunks needed
  calculateChunks: (fileSize, chunkSize = 5 * 1024 * 1024) => {
    return Math.ceil(fileSize / chunkSize);
  },
  
  // Split file into chunks
  createChunk: (file, chunkNumber, chunkSize = 5 * 1024 * 1024) => {
    const start = chunkNumber * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    return file.slice(start, end);
  },
  
  // Validate file type
  validateFileType: (file) => {
    const allowedTypes = [
      'audio/mpeg',        // .mp3
      'video/mp4',         // .mp4
      'video/x-matroska',  // .mkv
    ];
    
    return allowedTypes.includes(file.type);
  },
  
  // Validate file size
  validateFileSize: (file, maxSize = 1024 * 1024 * 1024) => {
    return file.size <= maxSize;
  },
  
  // Get file type category
  getFileTypeCategory: (file) => {
    if (file.type.startsWith('video/')) {
      return 'video';
    } else if (file.type.startsWith('audio/')) {
      return 'audio';
    }
    return 'unknown';
  },
};

export default api;
