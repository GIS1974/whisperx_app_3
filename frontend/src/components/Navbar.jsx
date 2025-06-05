import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-full px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="text-xl font-bold text-gray-900">RepeatAfter.Me</span>
          </Link>

          {/* Navigation Links - Temporarily always show for testing */}
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
        </div>
      </div>
    </nav>
  );
};
