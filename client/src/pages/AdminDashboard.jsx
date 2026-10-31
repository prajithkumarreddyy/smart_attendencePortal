import React, { useState, useEffect } from 'react';
import { Users, Briefcase, DollarSign, CheckSquare, ShieldAlert, LayoutDashboard, Plus, X, RefreshCw } from 'lucide-react';
import api from '../api';
import Sidebar from '../components/Sidebar';
import ExamProctoring from '../components/ExamProctoring';

const AdminDashboard = ({ admin, setAdmin }) => {
  const [activeTab, setActiveTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', role: '', department: '', username: '', salary: '', password: '' });

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/employees', empForm);
      setDataList([...dataList, res.data]);
      setShowAddEmployee(false);
      setEmpForm({ name: '', role: '', department: '', username: '', salary: '', password: '' });
    } catch (err) {
      alert('Failed to create employee: ' + (err.response?.data?.error || err.response?.data?.message || err.message));
    }
  };

  const handleResetFace = async (studentId) => {
    if (!window.confirm("Reset this student's registered attendance face profile?")) return;
    try {
      await api.put(`/admin/students/${studentId}/reset-face`);
      fetchData(activeTab);
    } catch (err) {
      alert('Failed to reset face: ' + (err.response?.data?.message || err.message));
    }
  };

  const fetchData = async (endpoint, silent = false) => {
    if (endpoint === 'exam') return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/admin/${endpoint}`);
      if (endpoint === 'metrics') setMetrics(res.data);
      else setDataList(res.data);
    } catch (err) {
      console.error('Failed fetching', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'exam') {
      fetchData(activeTab);
      const interval = setInterval(() => fetchData(activeTab, true), 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const logout = () => {
    localStorage.removeItem('token');
    setAdmin(null);
  };

  // ──────────────────────────────────────────────
  //  KPI CARDS for Overview
  // ──────────────────────────────────────────────
  const MetricsView = () => {
    if (!metrics) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8B949E', padding: '3rem' }}>
        <RefreshCw size={18} className="animate-spin" /> Loading metrics…
      </div>
    );

    const cards = [
      { icon: Users,       color: '#4F8EF7', bg: 'rgba(79,142,247,0.12)',  label: 'Registered Students',  value: metrics.students },
      { icon: Briefcase,   color: '#3FB950', bg: 'rgba(63,185,80,0.12)',   label: 'Active Staff',          value: metrics.employees },
      { icon: DollarSign,  color: '#D29922', bg: 'rgba(210,153,34,0.12)', label: 'Fees Collected',        value: `$${metrics.totalFeesCollected?.toLocaleString() || 0}` },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* KPI Row */}
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {cards.map(({ icon: Icon, color, bg, label, value }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon" style={{ background: bg }}>
                <Icon size={18} color={color} />
              </div>
              <div>
                <div className="stat-value" style={{ color }}>{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#8B949E', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { label: '🛡️ Exam Invigilation', tab: 'exam' },
              { label: '👥 Manage Students', tab: 'students' },
              { label: '📋 Attendance Log', tab: 'attendance' },
              { label: '💼 Staff Roster', tab: 'employees' },
            ].map(({ label, tab }) => (
              <button
                key={tab}
                className="btn-secondary"
                onClick={() => setActiveTab(tab)}
                style={{ fontSize: '0.85rem' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────
  //  Data Tables
  // ──────────────────────────────────────────────
  const DataView = () => {
    const tabConfig = {
      students: {
        title: 'Students',
        columns: ['Name', 'Roll No.', 'Email', 'Face Enrolled', 'Actions'],
      },
      employees: {
        title: 'Staff Roster',
        columns: ['Name', 'Role', 'Department'],
      },
      fees: {
        title: 'Fee Records',
        columns: ['Student', 'Total', 'Paid', 'Due Date'],
      },
      attendance: {
        title: 'Attendance Log',
        columns: ['Student', 'Date & Time', 'Status'],
      },
    };

    const cfg = tabConfig[activeTab];
    if (!cfg) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>{cfg.title}</h2>
          {activeTab === 'employees' && (
            <button
              className="btn-primary"
              onClick={() => setShowAddEmployee(!showAddEmployee)}
              style={{ fontSize: '0.875rem' }}
            >
              {showAddEmployee ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Employee</>}
            </button>
          )}
        </div>

        {/* Add Employee Form */}
        {activeTab === 'employees' && showAddEmployee && (
          <div className="glass-panel animate-fadeIn" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Create Employee Account</h3>
            <form
              onSubmit={handleCreateEmployee}
              autoComplete="off"
              className="emp-form-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Full Name</label>
                <input autoComplete="off" required className="input-field" placeholder="e.g. Dr. Sharma" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Username</label>
                <input autoComplete="new-password" required className="input-field" placeholder="login_id" type="text" value={empForm.username} onChange={e => setEmpForm({ ...empForm, username: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Department</label>
                <input autoComplete="off" required className="input-field" placeholder="e.g. Computer Science" value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Role / Designation</label>
                <input autoComplete="off" required className="input-field" placeholder="e.g. Professor" value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Salary (₹)</label>
                <input autoComplete="off" required className="input-field" placeholder="e.g. 85000" type="number" value={empForm.salary} onChange={e => setEmpForm({ ...empForm, salary: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Password</label>
                <input autoComplete="new-password" required className="input-field" placeholder="••••••••" type="password" value={empForm.password} onChange={e => setEmpForm({ ...empForm, password: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                Create Employee Account
              </button>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#8B949E' }}>
              <RefreshCw size={20} className="animate-spin" style={{ display: 'block', margin: '0 auto 10px auto' }} />
              Loading records…
            </div>
          ) : dataList.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#8B949E', fontSize: '0.9rem' }}>
              No records found.
            </div>
          ) : (
            <div className="table-scroll" style={{ borderRadius: 0, border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    {cfg.columns.map(col => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dataList.map((row, i) => (
                    <tr key={i}>
                      {activeTab === 'students' && (
                        <>
                          <td style={{ fontWeight: '600', color: '#E6EDF3' }}>{row.name}</td>
                          <td style={{ fontFamily: 'monospace', color: '#8B949E' }}>{row.rollNumber}</td>
                          <td style={{ color: '#8B949E', fontSize: '0.85rem' }}>{row.email}</td>
                          <td>
                            <span className={`badge ${row.registeredFace ? 'badge-success' : 'badge-danger'}`}>
                              {row.registeredFace ? '✓ Enrolled' : '✗ Not Set'}
                            </span>
                          </td>
                          <td>
                            {row.registeredFace && (
                              <button
                                onClick={() => handleResetFace(row._id)}
                                style={{
                                  padding: '5px 12px', background: 'rgba(248, 81, 73, 0.1)',
                                  color: '#F85149', border: '1px solid rgba(248, 81, 73, 0.3)',
                                  borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
                                  fontFamily: 'inherit', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248, 81, 73, 0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248, 81, 73, 0.1)'; }}
                              >
                                Reset Face
                              </button>
                            )}
                          </td>
                        </>
                      )}
                      {activeTab === 'employees' && (
                        <>
                          <td style={{ fontWeight: '600', color: '#E6EDF3' }}>{row.name}</td>
                          <td><span className="badge badge-primary">{row.role}</span></td>
                          <td style={{ color: '#8B949E' }}>{row.department}</td>
                        </>
                      )}
                      {activeTab === 'fees' && (
                        <>
                          <td style={{ fontWeight: '600', color: '#E6EDF3' }}>{row.student?.name} <span style={{ color: '#8B949E', fontWeight: 400 }}>({row.student?.rollNumber})</span></td>
                          <td style={{ fontWeight: '600' }}>₹{row.totalAmount?.toLocaleString()}</td>
                          <td style={{ color: '#3FB950', fontWeight: '600' }}>₹{row.paidAmount?.toLocaleString()}</td>
                          <td style={{ color: '#8B949E', fontSize: '0.85rem' }}>{new Date(row.dueDate).toLocaleDateString()}</td>
                        </>
                      )}
                      {activeTab === 'attendance' && (
                        <>
                          <td style={{ fontWeight: '600', color: '#E6EDF3' }}>{row.student?.name}</td>
                          <td style={{ color: '#8B949E', fontSize: '0.85rem', fontFamily: 'monospace' }}>{new Date(row.date).toLocaleString()}</td>
                          <td>
                            <span className={`badge ${row.status === 'Present' ? 'badge-success' : 'badge-danger'}`}>
                              {row.status}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabTitle = {
    metrics: 'Overview',
    exam: 'Exam Invigilation',
    students: 'Students',
    employees: 'Staff',
    fees: 'Fee Records',
    attendance: 'Attendance Log',
  }[activeTab] || activeTab;

  return (
    <div className="dashboard-layout">
      <Sidebar role="admin" activeTab={activeTab} setActiveTab={setActiveTab} name="Administrator" logout={logout} />

      <main className="dashboard-main">
        {/* Page Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="title">{tabTitle}</h1>
            <p className="subtitle">Smart Attendance & ERP Portal — Admin Console</p>
          </div>
        </div>

        <div className="animate-fadeIn">
          {activeTab === 'exam'    && <ExamProctoring />}
          {activeTab === 'metrics' && <MetricsView />}
          {['students', 'employees', 'fees', 'attendance'].includes(activeTab) && <DataView />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
