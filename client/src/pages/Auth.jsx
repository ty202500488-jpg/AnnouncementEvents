import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/Auth.css';

const collegeDepartments = {
  'College of Law (LAW)': 1,
  'College of Agriculture (COA)': 2,
  'College of Liberal Arts (CLA)': 3,
  'College of Architecture (COARCH)': 4,
  'College of Nursing (CN)': 5,
  'College of Asian & Islamic Studies (CAIS)': 6,
  'College of Computing Studies (CCS)': 7,
  'College of Forestry & Environmental Studies (CFES)': 8,
  'College of Criminal Justice Education (CCJE)': 9,
  'College of Home Economics (CHE)': 10,
  'College of Engineering (COE)': 11,
  'College of Medicine (CM)': 12,
  'College of Public Administration & Development Studies (CPADS)': 13,
  'College of Sports Science & Physical Education (CSSPE)': 14,
  'College of Science & Mathematics (CSM)': 15,
  'College of Social Work & Community Development (CSWCD)': 16,
  'College of Teacher Education (CTE)': 17
};

const collegeCourses = {
  LAW: [{ id: 1, name: 'BS Laws' }],
  COA: [
    { id: 2, name: 'BS Agriculture' },
    { id: 3, name: 'BS Food Technology' },
    { id: 4, name: 'BS Agribusiness' },
    { id: 5, name: 'Bachelor of Agricultural Technology' }
  ],
  CLA: [
    { id: 6, name: 'BS Accountancy' },
    { id: 7, name: 'BA History' },
    { id: 8, name: 'BA English' },
    { id: 9, name: 'BA Political Science' },
    { id: 10, name: 'BA Mass Communication – Journalism' },
    { id: 11, name: 'BA Mass Communication – Broadcasting' },
    { id: 12, name: 'BS Economics' },
    { id: 13, name: 'BS Psychology' }
  ],
  COARCH: [{ id: 14, name: 'BS Architecture' }],
  CN: [{ id: 15, name: 'BS Nursing' }],
  CAIS: [{ id: 16, name: 'Asian and Islamic Studies' }],
  CCS: [
    { id: 17, name: 'BS Computer Science (BSCS)' },
    { id: 18, name: 'BS Information Technology (BSIT)' },
    { id: 19, name: 'ACT AD' },
    { id: 20, name: 'ACT NT' }
  ],
  CFES: [
    { id: 21, name: 'BS Forestry' },
    { id: 22, name: 'BS Agroforestry' },
    { id: 23, name: 'BS Environmental Science' }
  ],
  CCJE: [{ id: 24, name: 'Criminal Justice Education' }],
  CHE: [
    { id: 25, name: 'BS Home Economics' },
    { id: 26, name: 'BS Nutrition & Dietetics' },
    { id: 27, name: 'BS Hospitality Management' }
  ],
  COE: [
    { id: 28, name: 'Agricultural and Biosystems Engineering' },
    { id: 29, name: 'BS Civil Engineering' },
    { id: 30, name: 'BS Computer Engineering' },
    { id: 31, name: 'BS Electrical Engineering' },
    { id: 32, name: 'BS Electronics Engineering' },
    { id: 33, name: 'BS Environmental Engineering' },
    { id: 34, name: 'BS Geodetic Engineering' },
    { id: 35, name: 'BS Industrial Engineering' },
    { id: 36, name: 'BS Mechanical Engineering' },
    { id: 37, name: 'BS Sanitary Engineering' }
  ],
  CM: [{ id: 38, name: 'Doctor of Medicine' }],
  CPADS: [{ id: 39, name: 'BS Public Administration' }],
  CSSPE: [
    { id: 40, name: 'BS Physical Education' },
    { id: 41, name: 'BS Exercise & Sports Sciences' }
  ],
  CSM: [
    { id: 42, name: 'BS Biology' },
    { id: 43, name: 'BS Chemistry' },
    { id: 44, name: 'BS Mathematics' },
    { id: 'CSM-4', name: 'BS Statistics' },
    { id: 45, name: 'BS Statistics' },
    { id: 46, name: 'BS Physics' }
  ],
  CSWCD: [
    { id: 47, name: 'BS Social Work' },
    { id: 48, name: 'BS Community Development' }
  ],
  CTE: [
    { id: 49, name: 'Bachelor of Culture and Arts Education' },
    { id: 50, name: 'Bachelor of Early Childhood Education' },
    { id: 51, name: 'Bachelor of Elementary Education' },
    { id: 52, name: 'Bachelor of Secondary Education – English' },
    { id: 53, name: 'Bachelor of Secondary Education – Filipino' },
    { id: 54, name: 'Bachelor of Secondary Education – Mathematics' },
    { id: 55, name: 'Bachelor of Secondary Education – Sciences' },
    { id: 56, name: 'Bachelor of Secondary Education – Social Studies' },
    { id: 57, name: 'Bachelor of Secondary Education – Values Education' },
    { id: 58, name: 'Bachelor of Special Needs Education' }
  ]
};

