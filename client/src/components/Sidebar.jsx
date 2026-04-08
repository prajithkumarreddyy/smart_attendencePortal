import React, { useState } from 'react';
import { LayoutDashboard, Users, UserCheck, DollarSign, Calendar, BookOpen, Camera, LogOut, Shield, Menu, X, Bell } from 'lucide-react';

const Sidebar = ({ role, activeTab, setActiveTab, name, logout }) => {

    const [mobileOpen, setMobileOpen] = useState(false);

    const adminLinks = [
        { id: 'metrics', label: 'Metrics Overview', icon: <LayoutDashboard size={20} /> },
        { id: 'students', label: 'Manage Students', icon: <Users size={20} /> },
        { id: 'employees', label: 'Staff Roster', icon: <UserCheck size={20} /> },
        { id: 'fees', label: 'Fees Config', icon: <DollarSign size={20} /> }
    ];

    const studentLinks = [
        { id: 'overview', label: 'My Attendance', icon: <LayoutDashboard size={20} /> },
        { id: 'reminders', label: 'My Reminders', icon: <Bell size={20} /> },
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

    const handleTabChange = (id) => {
        setActiveTab(id);
        setMobileOpen(false);
    };

    return (
        <>
            {/* ── Desktop Sidebar ── */}
            <aside className="sidebar-desktop">
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
                            onClick={() => handleTabChange(link.id)}
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

            {/* ── Mobile Top Bar ── */}
            <div className="mobile-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={22} color="var(--primary)" />
                    <div>
                        <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)' }}>Smart ERP</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{role.toUpperCase()}</span>
                    </div>
                </div>
                <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                    <Menu size={26} color="var(--text-main)" />
                </button>
            </div>

            {/* ── Mobile Slide-out Drawer ── */}
            {mobileOpen && (
                <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)}>
                    <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Shield size={26} color="var(--primary)" />
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>Smart ERP</h2>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{role.toUpperCase()} PORTAL</span>
                                </div>
                            </div>
                            <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} color="var(--text-main)" />
                            </button>
                        </div>

                        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                            {links.map(link => (
                                <button
                                    key={link.id}
                                    onClick={() => handleTabChange(link.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '14px', padding: '1rem 1.2rem', width: '100%',
                                        background: activeTab === link.id ? 'var(--primary)' : 'transparent',
                                        color: activeTab === link.id ? 'white' : 'var(--text-muted)',
                                        border: 'none', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.2s', fontWeight: '500', fontSize: '1rem'
                                    }}
                                >
                                    {link.icon}
                                    {link.label}
                                </button>
                            ))}
                        </nav>

                        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                            <div style={{ marginBottom: '1rem' }}>
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
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
