import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pages/styles/Auth.css';

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

const INITIAL_REG_DATA = {
  studentId: '',
  firstName: '',
  middleInitial: '',
  lastName: '',
  departmentId: '',
  programId: '',
  yearLevel: '',
  corPhoto: '',
  studentIdPhoto: '',
  email: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false
};

export default function Auth() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);
  
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
    onConfirm: null
  });

  const showAlert = (title, message, type = 'error', onConfirm = null) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
      onConfirm
    });
  };

  const closeModal = () => {
    if (modalConfig.onConfirm) {
      modalConfig.onConfirm();
    }
    setModalConfig({ isOpen: false, title: '', message: '', type: 'error', onConfirm: null });
  };

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState(INITIAL_REG_DATA);

  const [regStep, setRegStep] = useState(1); // 1 | 2 | 3 | 4 | 'awaiting_confirmation'
  const [activeCameraTarget, setActiveCameraTarget] = useState(null); // null | 'cor' | 'id'
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActiveCameraTarget(null);
    setCameraLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (activeCameraTarget && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [activeCameraTarget]);

  const startCamera = async (target, preferredFacingMode = cameraFacingMode) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showAlert(
        'Camera Unavailable',
        'Your browser does not support live camera access. Please allow camera permissions or use a supported browser.',
        'error'
      );
      return;
    }

    stopCameraStream();
    setCameraLoading(true);
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: preferredFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setActiveCameraTarget(target);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera access error:', err);
      showAlert(
        'Camera Permission Needed',
        'Could not access your camera. Please grant camera permissions in your browser and ensure no other app is using it.',
        'error'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      showAlert('Camera Not Ready', 'Please wait for the live camera preview to load before capturing.', 'warning');
      return;
    }

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (activeCameraTarget === 'cor') {
      setRegData((prev) => ({ ...prev, corPhoto: dataUrl }));
    } else if (activeCameraTarget === 'id') {
      setRegData((prev) => ({ ...prev, studentIdPhoto: dataUrl }));
    }
    stopCameraStream();
  };

  const flipCamera = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
    if (activeCameraTarget) {
      startCamera(activeCameraTarget, nextMode);
    }
  };

  const handleTabSwitch = (tab) => {
    if (tab !== 'register') {
      stopCameraStream();
    }
    setActiveTab(tab);
  };

  const resetRegistrationFlow = useCallback(() => {
    stopCameraStream();
    setRegData(INITIAL_REG_DATA);
    setSelectedCollege('');
    setAvailableCourses([]);
    setRegStep(1);
  }, [stopCameraStream]);

  useEffect(() => {
    if (activeTab !== 'register' || regStep !== 'awaiting_confirmation') return;
    const email = regData.email.trim().toLowerCase();
    if (!email) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/users/verification-status?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.is_email_verified) {
          setLoginData((prev) => ({ ...prev, email }));
          resetRegistrationFlow();
          setActiveTab('login');
          showAlert(
            'Email Confirmed!',
            'Your WMSU Gmail address has been verified. You can now sign in to your account.',
            'success'
          );
        }
      } catch (_) {
        // Ignore transient polling errors
      }
    };

    const intervalId = setInterval(pollStatus, 4000);
    return () => clearInterval(intervalId);
  }, [activeTab, regStep, regData.email, resetRegistrationFlow]);

  const handleNextStep = () => {
    if (regStep === 1) {
      if (!regData.studentId.trim() || !regData.firstName.trim() || !regData.lastName.trim()) {
        showAlert('Required Fields', 'Please enter your Student ID, First Name, and Last Name to continue.', 'warning');
        return;
      }
      setRegStep(2);
      return;
    }
    if (regStep === 2) {
      if (!regData.departmentId || !regData.programId || !regData.yearLevel) {
        showAlert('Academic Details Required', 'Please select your College Department, Program/Course, and Year Level.', 'warning');
        return;
      }
      setRegStep(3);
      return;
    }
    if (regStep === 3) {
      if (!regData.corPhoto || !regData.studentIdPhoto) {
        showAlert(
          'Photos Required',
          'Please take live camera photos of both your Certificate of Registration (COR) and WMSU Student ID.',
          'warning'
        );
        return;
      }
      stopCameraStream();
      setRegStep(4);
    }
  };

  const handlePrevStep = () => {
    stopCameraStream();
    if (typeof regStep === 'number' && regStep > 1) {
      setRegStep(regStep - 1);
    }
  };

  const handleResendConfirmation = async () => {
    const email = regData.email.trim().toLowerCase();
    if (!email) return;
    setResendingEmail(true);
    try {
      const response = await fetch('http://localhost:5000/api/users/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        if (data.alreadyVerified) {
          setLoginData((prev) => ({ ...prev, email }));
          resetRegistrationFlow();
          setActiveTab('login');
          showAlert('Already Confirmed', data.message, 'success');
        } else {
          showAlert('Email Sent', data.message || 'Confirmation email resent to your Gmail.', 'success');
        }
      } else {
        showAlert('Resend Failed', data.message || 'Could not resend confirmation email.', 'error');
      }
    } catch (err) {
      console.error('Resend error:', err);
      showAlert('Network Error', 'Could not reach the server to resend the confirmation email.', 'error');
    } finally {
      setResendingEmail(false);
    }
  };

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
      const response = await fetch('http://localhost:5000/api/users/login', {
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

        // Direct navigation without confirmation modal
        if (roleName === 'admin' || role === 1) {
          navigate('/admin/dashboard');
        } else if (roleName === 'staff' || role === 2) {
          navigate('/staff/dashboard');
        } else {
          navigate('/student/dashboard');
        }
      } else {
        showAlert('Authentication Failed', data.message || 'Incorrect email or password. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Backend connection error:', err);
      showAlert('Connection Error', 'Could not connect to the backend server. Make sure localhost:5000 is running.', 'error');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (regStep !== 4) return;

    const normalizedEmail = regData.email.trim().toLowerCase();
    if (!/^[^\s@]+@wmsu\.edu\.ph$/.test(normalizedEmail)) {
      showAlert('Invalid Email', 'Please use a valid @wmsu.edu.ph email address.', 'warning');
      return;
    }
    if (regData.password !== regData.confirmPassword) {
      showAlert('Password Mismatch', 'Passwords do not match. Please verify both fields.', 'warning');
      return;
    }
    if (regData.password.length < 8) {
      showAlert('Weak Password', 'Password must be at least 8 characters long.', 'warning');
      return;
    }
    if (!regData.termsAccepted) {
      showAlert('Terms Required', 'You must agree to the Terms & Conditions before registering.', 'warning');
      return;
    }
    if (!regData.corPhoto || !regData.studentIdPhoto) {
      showAlert('Photos Required', 'Please capture live photos of both your COR and Student ID.', 'warning');
      setRegStep(3);
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
      cor_photo: regData.corPhoto,
      student_id_photo: regData.studentIdPhoto,
      email: normalizedEmail,
      password: regData.password,
      confirm_password: regData.confirmPassword,
      terms_accepted: regData.termsAccepted
    };

    setSubmittingReg(true);
    let response;
    try {
      response = await fetch('http://localhost:5000/api/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Backend connection error:', err);
      setSubmittingReg(false);
      showAlert('Network Error', 'Could not reach the backend server at http://localhost:5000.', 'error');
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.error('Invalid registration API response:', err);
      setSubmittingReg(false);
      showAlert('Server Error', 'The server returned an invalid response structure.', 'error');
      return;
    }

    setSubmittingReg(false);
    if (response.ok) {
      stopCameraStream();
      setRegStep('awaiting_confirmation');
    } else {
      showAlert('Registration Failed', data.message || 'Registration could not be completed.', 'error');
    }
  };

  return (
    <div className="auth-page-root">
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
                onClick={() => handleTabSwitch('login')}
              >
                Sign In
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`} 
                onClick={() => handleTabSwitch('register')}
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

              <button type="submit" className="btn-auth-submit btn-block">Sign In</button>
            </form>

            {/* Register Form */}
            <form onSubmit={handleRegisterSubmit} className={`auth-form ${activeTab === 'register' ? 'active' : ''}`}>
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {regStep !== 'awaiting_confirmation' && (
                <div className="reg-stepper" aria-label="Registration Steps">
                  {[
                    { step: 1, label: 'Personal' },
                    { step: 2, label: 'Academic' },
                    { step: 3, label: 'COR & ID' },
                    { step: 4, label: 'Account' }
                  ].map((item) => {
                    const isCompleted = typeof regStep === 'number' && regStep > item.step;
                    const isCurrent = regStep === item.step;
                    return (
                      <div
                        key={item.step}
                        className={`reg-step-pill ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                      >
                        <span className="reg-step-num">{isCompleted ? '✓' : item.step}</span>
                        <span className="reg-step-label">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* STEP 1: PERSONAL INFORMATION */}
              {regStep === 1 && (
                <div className="reg-step-panel">
                  <div className="form-section-title">Step 1 — Personal Information</div>

                  <div className="form-group">
                    <label className="form-label">Student ID</label>
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

                  <div className="form-row grid-name-row">
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
                      <label className="form-label">
                        M.I. <span className="optional-tag">(Optional)</span>
                      </label>
                      <div className="input-container">
                        <input
                          type="text"
                          placeholder="M."
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

                  <button type="button" className="btn-auth-submit btn-block" onClick={handleNextStep}>
                    Next
                  </button>
                </div>
              )}

              {/* STEP 2: ACADEMIC DETAILS */}
              {regStep === 2 && (
                <div className="reg-step-panel">
                  <div className="form-section-title">Step 2 — Academic Details</div>

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
                          required
                        >
                          <option value="" disabled>{selectedCollege ? 'Select Course' : 'Select Dept First'}</option>
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

                  <div className="step-actions-row">
                    <button type="button" className="btn-auth-secondary" onClick={handlePrevStep}>
                      Back
                    </button>
                    <button type="button" className="btn-auth-submit" onClick={handleNextStep}>
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: COR & STUDENT ID LIVE CAMERA CAPTURE */}
              {regStep === 3 && (
                <div className="reg-step-panel">
                  <div className="form-section-title">Step 3 — Capture COR &amp; Student ID</div>
                  <p className="step-helper-text">
                    Use your live camera to take clear photos of your Certificate of Registration (COR) and WMSU Student ID. Photos are stored securely inside the database.
                  </p>

                  {activeCameraTarget && (
                    <div className="camera-viewfinder">
                      <div className="camera-viewfinder-header">
                        <span>
                          Live Camera — {activeCameraTarget === 'cor' ? 'Certificate of Registration (COR)' : 'WMSU Student ID'}
                        </span>
                      </div>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="camera-video-el"
                      />
                      <div className="camera-controls-bar">
                        <button type="button" className="btn-auth-secondary btn-compact" onClick={flipCamera}>
                          Flip Camera
                        </button>
                        <button type="button" className="btn-auth-submit btn-compact" onClick={capturePhoto}>
                          Capture Photo
                        </button>
                        <button type="button" className="btn-auth-secondary btn-compact" onClick={stopCameraStream}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="camera-capture-grid">
                    {/* COR Capture Card */}
                    <div className={`camera-doc-card ${regData.corPhoto ? 'captured' : ''}`}>
                      <div className="camera-doc-title">Certificate of Registration (COR)</div>
                      {regData.corPhoto ? (
                        <div className="captured-preview-wrap">
                          <img src={regData.corPhoto} alt="Captured COR" className="captured-preview-img" />
                          <button
                            type="button"
                            className="btn-auth-secondary btn-compact btn-block"
                            onClick={() => startCamera('cor')}
                            disabled={cameraLoading}
                          >
                            Retake COR Photo
                          </button>
                        </div>
                      ) : (
                        <div className="camera-empty-state">
                          <svg className="camera-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                          <span className="camera-empty-hint">Live photo required</span>
                          <button
                            type="button"
                            className="btn-auth-submit btn-compact btn-block"
                            onClick={() => startCamera('cor')}
                            disabled={cameraLoading}
                          >
                            {cameraLoading ? 'Starting Camera...' : 'Open Camera'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Student ID Capture Card */}
                    <div className={`camera-doc-card ${regData.studentIdPhoto ? 'captured' : ''}`}>
                      <div className="camera-doc-title">WMSU Student ID</div>
                      {regData.studentIdPhoto ? (
                        <div className="captured-preview-wrap">
                          <img src={regData.studentIdPhoto} alt="Captured Student ID" className="captured-preview-img" />
                          <button
                            type="button"
                            className="btn-auth-secondary btn-compact btn-block"
                            onClick={() => startCamera('id')}
                            disabled={cameraLoading}
                          >
                            Retake ID Photo
                          </button>
                        </div>
                      ) : (
                        <div className="camera-empty-state">
                          <svg className="camera-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                            <circle cx="8" cy="12" r="2"></circle>
                            <line x1="13" y1="10" x2="19" y2="10"></line>
                            <line x1="13" y1="14" x2="17" y2="14"></line>
                          </svg>
                          <span className="camera-empty-hint">Live photo required</span>
                          <button
                            type="button"
                            className="btn-auth-submit btn-compact btn-block"
                            onClick={() => startCamera('id')}
                            disabled={cameraLoading}
                          >
                            {cameraLoading ? 'Starting Camera...' : 'Open Camera'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="step-actions-row">
                    <button type="button" className="btn-auth-secondary" onClick={handlePrevStep}>
                      Back
                    </button>
                    <button type="button" className="btn-auth-submit" onClick={handleNextStep}>
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: ACCOUNT CREDENTIALS */}
              {regStep === 4 && (
                <div className="reg-step-panel">
                  <div className="form-section-title">Step 4 — Account Credentials</div>

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
                      I agree to the <a href="#" className="inline-link">Terms &amp; Conditions</a>
                    </label>
                  </div>

                  <div className="step-actions-row">
                    <button type="button" className="btn-auth-secondary" onClick={handlePrevStep} disabled={submittingReg}>
                      Back
                    </button>
                    <button type="submit" className="btn-auth-submit" disabled={submittingReg}>
                      {submittingReg ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: WAITING FOR GMAIL CONFIRMATION */}
              {regStep === 'awaiting_confirmation' && (
                <div className="awaiting-gmail-panel">
                  <div className="awaiting-pulse-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </div>
                  <h3>Confirm Your Gmail Address</h3>
                  <p>
                    We sent a verification link to <strong>{regData.email.trim().toLowerCase()}</strong>.
                    Please open your Gmail inbox and click the confirmation link to activate your account.
                  </p>
                  <div className="awaiting-status-pill">
                    <span className="status-dot"></span>
                    Waiting for Gmail confirmation...
                  </div>
                  <div className="step-actions-row">
                    <button
                      type="button"
                      className="btn-auth-secondary"
                      onClick={handleResendConfirmation}
                      disabled={resendingEmail}
                    >
                      {resendingEmail ? 'Resending...' : 'Resend Email'}
                    </button>
                    <button
                      type="button"
                      className="btn-auth-submit"
                      onClick={() => {
                        setLoginData((prev) => ({ ...prev, email: regData.email.trim().toLowerCase() }));
                        resetRegistrationFlow();
                        setActiveTab('login');
                      }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="login-footer">
              <p>Protected by CRIMSON Identity System</p>
            </div>
          </div>
        </div>
      </main>

      {/* Modern Notification Modal UI: Only displays on errors or validation warnings */}
      {modalConfig.isOpen && (
        <div className="auth-modal-backdrop" onClick={closeModal}>
          <div className={`auth-modal-card ${modalConfig.type}`} onClick={(e) => e.stopPropagation()}>
            <div className="auth-modal-icon-badge">
              {modalConfig.type === 'success' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              )}
              {modalConfig.type === 'error' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              )}
              {modalConfig.type === 'warning' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              )}
            </div>

            <h3 className="auth-modal-title">{modalConfig.title}</h3>
            <p className="auth-modal-message">{modalConfig.message}</p>

            <button type="button" className="btn-auth-submit modal-action-btn" onClick={closeModal}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}