export default function Auth() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);
  
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState({
    studentId: '', 
    firstName: '', 
    middleInitial: '', 
    lastName: '',
    departmentId: '', 
    programId: '', 
    yearLevel: '', 
    email: '', 
    password: '', 
    confirmPassword: '', 
    termsAccepted: false
  });

  const handleCollegeChange = (e) => {
    const collegeKey = e.target.value;
    setSelectedCollege(collegeKey);
    const deptId = collegeDepartments[collegeKey];
    
    const match = collegeKey.match(/\(([^)]+)\)/);
    const courseKey = match ? match[1] : '';

    setRegData({ ...regData, departmentId: deptId, programId: '' });
    setAvailableCourses(collegeCourses[courseKey] || []);
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
        localStorage.setItem('user', JSON.stringify(data.user));
        
        const roleName = data.user?.role_name?.toLowerCase() || '';
        const role = Number(
          data.user?.role_id ?? 
          data.user?.user_roles ?? 
          data.user?.role ?? 
          3
        );

        if (roleName === 'admin' || role === 1) {
          navigate('/admin/dashboard');
        } else if (roleName === 'staff' || role === 2) {
          navigate('/staff/dashboard');
        } else {
          navigate('/student/dashboard');
        }
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Backend connection error:', err);
      alert('Could not connect to the backend server.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (regData.password !== regData.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    if (regData.password.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    if (!regData.termsAccepted) {
      alert('You must accept the Terms and Conditions.');
      return;
    }
    
    const payload = {
      student_id: regData.studentId.trim(),
      first_name: regData.firstName.trim(),
      middle_initial: regData.middleInitial ? regData.middleInitial.trim() : null,
      last_name: regData.lastName.trim(),
      department_id: Number(regData.departmentId),
      program_id: regData.programId ? Number(regData.programId) : null,
      year_level: regData.yearLevel, 
      email: regData.email.trim().toLowerCase(),
      password: regData.password,
      confirm_password: regData.confirmPassword,
      terms_accepted: regData.termsAccepted
    };

    let response;
    try {
      response = await fetch('http://localhost:5000/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Backend connection error:', err);
      alert('Could not reach the backend server. Make sure it is running at http://localhost:5000.');
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.error('Invalid registration API response:', err);
      alert('The backend returned an invalid response. Check the server terminal for errors.');
      return;
    }

    if (response.ok) {
      alert(data.message || 'Student account created successfully!');
      setActiveTab('login');
    } else {
      alert(data.message || 'Registration failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
                <label className="form-label">Email</label>
                <div className="input-container">
                  <input 
                    type="email" 
                    placeholder="username@wmsu.edu.ph" 
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label className="form-label">Password</label>
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
                <label className="form-label" >Student ID</label>
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
                  <label className="form-label">First Name</label>
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
                  <label className="form-label">Middle Initial</label>
                  <div className="input-container">
                    <input 
                      type="text" 
                      placeholder="M" 
                      maxLength="5" 
                      value={regData.middleInitial}
                      onChange={(e) => setRegData({ ...regData, middleInitial: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
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
                <label className="form-label">College / Department</label>
                <div className="input-container select-container">
                  <select value={selectedCollege} onChange={handleCollegeChange} required>
                    <option value="" disabled>Select Department</option>
                    {Object.keys(collegeDepartments).map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label className="form-label">Program / Course</label>
                  <div className="input-container select-container">
                    <select 
                      value={regData.programId} 
                      onChange={(e) => setRegData({ ...regData, programId: e.target.value })} 
                      disabled={!selectedCollege}
                    >
                      <option value="" disabled>{selectedCollege ? 'Select Course (Optional)' : 'Select Department First'}</option>
                      {availableCourses.map((course) => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Year Level</label>
                  <div className="input-container select-container">
                    <select 
                      value={regData.yearLevel} 
                      onChange={(e) => setRegData({ ...regData, yearLevel: e.target.value })} 
                      required
                    >
                      <option value="" disabled>Select Year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="5th Year">5th Year</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section-title">Account Credentials</div>

              <div className="form-group">
                <label className="form-label">WMSU Email</label>
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
                  <label className="form-label">Password</label>
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
                  <label className="form-label">Confirm Password</label>
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

              <div className="form-options">
                <label className="remember-me">
                  <input 
                    type="checkbox" 
                    checked={regData.termsAccepted}
                    onChange={(e) => setRegData({ ...regData, termsAccepted: e.target.checked })}
                    required 
                  />
                  <span className="custom-checkbox"></span>
                  I agree to the <a href="#" className="inline-link">Terms & Conditions</a>
                </label>
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