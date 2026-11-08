import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './styles/LandingPage.css';
import logo from '../assets/images/logo.jpg';
import image1 from '../assets/images/image1.jpg';
import image2 from '../assets/images/image2.jpg';
import image3 from '../assets/images/image3.jpg';
import image4 from '../assets/images/image4.jpg';

export default function LandingPage() {
  useEffect(() => {
    // Smooth scrolling for anchor links
    const anchors = document.querySelectorAll('a[href^="#"]');
    const handleAnchorClick = function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    anchors.forEach(anchor => {
      anchor.addEventListener('click', handleAnchorClick);
    });

    return () => {
      anchors.forEach(anchor => anchor.removeEventListener('click', handleAnchorClick));
    };
  }, []);

  return (
    <div className="landing-page-wrapper">
      {/* Ambient Background Canvas */}
      <div className="interactive-bg">
        <div className="bg-blob blob-1 float-anim-1"></div>
        <div className="bg-blob blob-left-deep float-anim-2"></div>
        <div className="bg-blob blob-scatter-left-mid float-anim-3"></div>

        <div className="bg-blob blob-2 float-anim-2"></div>
        <div className="bg-blob blob-right-deep float-anim-1"></div>
        <div className="bg-blob blob-scatter-right-mid float-anim-4"></div>

        <div className="bg-blob blob-3 float-anim-3"></div>
        <div className="bg-blob blob-scatter-1 float-anim-4"></div>
        <div className="bg-blob blob-scatter-2 float-anim-1"></div>
        <div className="bg-blob blob-scatter-3 float-anim-2"></div>

        {/* Glowing Stars */}
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`star-blob star-${i + 1}`}></div>
        ))}
      </div>

      {/* Navigation Bar */}
      <header className="navbar">
        <div className="nav-container">
          <a href="#" className="nav-logo">
            <img src={logo} alt="CRIMSON Logo" className="logo-img" />
            <span className="logo-text" style={{ fontFamily: 'Bungee, sans-serif' }}>
              CRIM<span className="logo-accent">SON</span>
            </span>
          </a>
        
          <div className="nav-actions">
            <Link to="/auth" className="btn-nav">Sign In</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main id="campus-life" className="hero">
        <div className="hero-container">
          
          <div className="hero-image-wrapper">
            <div className="hero-photo-blob"></div>

            <div className="circular-hero-container">
              <div className="hero-circle main-circle">
                <img 
                  src={image1} 
                  alt="Campus Life Central Feature"
                />
              </div>

              <div className="hero-circle satellite-circle sat-top">
                <img 
                  src={image2} 
                  alt="Campus Event Preview"
                />
              </div>

              <div className="hero-circle satellite-circle sat-mid">
                <img 
                  src={image3} 
                  alt="Student Collaboration Preview"
                />
              </div>

              <div className="hero-circle satellite-circle sat-bot">
                <img 
                  src={image4} 
                  alt="Campus Activities Preview"
                />
              </div>
            </div>
          </div>

          <div className="hero-content">
            <h1 className="hero-title animate-text">
              Your Campus,<br />
              <span className="shimmer-glow-text">In One Place.</span>
            </h1>
            <p className="hero-subtitle animate-text delay-1">
              Stay updated with the latest announcements, events, deadlines, and activities happening around campus.
            </p>
            <div className="hero-actions animate-text delay-2">
              <Link to="/auth" className="btn-primary1">Explore Events</Link>
              <Link to="/auth" className="btn-secondary">View Announcements</Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <p>&copy; 2026 CRIMSON. All rights reserved.</p>
          <ul className="footer-links">
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Contact Support</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}