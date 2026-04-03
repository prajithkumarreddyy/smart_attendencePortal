import React from 'react';
import { LayoutDashboard, Users, UserCheck, DollarSign, Calendar, BookOpen, Camera, LogOut, Shield } from 'lucide-react';

const Sidebar = ({ role, activeTab, setActiveTab, name, logout }) => {

    const adminLinks = [
        { id: 'metrics', label: 'Metrics Overview', icon: <LayoutDashboard size={20} /> },
        { id: 'students', label: 'Manage Students', icon: <Users size={20} /> },
        { id: 'employees', label: 'Staff Roster', icon: <UserCheck size={20} /> },
        { id: 'fees', label: 'Fees Config', icon: <DollarSign size={20} /> }
    ];

    const studentLinks = [
        { id: 'overview', label: 'My Attendance', icon: <LayoutDashboard size={20} /> },
        { id: 'scan', label: 'Face Scanner', icon: <Camera size={20} /> }
    ];

    const employeeLinks = [
        { id: 'overview', label: 'My Subjects', icon: <BookOpen size={20} /> },
        { id: 'timetable', label: 'Weekly Timetable', icon: <Calendar size={20} /> },
        { id: 'students', label: 'Student Roster', icon: <Users size={20} /> },
        { id: 'attendance', label: 'Launch Attendance', icon: <Camera size={20} /> }
    ];

    let links = [];
    if (role === 'admin') links = adminLinks;
    else if (role === 'employee') links = employeeLinks;
    else links = studentLinks;

    return (
        <aside style={{
            width: '280px',
            minWidth: '280px',
            background: 'var(--glass-bg)',
            borderRight: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem 1.5rem',
            height: '100vh',
            position: 'sticky',
            top: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3rem' }}>
                <Shield size={32} color="var(--primary)" />
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Smart ERP</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>{role.toUpperCase()} PORTAL</span>
                </div>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {links.map(link => (
                    <button
                        key={link.id}
                        onClick={() => setActiveTab(link.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem', width: '100%',
                            background: activeTab === link.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === link.id ? 'white' : 'var(--text-muted)',
                            border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.2s', fontWeight: '500'
                        }}
                    >
                        {link.icon}
                        {link.label}
                    </button>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)' }}>{name}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'gray' }}>Secure Session Active</p>
                </div>
                <button 
                    onClick={logout}
                    className="btn-secondary" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <LogOut size={18} /> Disconnect
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
