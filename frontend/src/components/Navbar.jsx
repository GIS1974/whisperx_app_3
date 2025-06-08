import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export const Navbar = ({ playerPageInfo = null }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const isPlayerPage = location.pathname.includes('/player/');

  // Helper functions for status display
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
      case 'transcribing':
      case 'transcribing_chunked':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'failed_transcription':
        return 'bg-red-100 text-red-800';
      case 'uploaded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'transcribing':
        return 'Transcribing';
      case 'transcribing_chunked':
        return 'Transcribing (Large File)';
      case 'failed':
        return 'Failed';
      case 'failed_transcription':
        return 'Transcription Failed';
      case 'uploaded':
        return 'Uploaded';
      default:
        return status;
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-full px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Player Info */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-xl font-bold text-gray-900">RepeatAfter.Me</span>
            </Link>

            {/* Player Page Info */}
            {isPlayerPage && playerPageInfo && (
              <>
                <div className="border-l border-gray-300 h-6"></div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <div className="border-l border-gray-300 h-6"></div>
                <div className="flex items-center space-x-4">
                  <h1 className="text-lg font-bold text-gray-900">{playerPageInfo.filename_original}</h1>
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    <span className="capitalize">{playerPageInfo.file_type}</span>
                    <span>•</span>
                    <span>{playerPageInfo.language_transcription?.toUpperCase()}</span>
                    <span>•</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(playerPageInfo.status)}`}>
                      {getStatusText(playerPageInfo.status)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Navigation Links - Only show when not on player page */}
          {!isPlayerPage && (
            <div className="flex items-center space-x-6">
              <Link
                to="/dashboard"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/upload"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Upload
              </Link>

              {/* Testing Mode Indicator */}
              <div className="flex items-center space-x-4">
                <span className="text-gray-700 text-sm bg-yellow-100 px-2 py-1 rounded">
                  Testing Mode (No Auth)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
