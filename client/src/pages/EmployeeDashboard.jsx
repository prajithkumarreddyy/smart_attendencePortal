import React, { useState, useEffect } from 'react';
import { BookOpen, Users, Calendar, Camera, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api';
import Sidebar from '../components/Sidebar';

const EmployeeDashboard = ({ user, setUser }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [studentList, setStudentList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [qrToken, setQrToken] = useState(null);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [timeLeft, setTimeLeft] = useState(120);
    const [liveAttendance, setLiveAttendance] = useState({ totalStudents: 0, presentCount: 0, presentStudents: [] });

    const handleGenerateQR = async () => {
        try {
            const res = await api.post('/employee/generate-session');
            setQrToken(res.data.sessionToken);
            setCurrentSessionId(res.data.sessionToken);
            setLiveAttendance({ totalStudents: 0, presentCount: 0, presentStudents: [] });
            setTimeLeft(120); // Reset timer to exactly 2 minutes
        } catch (err) {
            alert('Failed to generate secure attendance session.');
        }
    };

    const handleManualMarkDirect = async (roll) => {
        try {
            await api.post('/employee/mark-manual', { rollNumber: roll, sessionToken: currentSessionId });
            // Optimistically update matrix without waiting for the next polling cycle hit
            const studentInfo = studentList.find(s => s.roll === roll);
            if (studentInfo) {
                setLiveAttendance(prev => ({
                    ...prev,
                    presentCount: prev.presentCount + 1,
                    presentStudents: [...prev.presentStudents, studentInfo]
                }));
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to mark manually');
        }
    };

    const handleCompleteSession = () => {
        setCurrentSessionId(null);
        setQrToken(null);
        setLiveAttendance({ totalStudents: 0, presentCount: 0, presentStudents: [] });
    };

    useEffect(() => {
        let timer;
        if (qrToken && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (timeLeft === 0 && qrToken) {
            setQrToken(null);
        }
        return () => clearInterval(timer);
    }, [qrToken, timeLeft]);

    useEffect(() => {
        let listPolling;
        if (activeTab === 'students' || activeTab === 'attendance') {
            const fetchStudents = async (silent = false) => {
                if (!silent) setLoading(true);
                try {
                    const res = await api.get('/employee/students');
                    setStudentList(res.data);
                } catch (err) {
                    console.error(err);
                } finally {
                    if (!silent) setLoading(false);
                }
            };
            fetchStudents();
            listPolling = setInterval(() => fetchStudents(true), 3000);
        }

        let polling;
        if (activeTab === 'attendance' && currentSessionId) {
            const fetchLive = () => {
                api.get(`/employee/live-attendance?token=${currentSessionId}`)
                   .then(res => setLiveAttendance(res.data))
                   .catch(console.error);
            };
            fetchLive(); // Boot instantly
            polling = setInterval(fetchLive, 2500); // Polling telemetry
        }

        return () => {
            if (polling) clearInterval(polling);
            if (listPolling) clearInterval(listPolling);
        };
    }, [activeTab, currentSessionId]);

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const subjects = [
        { id: 1, name: 'Data Structures and Algorithms', code: 'CS201', credits: 4 },
        { id: 2, name: 'Operating Systems', code: 'CS301', credits: 3 }
    ];

    const timetable = [
        { day: 'Monday', time: '09:00 AM - 10:30 AM', subject: 'Data Structures', room: 'Room 401' },
        { day: 'Tuesday', time: '11:00 AM - 12:30 PM', subject: 'Operating Systems', room: 'Room 302' },
        { day: 'Wednesday', time: '09:00 AM - 10:30 AM', subject: 'Data Structures', room: 'Room 401' },
        { day: 'Thursday', time: '02:00 PM - 03:30 PM', subject: 'Operating Systems', room: 'Room 302' },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>
            <Sidebar role="employee" activeTab={activeTab} setActiveTab={setActiveTab} name={'Prof. ' + user.name} logout={logout} />
            
            <main className="animate-fadeIn" style={{ flex: 1, padding: '2rem 4rem', overflowY: 'auto' }}>
                <header style={{ marginBottom: '3rem' }}>
                    <h1 className="title" style={{ margin: 0, fontSize: '2rem' }}>Employee Portal</h1>
                    <p className="subtitle" style={{ margin: 0 }}>Department: {user.department}</p>
                </header>

                <div className="animate-fadeIn">
                    {/* Subjects Section */}
                    {activeTab === 'overview' && (
                        <div className="glass-panel" style={{ padding: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
                                <BookOpen color="var(--primary)" size={28} />
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>My Subjects</h2>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {subjects.map(s => (
                                    <div key={s.id} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '1.5rem', borderRadius: '8px' }}>
                                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>{s.name}</h3>
                                        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Code: {s.code} | Credits: {s.credits}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Timetable Section */}
                    {activeTab === 'timetable' && (
                        <div className="glass-panel" style={{ padding: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
                                <Calendar color="#10b981" size={28} />
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Weekly Timetable</h2>
                            </div>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '1.1rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ padding: '1rem' }}>Day</th>
                                        <th style={{ padding: '1rem' }}>Time</th>
                                        <th style={{ padding: '1rem' }}>Subject</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timetable.map((t, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ padding: '1rem' }}>{t.day}</td>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{t.time}</td>
                                            <td style={{ padding: '1rem', fontWeight: '500' }}>{t.subject}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Student List Section */}
                    {activeTab === 'students' && (
                        <div className="glass-panel" style={{ padding: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
                                <Users color="#f59e0b" size={28} />
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Enrolled Students Matrix</h2>
                            </div>
                            {loading ? (
                                <p style={{ color: 'var(--text-muted)' }}>Loading real-time attendance telemetry...</p>
                            ) : studentList.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)' }}>No registered students found.</p>
                            ) : (
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '1.1rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <th style={{ padding: '1rem' }}>Roll Number</th>
                                            <th style={{ padding: '1rem' }}>Student Name</th>
                                            <th style={{ padding: '1rem' }}>Attendance Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentList.map((s, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{s.roll}</td>
                                                <td style={{ padding: '1rem' }}>{s.name}</td>
                                                <td style={{ padding: '1rem', color: 'var(--success)', fontWeight: '600' }}>{s.attendance}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* Attendance Triple-State Workflow */}
                    {activeTab === 'attendance' && (
                        <div>
                            {!currentSessionId ? (
                                /* STATE 1: GENERATION IDLE */
                                <div className="glass-panel animate-fadeIn" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
                                        <Camera color="var(--primary)" size={48} />
                                    </div>
                                    <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Live Attendance Session</h2>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '500px', margin: '0 auto 3rem auto' }}>
                                        Launch a high-security session. Project the ensuing cryptographic QR payload to your students so they may link to your local portal layer.
                                    </p>
                                    <button className="btn-primary" onClick={handleGenerateQR} style={{ padding: '1rem 3rem', fontSize: '1.2rem' }}>
                                        <RefreshCw size={20} style={{ marginRight: '10px' }} />
                                        Initialize Biometric QR Event
                                    </button>
                                </div>
                            ) : qrToken ? (
                                /* STATE 2: ACTIVE SCANNING HYBRID GRID */
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                                    {/* Left Half: QR Core */}
                                    <div className="glass-panel animate-fadeIn" style={{ padding: '4rem 2rem', textAlign: 'center', height: 'fit-content' }}>
                                        <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Active Transmission</h2>
                                        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                                            <QRCodeSVG value={`${window.location.origin}/?sessionToken=${qrToken}`} size={280} />
                                            <div style={{ marginTop: '1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: timeLeft > 30 ? 'var(--success)' : 'var(--danger)', animation: 'pulse 2s infinite' }}></div>
                                                    <p style={{ margin: 0, color: timeLeft > 30 ? 'var(--success)' : 'var(--danger)', fontWeight: '600', fontSize: '1.4rem', fontFamily: 'monospace' }}>
                                                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                                    </p>
                                                </div>
                                                <button className="btn-secondary" onClick={() => setTimeLeft(0)} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem' }}>Fast-Forward & Finalize →</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Half: Live Matrix Observer */}
                                    <div className="glass-panel animate-fadeIn" style={{ padding: '2rem', height: 'fit-content', minHeight: '500px' }}>
                                        <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>Session Roster Matrix</h2>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '12px' }}>
                                            <div>
                                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Global Enrollment</p>
                                                <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem' }}>{liveAttendance.totalStudents}</h3>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Verified Present</p>
                                                <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: 'var(--success)' }}>{liveAttendance.presentCount}</h3>
                                            </div>
                                        </div>
                                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            {liveAttendance.presentStudents.map((s, i) => (
                                                <div key={i} className="animate-fadeIn" style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <span style={{ fontWeight: 'bold', display: 'block', fontSize: '1.1rem' }}>{s.roll}</span>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{s.name}</span>
                                                    </div>
                                                    <span style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 12px', borderRadius: '12px' }}>Verified</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* STATE 3: FINALIZATION & MANUAL OVERRIDE (Timer = 0) */
                                <div className="glass-panel animate-fadeIn" style={{ padding: '3rem', maxWidth: '800px', margin: '0 auto' }}>
                                    <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '2rem', color: 'var(--text-main)' }}>Finalize Session: Absent Students</h2>
                                    
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                                        The QR cryptographic window has expired. Below are the students who missed the automatic biometric scan.
                                    </p>

                                    <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.4)' }}>
                                        {studentList.filter(s => !liveAttendance.presentStudents.find(ps => ps.roll === s.roll)).length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--success)' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Excellent! All enrolled students are verified present.</h3>
                                            </div>
                                        ) : (
                                            studentList.filter(s => !liveAttendance.presentStudents.find(ps => ps.roll === s.roll)).map((s, i) => (
                                                <div key={i} className="animate-fadeIn" style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <span style={{ fontWeight: 'bold', display: 'block', fontSize: '1.2rem', color: 'var(--text-main)' }}>{s.roll}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{s.name}</span>
                                                    </div>
                                                    <button className="btn-secondary" onClick={() => handleManualMarkDirect(s.roll)} style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>
                                                        Mark Present
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <button className="btn-primary" onClick={handleCompleteSession} style={{ padding: '1rem 4rem', fontSize: '1.2rem', width: '100%' }}>
                                            Submit & Terminate Session Period
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default EmployeeDashboard;
