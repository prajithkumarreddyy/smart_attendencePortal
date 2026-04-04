import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import api from './api';

// Helper: preserve ?sessionToken when redirecting unauthenticated users to /login
const ProtectedRoot = ({ user }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sessionToken = params.get('sessionToken');

  if (user) {
    // Already logged in — go to dashboard, pass token along
    return <Navigate to={sessionToken ? `/dashboard?sessionToken=${sessionToken}` : '/dashboard'} replace />;
  }
  // Not logged in — send to login, but carry the sessionToken so it survives
  return <Navigate to={sessionToken ? `/login?sessionToken=${sessionToken}` : '/login'} replace />;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="app-container" style={{justifyContent:'center', alignItems:'center'}}>
        <div style={{color: 'var(--primary)', fontSize: '1.2rem'}}>Loading Portal...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container animate-fadeIn">
        <Routes>
          <Route path="/" element={<ProtectedRoot user={user} />} />
          <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
