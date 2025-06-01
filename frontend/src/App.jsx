import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/esl-player.css';

import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';

// Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { PlayerPage } from './pages/PlayerPage';
import { TestPlayerPage } from './pages/TestPlayerPage';
import { BasicVideoTest } from './components/BasicVideoTest';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />

          <main className="container mx-auto px-4 py-8 max-w-7xl">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Temporarily unprotected routes for testing */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/player/:fileId" element={<PlayerPage />} />
              <Route path="/test-player" element={<TestPlayerPage />} />
              <Route path="/basic-video-test" element={<BasicVideoTest />} />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>

          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
