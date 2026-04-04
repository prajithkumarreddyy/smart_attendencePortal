import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Camera, CheckCircle, Clock, LogOut } from 'lucide-react';
import api from '../api';
import Sidebar from '../components/Sidebar';
import FaceScanner from '../components/FaceScanner';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';

const Dashboard = ({ user, setUser }) => {
  if (user.role === 'admin') {
      return <AdminDashboard admin={user} setAdmin={setUser} />;
  }

  if (user.role === 'employee') {
      return <EmployeeDashboard user={user} setUser={setUser} />;
  }

  const location = useLocation();

  const [activeTab, setActiveTab] = useState('overview');
  const [scanMode, setScanMode] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [urlToken, setUrlToken] = useState(null);

  const fetchRecords = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
        const res = await api.get('/attendance/my-records');
        setRecords(res.data);
    } catch (err) {
        console.error("Failed to fetch records", err);
    } finally {
        if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Read sessionToken from URL — works on both / and /dashboard routes
    const params = new URLSearchParams(location.search);
    const token = params.get('sessionToken');
    if (token) {
        setUrlToken(token);
        if (user.registeredFace) {
            // Face already registered — jump straight to face scanner
            setScanMode('mark');
            setActiveTab('scan');
        } else {
            // Face not registered — show a prompt but keep the token for later
            setActiveTab('overview');
        }
        // Clean the token from the URL bar
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    let interval;
    if (activeTab === 'overview') {
        const refreshData = async (silent = false) => {
            await fetchRecords(silent);
            api.get('/auth/me').then(res => setUser(res.data)).catch(console.error);
        };
        refreshData();
        interval = setInterval(() => refreshData(true), 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeTab]);


  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const startScan = (mode) => {
    setScanMode(mode);
    setActiveTab('scan');
  };

  const handleScanSuccess = () => {
    setActiveTab('overview');
    if (scanMode === 'register') {
        setUser({ ...user, registeredFace: true });
    }
  };

  return (
      <div className="dashboard-layout">
          <Sidebar role="student" activeTab={activeTab} setActiveTab={setActiveTab} name={user.name} logout={logout} />
          
          <main className="dashboard-main animate-fadeIn">
              <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                  <div>
                      <h1 className="title" style={{ margin: 0 }}>Student Portal</h1>
                      <p className="subtitle" style={{ margin: 0 }}>Welcome back, {user.name} ({user.rollNumber})</p>
                  </div>
              </header>

        {activeTab === 'overview' && (
            <div className="animate-fadeIn">
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    
                    {/* Face Sync Card */}
                    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ background: user.registeredFace ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
                            <Camera size={32} color={user.registeredFace ? 'var(--success)' : 'var(--danger)'} />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Face ID Setup</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            {user.registeredFace 
                                ? 'Your face is successfully mapped to your profile.' 
                                : 'You need to register your face to mark attendance.'}
                        </p>
                        <button 
                            className={user.registeredFace ? "btn-secondary" : "btn-primary"} 
                            onClick={() => !user.registeredFace && startScan('register')}
                            disabled={user.registeredFace}
                            style={user.registeredFace ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                        >
                            {user.registeredFace ? 'Face Locked (Secured)' : 'Register Face Now'}
                        </button>
                    </div>

                    {/* Attendance Action Card */}
                    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
                            <CheckCircle size={32} color="var(--primary)" />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Mark Attendance</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Use your device camera and Face ID to securely mark your presence for today.
                        </p>
                        <button 
                            className="btn-primary" 
                            disabled={!user.registeredFace}
                            onClick={() => startScan('qr-scan')}
                        >
                            Scan Room QR
                        </button>
                        {!user.registeredFace && <small style={{ color: 'var(--danger)', marginTop: '8px' }}>Must register face first.</small>}
                    </div>
                </div>

                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Recent Attendance</h2>
                <div className="glass-panel" style={{ padding: '1rem 1.5rem' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Loading records...</p>
                    ) : records.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No attendance records found.</p>
                    ) : (
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '500' }}>Date</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '500' }}>Time</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '500' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(record => (
                                        <tr key={record._id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ padding: '1rem' }}>{new Date(record.date).toLocaleDateString()}</td>
                                            <td style={{ padding: '1rem' }}>{new Date(record.date).toLocaleTimeString()}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ 
                                                    background: record.status === 'Present' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                    color: record.status === 'Present' ? 'var(--success)' : 'var(--danger)',
                                                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600'
                                                }}>
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'scan' && (
            <div className="glass-panel animate-fadeIn" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    {scanMode === 'register' ? 'Face Registration' : 'Face Verification'}
                </h2>
                <FaceScanner 
                    mode={scanMode} 
                    isRegistered={user.registeredFace}
                    initialToken={urlToken}
                    onCaptureSuccess={handleScanSuccess} 
                    onCancel={() => setActiveTab('overview')} 
                />
            </div>
        )}

          </main>
      </div>
  );
};

export default Dashboard;
