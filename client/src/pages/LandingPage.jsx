import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './styles/LandingPage.css';
import image1 from '../assets/images/image1.jpg';
import image2 from '../assets/images/image2.jpg';
import image3 from '../assets/images/image3.jpg';
import image4 from '../assets/images/image4.jpg';
import image5 from '../assets/images/image5.jpg';


export default function LandingPage() {
  useEffect(() => {
    // Mobile navigation toggle script
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navActions = document.querySelector('.nav-actions');

    const handleToggle = () => {
      if (navLinks && navActions) {
        navLinks.classList.toggle('nav-active');
        navActions.classList.toggle('nav-active');
      }
    };

    if (navToggle) {
      navToggle.addEventListener('click', handleToggle);
    }

    // Smooth scrolling for anchor links
    const anchors = document.querySelectorAll('a[href^="#"]');
    const handleAnchorClick = function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        if (navLinks && navLinks.classList.contains('nav-active')) {
          navLinks.classList.remove('nav-active');
          navActions.classList.remove('nav-active');
        }
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    anchors.forEach(anchor => {
      anchor.addEventListener('click', handleAnchorClick);
    });

    return () => {
      if (navToggle) navToggle.removeEventListener('click', handleToggle);
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
          <a href="#" className="nav-logo" style={{ fontFamily: 'Bungee, sans-serif' }}>
            CRIM<span>SON</span>
          </a>
          <ul className="nav-links">
            <li><a href="#" className="nav-link">Home</a></li>
            <li><a href="#campus-life" className="nav-link">Events</a></li>
            <li><a href="#campus-life" className="nav-link">Announcements</a></li>
            <li><a href="#about" className="nav-link">About</a></li>
          </ul>

          <div className="nav-actions">
            <Link to="/auth" className="btn-nav">Sign In</Link>
          </div>

          <button className="nav-toggle" aria-label="Toggle Navigation">&#9776;</button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="hero">
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
              <a href="#campus-life" className="btn-primary1">Explore Events</a>
              <a href="#campus-life" className="btn-secondary">View Announcements</a>
            </div>
          </div>

        </div>
      </main>

      {/* Showcase Grid Section */}
      <section className="grid-showcase-section" id="campus-life">
        <div className="showcase-container">
          
          <div className="destinations-header">
            <h2 className="destinations-title">Campus Updates & Events</h2>
            <a href="#campus-life" className="view-all-link">
              View All Updates
              <span className="arrow-circle">→</span>
            </a>
          </div>

          <div className="destination-cards-grid">
            <article className="dest-card">
              <img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80" alt="Tech & Innovation Summit" className="dest-card-bg" />
              <div className="dest-card-overlay"></div>
              <div className="dest-card-content">
                <div className="dest-info">
                  <h3 className="dest-name">Annual Tech Summit</h3>
                  <p className="dest-sub">Main Auditorium • Nov 12</p>
                </div>
                <span className="dest-price tag-open">view</span>
              </div>
            </article>

            <article className="dest-card">
              <img src="https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=800&q=80" alt="Midterm Exam Schedule" className="dest-card-bg" />
              <div className="dest-card-overlay"></div>
              <div className="dest-card-content">
                <div className="dest-info">
                  <h3 className="dest-name">Midterm Exam Schedule</h3>
                  <p className="dest-sub">Academic Affairs Release</p>
                </div>
                <span className="dest-price tag-open">view</span>
              </div>
            </article>

            <article className="dest-card">
              <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80" alt="Student Org Fair" className="dest-card-bg" />
              <div className="dest-card-overlay"></div>
              <div className="dest-card-content">
                <div className="dest-info">
                  <h3 className="dest-name">Campus Org Fair</h3>
                  <p className="dest-sub">University Quad • Oct 28</p>
                </div>
                <span className="dest-price tag-open">view</span>
              </div>
            </article>

            <article className="dest-card">
              <img src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80" alt="Scholarship Applications" className="dest-card-bg" />
              <div className="dest-card-overlay"></div>
              <div className="dest-card-content">
                <div className="dest-info">
                  <h3 className="dest-name">Scholarship Grant 2026</h3>
                  <p className="dest-sub">Student Affairs Office</p>
                </div>
                <span className="dest-price tag-apply">View</span>
              </div>
            </article>
          </div>

        </div>
      </section>

      {/* Feature Showcase Grid Section */}
      <section className="about-section" id="about">
        <div className="section-container">
          
          <div className="grid-top">
            <div className="grid-card image-card">
              <img src="https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=900&q=80" alt="Campus Life" className="card-bg-img" />
              <div className="card-overlay"></div>
              <div className="card-content-overlay">
                <h3 className="card-headline">EXPLORE A THRIVING CAMPUS</h3>
                <a href="#about" className="circle-btn" aria-label="Explore Campus World">→</a>
              </div>
            </div>

            <div className="grid-card text-card">
              <div className="card-body">
                <h3 className="card-title-dark">OWN YOUR CAMPUS LIFE</h3>
                <p className="card-desc-dark">From high-energy club fairs to real-time deadline updates, take complete control of your student journey.</p>
                <a href="#about" className="pill-btn">LEARN MORE <span className="arrow">→</span></a>
              </div>
            </div>

            <div className="grid-card image-card">
              <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80" alt="Campus Events" className="card-bg-img" />
              <div className="card-overlay"></div>
              <div className="card-content-overlay">
                <h3 className="card-headline">ENDLESS CONNECTIONS</h3>
                <a href="#about" className="circle-btn" aria-label="Endless Connections">→</a>
              </div>
            </div>
          </div>

          <div className="grid-bottom">
            <div className="grid-card text-card-wide">
              <h2 className="card-title-dark section-heading">ABOUT CRIMSON</h2>
              <p className="card-desc-dark wide-text">
                The ultimate digital portal for your student experience. Stay connected with instant university announcements, track upcoming event schedules, and stay aligned with vital academic deadlines—all in one place.
              </p>
              <a href="#about" className="pill-btn">DISCOVER MORE <span className="arrow">→</span></a>
            </div>

            <div className="grid-card image-card banner-card">
              <img src={image5} alt="Welcome to Crimson" className="card-bg-img" />
              <div className="card-overlay"></div>
              
              <div className="vertical-badge">
                <span className="badge-text">WELCOME TO CRIMSON</span>
                <a href="#about" className="circle-btn badge-btn" aria-label="Welcome to Crimson">→</a>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <p>&copy; 2026 CRIMSON Campus Management System. All rights reserved.</p>
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