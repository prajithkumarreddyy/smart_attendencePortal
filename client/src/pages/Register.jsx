import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import api from '../api';
import klbg from '../assets/kl-bg.png';

const Register = ({ setUser }) => {
  const [formData, setFormData] = useState({ name: '', rollNumber: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', formData);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.student);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(5px)' }}></div>
      <div className="auth-card glass-panel animate-fadeIn" style={{ position: 'relative', zIndex: 10, maxWidth: '450px', width: '100%', padding: '3rem', border: '1px solid rgba(255, 255, 255, 0.5)', background: 'rgba(255, 255, 255, 0.9)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>
        <h1 className="title">Create Account</h1>
        <p className="subtitle">Join the smart attendance system</p>
        
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              required 
              className="input-field" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="John Doe"
            />
          </div>
          <div className="form-group">
            <label>Roll Number</label>
            <input 
              type="text" 
              required 
              className="input-field" 
              value={formData.rollNumber} 
              onChange={(e) => setFormData({...formData, rollNumber: e.target.value})}
              placeholder="CS2023001"
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              required 
              className="input-field" 
              value={formData.email} 
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="student@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              required 
              className="input-field" 
              value={formData.password} 
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            <UserPlus size={20} />
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        
        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
