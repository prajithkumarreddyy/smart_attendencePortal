import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, UserCheck, DollarSign, Calendar, 
  BookOpen, Camera, LogOut, Shield, ShieldAlert, Menu, X 
} from 'lucide-react';

const Sidebar = ({ role, activeTab, setActiveTab, name, logout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminLinks = [
    { id: 'metrics',    label: 'Overview',        icon: LayoutDashboard },
    { id: 'exam',       label: 'Exam Invigilation', icon: ShieldAlert },
    { id: 'students',   label: 'Students',         icon: Users },
    { id: 'employees',  label: 'Staff',             icon: UserCheck },
    { id: 'fees',       label: 'Fee Records',       icon: DollarSign },
    { id: 'attendance', label: 'Attendance Log',    icon: UserCheck },
  ];

  const studentLinks = [
    { id: 'overview', label: 'My Attendance', icon: LayoutDashboard },
    { id: 'scan',     label: 'Face Scanner',  icon: Camera },
  ];

  const employeeLinks = [
    { id: 'overview',    label: 'My Subjects',      icon: BookOpen },
    { id: 'timetable',   label: 'Timetable',         icon: Calendar },
    { id: 'students',    label: 'Student Roster',    icon: Users },
    { id: 'attendance',  label: 'Attendance Session', icon: Camera },
  ];

  const links = role === 'admin' ? adminLinks : role === 'employee' ? employeeLinks : studentLinks;

  const handleTabChange = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const roleLabel = { admin: 'Administrator', employee: 'Faculty Portal', student: 'Student Portal' }[role] || role;
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  const NavLinks = () => (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
      {links.map(link => {
        const Icon = link.icon;
        const isActive = activeTab === link.id;
        return (
          <button
            key={link.id}
            onClick={() => handleTabChange(link.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              width: '100%',
              background: isActive ? 'rgba(79, 142, 247, 0.15)' : 'transparent',
              color: isActive ? '#4F8EF7' : '#8B949E',
              border: isActive ? '1px solid rgba(79, 142, 247, 0.25)' : '1px solid transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '0.875rem',
              fontWeight: isActive ? '600' : '500',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = '#CBD5E1';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#8B949E';
              }
            }}
          >
            <Icon size={17} style={{ flexShrink: 0 }} />
            <span>{link.label}</span>
            {isActive && (
              <span style={{
                marginLeft: 'auto',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#4F8EF7',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );

  const UserFooter = () => (
    <div style={{ borderTop: '1px solid rgba(48, 57, 76, 0.8)', paddingTop: '1rem', marginTop: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginBottom: '8px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%',
          background: 'rgba(79, 142, 247, 0.2)',
          border: '1px solid rgba(79, 142, 247, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem', fontWeight: '700', color: '#4F8EF7',
          flexShrink: 0,
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '0.875rem', color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </p>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#8B949E' }}>Active Session</p>
        </div>
      </div>
      <button
        onClick={logout}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', padding: '9px', borderRadius: '8px',
          background: 'transparent',
          color: '#8B949E',
          border: '1px solid rgba(248, 81, 73, 0.2)',
          cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem',
          fontFamily: 'inherit',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248, 81, 73, 0.1)'; e.currentTarget.style.color = '#F85149'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B949E'; }}
      >
        <LogOut size={15} /> Sign Out
      </button>
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar-desktop">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem', padding: '0 4px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(79, 142, 247, 0.15)',
            border: '1px solid rgba(79, 142, 247, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Shield size={18} color="#4F8EF7" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#E6EDF3', letterSpacing: '-0.01em' }}>
              Smart ERP
            </h2>
            <span style={{ fontSize: '0.68rem', color: '#4F8EF7', letterSpacing: '0.08em', fontWeight: '600', textTransform: 'uppercase' }}>
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Section label */}
        <p style={{ fontSize: '0.7rem', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 4px', marginBottom: '6px' }}>
          Navigation
        </p>

        <NavLinks />
        <UserFooter />
      </aside>

      {/* ── Mobile Top Bar ── */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'rgba(79, 142, 247, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={15} color="#4F8EF7" />
          </div>
          <div>
            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#E6EDF3' }}>Smart ERP</span>
            <span style={{ fontSize: '0.7rem', color: '#4F8EF7', marginLeft: '6px', fontWeight: '600' }}>{role.toUpperCase()}</span>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#E6EDF3' }}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* ── Mobile Slide-out Drawer ── */}
      {mobileOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={20} color="#4F8EF7" />
                <span style={{ fontWeight: '700', fontSize: '1rem', color: '#E6EDF3' }}>Smart ERP</span>
              </div>
              <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E' }}>
                <X size={22} />
              </button>
            </div>
            <NavLinks />
            <UserFooter />
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
