import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthPage from './pages/AuthPage';
import TimelinePage from './pages/TimelinePage';
import LandingPage from './pages/LandingPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg-primary)' }}>
      <div style={{ textAlign:'center' }}>
        <div className="animate-float" style={{ fontSize:'40px',marginBottom:'16px' }}>✦</div>
        <p style={{ color:'var(--text-muted)',fontFamily:'DM Sans, sans-serif' }}>Loading Memoria…</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/timeline" replace /> : children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
            <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route path="/timeline" element={<PrivateRoute><TimelinePage /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
