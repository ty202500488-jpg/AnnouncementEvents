import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './styles/LandingPage.css';
import logo from '../assets/images/logo.jpg';
import image1 from '../assets/images/image1.jpg';
import image2 from '../assets/images/image2.jpg';
import image3 from '../assets/images/image3.jpg';
import image4 from '../assets/images/image4.jpg';

const HERO_IMAGES = [
  { id: 'hero-1', src: image1, alt: 'Campus Life Central Feature', tag: 'Campus Life' },
  { id: 'hero-2', src: image2, alt: 'Campus Event Preview', tag: 'Events' },
  { id: 'hero-3', src: image3, alt: 'Student Collaboration Preview', tag: 'Community' },
  { id: 'hero-4', src: image4, alt: 'Campus Activities Preview', tag: 'Activities' },
];

const HERO_SLOT_CLASSES = [
  'main-card',
  'deck-card deck-top',
  'deck-card deck-mid',
  'deck-card deck-bot',
];

const WMSU_COLLEGES = [
  'College of Law',
  'College of Medicine',
  'College of Engineering',
  'College of Agriculture',
  'College of Liberal Arts',
  'College of Architecture',
  'College of Nursing',
  'College of Teacher Education',
  'College of Science & Mathematics',
  'College of Computing Studies',
  'College of Forestry & Environmental Studies',
  'College of Criminal Justice Education',
  'College of Asian & Islamic Studies',
  'College of Home Economics',
  'College of Public Administration & Development Studies',
  'College of Sports Science & Physical Education',
  'College of Social Work & Community Development',
];

export default function LandingPage() {
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.reveal-on-scroll');
    if (!els.length) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
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
      {/* Navigation Bar */}
      <header className="navbar">
        <div className="nav-container">
          <a href="#" className="nav-logo">
            <img src={logo} alt="CRIMSON Logo" className="logo-img" />
            <span className="logo-text" style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 800, letterSpacing: '0.05em' }}>
              CRIM<span className="logo-accent">SON</span>
            </span>
          </a>

          <nav className="nav-links" aria-label="Primary">
            <a href="#campus-life" className="nav-link-item">Campus Life</a>
            <a href="#about-wmsu" className="nav-link-item">About WMSU</a>
            <a href="#colleges" className="nav-link-item">Colleges</a>
          </nav>

          <div className="nav-actions">
            <Link to="/auth" className="btn-nav-ghost">Sign In</Link>
            <Link to="/auth" className="btn-nav">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main id="campus-life" className="hero">
        <div className="hero-container">
          
          <div className="hero-image-wrapper">
            <div className="circular-hero-container">
              {HERO_IMAGES.map((img, idx) => {
                const slotIdx = (idx - cycleIndex + HERO_IMAGES.length) % HERO_IMAGES.length;
                const slotClass = HERO_SLOT_CLASSES[slotIdx];
                const isMain = slotIdx === 0;
                return (
                  <div
                    key={img.id}
                    className={`hero-card ${slotClass}`}
                    onClick={() => setCycleIndex(idx)}
                    style={{ cursor: isMain ? 'default' : 'pointer' }}
                    title={isMain ? img.alt : `Feature ${img.tag}`}
                  >
                    <img src={img.src} alt={img.alt} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hero-content">
            <h1 className="hero-title">
              <span className="hero-title-line">
                <span className="hero-word word-1">Your</span>{' '}
                <span className="hero-word word-2">Campus</span>
              </span>
              <span className="hero-title-line">
                <span className="shimmer-glow-text">
                  <span className="hero-word word-3">In</span>{' '}
                  <span className="hero-word word-4">One</span>{' '}
                  <span className="hero-word word-5">Place</span>
                </span>
              </span>
            </h1>
            <p className="hero-subtitle animate-text delay-2">
              Stay updated with the latest announcements, events, deadlines, and activities happening around campus.
            </p>
            <div className="hero-actions animate-text delay-3">
              <Link to="/auth" className="btn-primary1">Explore Events</Link>
              <Link to="/auth" className="btn-secondary">View Announcements</Link>
            </div>
          </div>
        </div>

        {/* Editorial Bottom Bar */}
        <div className="hero-bottom-bar animate-text delay-3">
          <div className="hero-bottom-meta">
            <span className="hero-bottom-label">A Smart Research University by 2040</span>
            <span className="hero-bottom-sub">Western Mindanao State University &middot; Est. 1904 &middot; Baliwasan, Zamboanga City</span>
          </div>
          <div className="hero-bottom-rule" aria-hidden="true"></div>
          <a href="#about-wmsu" className="hero-bottom-circle-btn" aria-label="Learn more about WMSU">
            <i className="fa-solid fa-arrow-down" aria-hidden="true"></i>
          </a>
        </div>
      </main>

      {/* About WMSU Section */}
      <section id="about-wmsu" className="wmsu-about-section">
        <div className="wmsu-section-inner">
          <div className="wmsu-about-grid reveal-on-scroll">
            <div className="wmsu-about-copy">
              <span className="wmsu-section-eyebrow">Official University Portal</span>
              <h2 className="wmsu-section-title">Western Mindanao State University</h2>
              <p className="wmsu-section-text">
                Tracing its roots to 1904 as a normal school in Zamboanga and chartered as a state university,
                WMSU serves as a flagship institution for instruction, research, extension, and regional
                development in Western Mindanao.
              </p>
              <a
                href="https://wmsu.edu.ph/"
                target="_blank"
                rel="noopener noreferrer"
                className="wmsu-official-link"
              >
                <span>Visit Official WMSU Website (wmsu.edu.ph)</span>
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              </a>
            </div>

            <div className="wmsu-stats-row">
              <div className="wmsu-stat-item">
                <span className="wmsu-stat-num">1904</span>
                <span className="wmsu-stat-label">Founded in Zamboanga</span>
              </div>
              <div className="wmsu-stat-item">
                <span className="wmsu-stat-num">17</span>
                <span className="wmsu-stat-label">Academic Colleges</span>
              </div>
              <div className="wmsu-stat-item">
                <span className="wmsu-stat-num">2040</span>
                <span className="wmsu-stat-label">Smart Research Vision</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Colleges & Academic Units Section */}
      <section id="colleges" className="wmsu-colleges-section">
        <div className="wmsu-section-inner">
          <div className="wmsu-colleges-header reveal-on-scroll">
            <div>
              <span className="wmsu-section-eyebrow">Academic Directory</span>
              <h2 className="wmsu-section-title">Colleges &amp; Academic Units</h2>
            </div>
            <Link to="/auth" className="btn-nav">Sign In to Portal</Link>
          </div>

          <div className="wmsu-colleges-grid reveal-on-scroll">
            {WMSU_COLLEGES.map((college, idx) => (
              <div
                key={college}
                className="wmsu-college-chip"
                style={{ '--chip-idx': idx }}
              >
                <span className="wmsu-college-dot" aria-hidden="true"></span>
                <span>{college}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <p>&copy; 2026 CRIMSON &middot; Western Mindanao State University, Baliwasan, Zamboanga City.</p>
          <ul className="footer-links">
            <li><a href="https://wmsu.edu.ph/" target="_blank" rel="noopener noreferrer">wmsu.edu.ph</a></li>
            <li><a href="#about-wmsu">About WMSU</a></li>
            <li><a href="#colleges">Colleges</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}