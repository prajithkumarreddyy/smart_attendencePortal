import React, { useState, useEffect } from 'react';
import { LogOut, Users, Briefcase, DollarSign, CheckSquare } from 'lucide-react';
import api from '../api';
import Sidebar from '../components/Sidebar';

const AdminDashboard = ({ admin, setAdmin }) => {
  const [activeTab, setActiveTab] = useState('metrics'); // metrics, students, employees, fees, attendance
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
      if (!window.confirm("Are you sure you want to completely erase and unlock this student's face biometric data?")) return;
      try {
          await api.put(`/admin/students/${studentId}/reset-face`);
          fetchData(activeTab);
      } catch (err) {
          alert("Failed to reset face data: " + (err.response?.data?.message || err.message));
      }
  };

  const fetchData = async (endpoint, silent = false) => {
      if (!silent) setLoading(true);
      try {
          // Token is automatically injected by global api.js intereceptor now
          const res = await api.get(`/admin/${endpoint}`);
          if (endpoint === 'metrics') setMetrics(res.data);
          else setDataList(res.data);
      } catch (err) {
          console.error("Failed fetching", err);
      } finally {
          if (!silent) setLoading(false);
      }
  };

  useEffect(() => {
      fetchData(activeTab);
      const interval = setInterval(() => fetchData(activeTab, true), 3000);
      return () => clearInterval(interval);
  }, [activeTab]);

  const logout = () => {
      localStorage.removeItem('token');
      setAdmin(null);
  };

  const navItems = [
      { id: 'metrics', label: 'Overview', icon: DollarSign },
      { id: 'employees', label: 'Employees', icon: Briefcase },
      { id: 'students', label: 'Students', icon: Users },
      { id: 'fees', label: 'Fee Records', icon: DollarSign },
      { id: 'attendance', label: 'Attendance', icon: CheckSquare }
  ];

  return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>
          <Sidebar role="admin" activeTab={activeTab} setActiveTab={setActiveTab} name="Administrator" logout={logout} />

          {/* Main Content */}
          <main style={{ flex: 1, padding: '2rem 4rem', overflowY: 'auto' }}>
              <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>
                  {navItems.find(i => i.id === activeTab).label}
              </h1>

              {activeTab === 'metrics' && metrics && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                          <Users size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                          <h3 style={{ fontSize: '2rem', margin: 0 }}>{metrics.students}</h3>
                          <p style={{ color: 'var(--text-muted)' }}>Registered Students</p>
                      </div>
                      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                          <Briefcase size={32} color="#10b981" style={{ marginBottom: '1rem' }} />
                          <h3 style={{ fontSize: '2rem', margin: 0 }}>{metrics.employees}</h3>
                          <p style={{ color: 'var(--text-muted)' }}>Active Employees</p>
                      </div>
                      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                          <DollarSign size={32} color="#f59e0b" style={{ marginBottom: '1rem' }} />
                          <h3 style={{ fontSize: '2rem', margin: 0 }}>${metrics.totalFeesCollected}</h3>
                          <p style={{ color: 'var(--text-muted)' }}>Fees Collected</p>
                      </div>
                  </div>
              )}

              {activeTab !== 'metrics' && (
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                      
                      {activeTab === 'employees' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                              <button className="btn-primary" onClick={() => setShowAddEmployee(!showAddEmployee)}>
                                  {showAddEmployee ? 'Cancel' : '+ New Employee'}
                              </button>
                          </div>
                      )}

                      {activeTab === 'employees' && showAddEmployee && (
                          <form onSubmit={handleCreateEmployee} autoComplete="off" style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                              <input autoComplete="off" required className="input-field" placeholder="Name" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} />
                              <input autoComplete="new-password" required className="input-field" placeholder="Username" type="text" value={empForm.username} onChange={e => setEmpForm({...empForm, username: e.target.value})} />
                              <input autoComplete="off" required className="input-field" placeholder="Department" value={empForm.department} onChange={e => setEmpForm({...empForm, department: e.target.value})} />
                              <input autoComplete="off" required className="input-field" placeholder="Role (e.g. Professor)" value={empForm.role} onChange={e => setEmpForm({...empForm, role: e.target.value})} />
                              <input autoComplete="off" required className="input-field" placeholder="Salary" type="number" value={empForm.salary} onChange={e => setEmpForm({...empForm, salary: e.target.value})} />
                              <input autoComplete="new-password" required className="input-field" placeholder="Password" type="password" value={empForm.password} onChange={e => setEmpForm({...empForm, password: e.target.value})} />
                              <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>Create Credentials</button>
                          </form>
                      )}

                      {loading ? (
                          <p style={{ color: 'var(--text-muted)' }}>Loading records...</p>
                      ) : dataList.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)' }}>No records found.</p>
                      ) : (
                          <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                                  <thead>
                                      <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                          {activeTab === 'students' && (
                                              <><th style={{ padding: '1rem' }}>Name</th><th style={{ padding: '1rem' }}>Roll No</th><th style={{ padding: '1rem' }}>Email</th><th style={{ padding: '1rem' }}>Face Configured</th><th style={{ padding: '1rem', width: '100px' }}>Actions</th></>
                                          )}
                                          {activeTab === 'employees' && (
                                              <><th style={{ padding: '1rem' }}>Name</th><th style={{ padding: '1rem' }}>Role</th><th style={{ padding: '1rem' }}>Department</th></>
                                          )}
                                          {activeTab === 'fees' && (
                                              <><th style={{ padding: '1rem' }}>Student</th><th style={{ padding: '1rem' }}>Total</th><th style={{ padding: '1rem' }}>Paid</th><th style={{ padding: '1rem' }}>Due Date</th></>
                                          )}
                                          {activeTab === 'attendance' && (
                                              <><th style={{ padding: '1rem' }}>Student</th><th style={{ padding: '1rem' }}>Date</th><th style={{ padding: '1rem' }}>Status</th></>
                                          )}
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {dataList.map((row, i) => (
                                          <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                              {activeTab === 'students' && (
                                                  <><td style={{ padding: '1rem' }}>{row.name}</td><td style={{ padding: '1rem' }}>{row.rollNumber}</td><td style={{ padding: '1rem' }}>{row.email}</td><td style={{ padding: '1rem' }}>{row.registeredFace ? 'Yes' : 'No'}</td><td style={{ padding: '1rem' }}>
                                                      {row.registeredFace && (
                                                          <button onClick={() => handleResetFace(row._id)} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Reset Face</button>
                                                      )}
                                                  </td></>
                                              )}
                                              {activeTab === 'employees' && (
                                                  <><td style={{ padding: '1rem' }}>{row.name}</td><td style={{ padding: '1rem' }}>{row.role}</td><td style={{ padding: '1rem' }}>{row.department}</td></>
                                              )}
                                              {activeTab === 'fees' && (
                                                  <><td style={{ padding: '1rem' }}>{row.student?.name} ({row.student?.rollNumber})</td><td style={{ padding: '1rem' }}>${row.totalAmount}</td><td style={{ padding: '1rem' }}>${row.paidAmount}</td><td style={{ padding: '1rem' }}>{new Date(row.dueDate).toLocaleDateString()}</td></>
                                              )}
                                              {activeTab === 'attendance' && (
                                                  <><td style={{ padding: '1rem' }}>{row.student?.name}</td><td style={{ padding: '1rem' }}>{new Date(row.date).toLocaleString()}</td><td style={{ padding: '1rem' }}>
                                                      <span style={{ background: row.status === 'Present' ? 'var(--success)' : 'var(--danger)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', color: 'black' }}>{row.status}</span>
                                                  </td></>
                                              )}
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              )}
          </main>
      </div>
  );
};

export default AdminDashboard;
