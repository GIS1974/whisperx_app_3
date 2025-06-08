import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/esl-player.css';
import { useState } from 'react';

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
  const [playerPageInfo, setPlayerPageInfo] = useState(null);

  return (
    <AuthProvider>
      <Router>
        <div className="h-screen bg-gray-50 flex flex-col">
          <Navbar playerPageInfo={playerPageInfo} />

          <main className="flex-1 w-full overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Temporarily unprotected routes for testing */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/player/:fileId" element={<PlayerPage onPlayerPageInfoChange={setPlayerPageInfo} />} />
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
