import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import api from '../api';
import klbg from '../assets/kl-bg.png';

const Login = ({ setUser }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', formData);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ 
        backgroundImage: `url(${klbg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        position: 'relative'
     }}>
      {/* Semi-transparent frosted overlay to ensure form readability against busy building background */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(5px)' }}></div>

      <div className="auth-card glass-panel animate-fadeIn" style={{ position: 'relative', zIndex: 10, maxWidth: '450px', width: '100%', padding: '3rem', border: '1px solid rgba(255, 255, 255, 0.5)', background: 'rgba(255, 255, 255, 0.9)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>
        <h1 className="title">University Portal</h1>
        <p className="subtitle">Secure access for students</p>
        
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1.5rem', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--danger)' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label>Student Roll Number</label>
            <input 
              type="text" 
              required 
              className="input-field" 
              value={formData.username} 
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="2320030484"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label>Secure Password</label>
            <input 
              type="password" 
              required 
              className="input-field" 
              value={formData.password} 
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
            <LogIn size={20} />
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
        
        <div style={{ marginTop: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          First time university user? <br/><br/>
          <Link to="/register" className="btn-secondary" style={{ color: 'var(--primary)', border: 'none', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', fontWeight: '600' }}>Register My Details</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
