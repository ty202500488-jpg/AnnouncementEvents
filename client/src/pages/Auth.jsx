import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/Auth.css';

const collegeCourses = {
  LAW: ['BS Laws'],
  COA: ['BS Agriculture', 'BS Food Technology', 'BS Agribusiness', 'Bachelor of Agricultural Technology'],
  CLA: ['BS Accountancy', 'BA History', 'BA English', 'BA Political Science', 'BA Mass Communication – Journalism', 'BA Mass Communication – Broadcasting', 'BS Economics', 'BS Psychology'],
  COARCH: ['BS Architecture'],
  CN: ['BS Nursing'],
  CAIS: ['Asian and Islamic Studies'],
  CCS: ['BS Computer Science (BSCS)', 'BS Information Technology (BSIT)', 'ACT AD', 'ACT NT'],
  CFES: ['BS Forestry', 'BS Agroforestry', 'BS Environmental Science'],
  CCJE: ['Criminal Justice Education'],
  CHE: ['BS Home Economics', 'BS Nutrition & Dietetics', 'BS Hospitality Management'],
  COE: ['Agricultural and Biosystems Engineering', 'BS Civil Engineering', 'BS Computer Engineering', 'BS Electrical Engineering', 'BS Electronics Engineering', 'BS Environmental Engineering', 'BS Geodetic Engineering', 'BS Industrial Engineering', 'BS Mechanical Engineering', 'BS Sanitary Engineering'],
  CM: ['Doctor of Medicine'],
  CPADS: ['BS Public Administration'],
  CSSPE: ['BS Physical Education', 'BS Exercise & Sports Sciences'],
  CSM: ['BS Biology', 'BS Chemistry', 'BS Mathematics', 'BS Statistics', 'BS Physics'],
  CSWCD: ['BS Social Work', 'BS Community Development'],
  CTE: [
    'Bachelor of Culture and Arts Education', 'Bachelor of Early Childhood Education', 'Bachelor of Elementary Education',
    'Bachelor of Secondary Education – English', 'Bachelor of Secondary Education – Filipino', 'Bachelor of Secondary Education – Mathematics',
    'Bachelor of Secondary Education – Sciences', 'Bachelor of Secondary Education – Social Studies', 'Bachelor of Secondary Education – Values Education',
    'Bachelor of Special Needs Education'
  ]
};

