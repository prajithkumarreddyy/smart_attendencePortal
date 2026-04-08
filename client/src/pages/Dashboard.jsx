import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Camera, CheckCircle, Clock, LogOut, Bell, Plus, Trash2, Check, X } from 'lucide-react';
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
  const [attendanceStats, setAttendanceStats] = useState({ totalSessions: 0, presentCount: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);
  const [urlToken, setUrlToken] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [newReminder, setNewReminder] = useState('');
  const [addingReminder, setAddingReminder] = useState(false);

  const fetchRecords = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
        const res = await api.get('/attendance/my-records');
        setRecords(res.data.records || []);
        setAttendanceStats({
            totalSessions: res.data.totalSessions || 0,
            presentCount: res.data.presentCount || 0,
            percentage: res.data.percentage || 0
        });
    } catch (err) {
        console.error("Failed to fetch records", err);
    } finally {
        if (!silent) setLoading(false);
    }
  };

  const fetchReminders = async () => {
    try {
        const res = await api.get('/reminders');
        setReminders(res.data);
    } catch (err) {
        console.error("Failed to fetch reminders", err);
    }
  };

  const addReminder = async () => {
    if (!newReminder.trim()) return;
    setAddingReminder(true);
    try {
        const res = await api.post('/reminders', { text: newReminder.trim() });
        setReminders(prev => [res.data, ...prev]);
        setNewReminder('');
    } catch (err) {
        console.error("Failed to add reminder", err);
        alert('Failed to add reminder. Please check your connection.');
    } finally {
        setAddingReminder(false);
    }
  };

  const toggleReminder = async (id) => {
    try {
        const res = await api.put(`/reminders/${id}`);
        setReminders(prev => prev.map(r => r._id === id ? res.data : r));
    } catch (err) {
        console.error("Failed to toggle reminder", err);
    }
  };

  const deleteReminder = async (id) => {
    try {
        await api.delete(`/reminders/${id}`);
        setReminders(prev => prev.filter(r => r._id !== id));
    } catch (err) {
        console.error("Failed to delete reminder", err);
    }
  };

  const handleReminderKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addReminder();
    }
  };

  useEffect(() => {
    // Read sessionToken from URL (direct QR scan while logged in) 
    // OR from sessionStorage (QR scan → login → redirect, where Login.jsx saved it)
    const params = new URLSearchParams(location.search);
    let token = params.get('sessionToken');

    if (!token) {
      token = sessionStorage.getItem('pendingSessionToken');
      if (token) sessionStorage.removeItem('pendingSessionToken');
    }

    if (token) {
        setUrlToken(token);
        if (user.registeredFace) {
            // Face already registered — jump straight to face scanner
            setScanMode('mark');
            setActiveTab('scan');
        } else {
            // Face not registered — show overview but keep the token
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
    } else if (activeTab === 'reminders') {
        fetchReminders();
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
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    
                    {/* Attendance Percentage Card */}
                    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ 
                            width: '80px', height: '80px', borderRadius: '50%', marginBottom: '1rem',
                            background: `conic-gradient(${attendanceStats.percentage >= 75 ? 'var(--success)' : attendanceStats.percentage >= 50 ? '#f59e0b' : 'var(--danger)'} ${attendanceStats.percentage * 3.6}deg, rgba(0,0,0,0.05) 0deg)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.2rem', color: attendanceStats.percentage >= 75 ? 'var(--success)' : attendanceStats.percentage >= 50 ? '#f59e0b' : 'var(--danger)' }}>
                                {attendanceStats.percentage}%
                            </div>
                        </div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Attendance</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {attendanceStats.presentCount}/{attendanceStats.totalSessions} sessions
                        </p>
                    </div>
                    
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

        {activeTab === 'reminders' && (
            <div className="animate-fadeIn">
                <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bell size={24} color="var(--primary)" /> Smart Reminders
                    </h2>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
                        <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Add a new reminder (e.g. Complete DS assignment)..." 
                            value={newReminder}
                            onChange={(e) => setNewReminder(e.target.value)}
                            onKeyDown={handleReminderKeyDown}
                            style={{ flex: 1, margin: 0, padding: '0.8rem 1.2rem' }}
                        />
                        <button type="button" className="btn-primary" disabled={addingReminder || !newReminder.trim()} onClick={addReminder} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', whiteSpace: 'nowrap' }}>
                            <Plus size={20} /> Add
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {reminders.filter(r => !r.completed).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                                <div style={{ background: 'rgba(79, 70, 229, 0.05)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                    <Bell size={30} opacity={0.3} />
                                </div>
                                <p>No active reminders. Stay organized by adding your tasks here!</p>
                            </div>
                        ) : (
                            reminders
                                .filter(r => !r.completed)
                                .map(reminder => (
                                <div 
                                    key={reminder._id} 
                                    className="glass-panel animate-fadeIn" 
                                    style={{ 
                                        padding: '1rem 1.5rem', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '15px',
                                        background: reminder.completed ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.6)',
                                        border: reminder.completed ? '1px solid transparent' : '1px solid var(--glass-border)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <button 
                                        onClick={() => toggleReminder(reminder._id)}
                                        style={{ 
                                            width: '24px', height: '24px', borderRadius: '6px', 
                                            border: reminder.completed ? 'none' : '2px solid var(--primary)', 
                                            background: reminder.completed ? 'var(--success)' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        {reminder.completed && <Check size={16} color="white" />}
                                    </button>
                                    
                                    <div style={{ flex: 1 }}>
                                        <p style={{ 
                                            margin: 0, 
                                            fontSize: '1rem', 
                                            color: reminder.completed ? 'var(--text-muted)' : 'var(--text-main)',
                                            textDecoration: reminder.completed ? 'line-through' : 'none',
                                            transition: 'all 0.2s'
                                        }}>
                                            {reminder.text}
                                        </p>
                                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            Added {new Date(reminder.createdAt).toLocaleDateString()}
                                        </small>
                                    </div>

                                    <button 
                                        onClick={() => deleteReminder(reminder._id)}
                                        style={{ 
                                            background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.6)', 
                                            cursor: 'pointer', padding: '8px', borderRadius: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
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
