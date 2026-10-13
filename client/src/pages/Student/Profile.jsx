import { useState, useEffect } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';
import '../styles/Profile.css';

export default function Profile() {
  const [user, setUser] = useState({
    firstName: 'Alex',
    lastName: 'Rivera',
    program: 'BS Computer Science',
    email: 'alex.rivera@wmsu.edu.ph',
    studentId: '2025-01428',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...user });
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const initialData = {
          firstName: parsed.first_name || 'Alex',
          lastName: parsed.last_name || 'Rivera',
          program: parsed.program_name || 'BS Computer Science',
          email: parsed.email || 'alex.rivera@wmsu.edu.ph',
          studentId: parsed.student_id || '2025-01428',
        };
        setUser(initialData);
        setFormData(initialData);
      } catch (err) {
        console.error('Failed to parse user from localStorage', err);
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setUser(formData);
    setIsEditing(false);
    
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = {
        ...storedUser,
        first_name: formData.firstName,
        last_name: formData.lastName,
        program_name: formData.program,
        email: formData.email,
        student_id: formData.studentId,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSaveMessage('Profile successfully updated!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save user to localStorage', err);
    }
  };

  return (
    <DashboardLayout activePage="profile">
      {/* ==================== CENTER MAIN CONTENT (PROFILE MANAGEMENT) ==================== */}
      <main className="lg-col-6 space-y-6">
        {saveMessage && (
          <div className="alert-success">
            <i className="fa-solid fa-circle-check"></i>
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Profile Banner Card */}
        <div className="card profile-banner-card">
          <div className="profile-cover-bg"></div>
          <div className="profile-header-content">
            <div className="profile-avatar-container">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" 
                alt={`${user.firstName} ${user.lastName}`} 
                className="profile-large-avatar"
                onError={(e) => { e.target.src = 'https://placehold.co/150x150/2563eb/ffffff?text=AR'; }}
              />
              <button className="avatar-edit-btn" title="Change Avatar">
                <i className="fa-solid fa-camera"></i>
              </button>
            </div>
            <div className="profile-header-text">
              <h2>{user.firstName} {user.lastName}</h2>
              <p className="profile-program-tag">{user.program}</p>
              <p className="profile-institution">Western Mindanao State University • Student ID: {user.studentId}</p>
            </div>
          </div>
        </div>

        {/* Profile Details & Form Card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Personal Information</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Manage your account details and academic profile settings.</p>
            </div>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="edit-profile-btn">
                <i className="fa-solid fa-pen-to-square"></i>
                <span>Edit Profile</span>
              </button>
            ) : (
              <button onClick={() => { setIsEditing(false); setFormData(user); }} className="cancel-profile-btn">
                Cancel
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="profile-details-grid">
              <div className="detail-item">
                <span className="detail-label">First Name</span>
                <span className="detail-value">{user.firstName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Last Name</span>
                <span className="detail-value">{user.lastName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email Address</span>
                <span className="detail-value">{user.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Student ID</span>
                <span className="detail-value">{user.studentId}</span>
              </div>
              <div className="detail-item full-span">
                <span className="detail-label">Program / Department</span>
                <span className="detail-value">{user.program}</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="profile-form space-y-4">
              <div className="form-grid">
                <div className="form-group">
                  <label>First Name</label>
                  <input 
                    type="text" 
                    name="firstName" 
                    value={formData.firstName} 
                    onChange={handleChange} 
                    className="form-input" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input 
                    type="text" 
                    name="lastName" 
                    value={formData.lastName} 
                    onChange={handleChange} 
                    className="form-input" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    className="form-input" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Student ID</label>
                  <input 
                    type="text" 
                    name="studentId" 
                    value={formData.studentId} 
                    onChange={handleChange} 
                    className="form-input" 
                    required 
                  />
                </div>
                <div className="form-group full-span">
                  <label>Program / Department</label>
                  <input 
                    type="text" 
                    name="program" 
                    value={formData.program} 
                    onChange={handleChange} 
                    className="form-input" 
                    required 
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3" style={{ marginTop: '1.5rem' }}>
                <button type="button" onClick={() => { setIsEditing(false); setFormData(user); }} className="cancel-profile-btn">
                  Cancel
                </button>
                <button type="submit" className="save-profile-btn">
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}