export default function Auth() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);
  
  // Visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState({
    studentId: '', firstName: '', middleName: '', lastName: '',
    college: '', program: '', yearLevel: '', email: '', password: '', confirmPassword: ''
  });

  const handleCollegeChange = (e) => {
    const college = e.target.value;
    setSelectedCollege(college);
    setRegData({ ...regData, college, program: '' });
    setAvailableCourses(collegeCourses[college] || []);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        if (data.role === 'staff') navigate('/staff/dashboard');
        else if (data.role === 'admin') navigate('/admin/dashboard');
        else navigate('/student/dashboard');
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Backend connection error:', err);
      alert('Could not connect to the backend server. Make sure node index.js is running.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regData.password !== regData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });
      const data = await response.json();
      if (response.ok) {
        alert('Account created successfully! Please sign in.');
        setActiveTab('login');
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Backend connection error:', err);
      alert('Could not connect to the backend server.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Background Blobs */}
      <div className="interactive-bg">
        <div className="bg-blob blob-left-deep float-anim-2"></div>
        <div className="bg-blob blob-scatter-left-mid float-anim-3"></div>
        <div className="bg-blob blob-right-deep float-anim-1"></div>
        <div className="bg-blob blob-scatter-right-mid float-anim-4"></div>
        <div className="bg-blob blob-3 float-anim-3"></div>
        <div className="bg-blob blob-scatter-1 float-anim-4"></div>
        <div className="bg-blob blob-scatter-2 float-anim-1"></div>
        <div className="bg-blob blob-scatter-3 float-anim-2"></div>
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`star-blob star-${i + 1}`}></div>
        ))}
      </div>

      <main className="login-wrapper">
        <div className={`login-card-wrapper ${activeTab === 'register' ? 'wide-mode' : ''}`}>
          <div className="card-glow-bg"></div>

          <div className="login-card">
            <div className="login-header">
              <h2 className="shimmer-glow-text">
                {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p>
                {activeTab === 'login' 
                  ? 'Access your campus portal and stay connected' 
                  : 'Register to unlock campus resources and tools'}
              </p>
            </div>

            <div className="auth-tabs">
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`} 
                onClick={() => setActiveTab('login')}
              >
                Sign In
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`} 
                onClick={() => setActiveTab('register')}
              >
                Register
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className={`auth-form ${activeTab === 'login' ? 'active' : ''}`}>
              <div className="form-group">
                <label>Email</label>
                <div className="input-container">
                  <input 
                    type="text" 
                    placeholder="username@wmsu.edu.ph" 
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label>Password</label>
                  <a href="#forgot" className="forgot-link">Forgot password?</a>
                </div>
                <div className="input-container password-container">
                  <input 
                    type={showLoginPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required 
                  />
                  <button 
                    type="button" 
                    className={`toggle-password-btn ${showLoginPassword ? 'visible' : ''}`} 
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                  >
                    <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <svg className="eye-off-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary btn-block">Sign In</button>
            </form>

            {/* Register Form */}
            <form onSubmit={handleRegisterSubmit} className={`auth-form ${activeTab === 'register' ? 'active' : ''}`}>
              <div className="form-section-title">Personal Information</div>

              <div className="form-group">
                <label>Student ID</label>
                <div className="input-container">
                  <input 
                    type="text" 
                    placeholder="e.g., 2024-01234" 
                    value={regData.studentId}
                    onChange={(e) => setRegData({ ...regData, studentId: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div className="form-row three-cols">
                <div className="form-group">
                  <label>First Name</label>
                  <div className="input-container">
                    <input 
                      type="text" 
                      placeholder="First Name" 
                      value={regData.firstName}
                      onChange={(e) => setRegData({ ...regData, firstName: e.target.value })}
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Middle Name</label>
                  <div className="input-container">
                    <input 
                      type="text" 
                      placeholder="Middle Name" 
                      value={regData.middleName}
                      onChange={(e) => setRegData({ ...regData, middleName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <div className="input-container">
                    <input 
                      type="text" 
                      placeholder="Last Name" 
                      value={regData.lastName}
                      onChange={(e) => setRegData({ ...regData, lastName: e.target.value })}
                      required 
                    />
                  </div>
                </div>
              </div>

              <div className="form-section-title">Academic Details</div>

              <div className="form-group">
                <label>College / Department</label>
                <div className="input-container select-container">
                  <select value={selectedCollege} onChange={handleCollegeChange} required>
                    <option value="" disabled>Select Department</option>
                    {Object.keys(collegeCourses).map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Program / Course</label>
                  <div className="input-container select-container">
                    <select 
                      value={regData.program} 
                      onChange={(e) => setRegData({ ...regData, program: e.target.value })} 
                      required 
                      disabled={!selectedCollege}
                    >
                      <option value="" disabled>{selectedCollege ? 'Select Course' : 'Select Department First'}</option>
                      {availableCourses.map((course) => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Year Level</label>
                  <div className="input-container select-container">
                    <select 
                      value={regData.yearLevel} 
                      onChange={(e) => setRegData({ ...regData, yearLevel: e.target.value })} 
                      required
                    >
                      <option value="" disabled>Select Year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="5">5th Year+</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section-title">Account Credentials</div>

              <div className="form-group">
                <label>WMSU Email</label>
                <div className="input-container">
                  <input 
                    type="email" 
                    placeholder="username@wmsu.edu.ph" 
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Password</label>
                  <div className="input-container password-container">
                    <input 
                      type={showRegPassword ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={regData.password}
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                      required 
                    />
                    <button 
                      type="button" 
                      className={`toggle-password-btn ${showRegPassword ? 'visible' : ''}`} 
                      onClick={() => setShowRegPassword(!showRegPassword)}
                    >
                      <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      <svg className="eye-off-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <div className="input-container password-container">
                    <input 
                      type={showRegConfirmPassword ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={regData.confirmPassword}
                      onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                      required 
                    />
                    <button 
                      type="button" 
                      className={`toggle-password-btn ${showRegConfirmPassword ? 'visible' : ''}`} 
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    >
                      <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      <svg className="eye-off-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-primary btn-block">Create Account</button>
            </form>

            <div className="login-footer">
              <p>Protected by CampusHub Identity System</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}