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

export default function LandingPage() {
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 10000);
    return () => clearInterval(timer);
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
        <div className="bg-blob blob-scatter-4 float-anim-1"></div>
        <div className="bg-blob blob-scatter-5 float-anim-3"></div>
        <div className="bg-blob blob-scatter-6 float-anim-2"></div>
        <div className="bg-blob blob-scatter-7 float-anim-4"></div>

        {/* Glowing Stars */}
        {[...Array(28)].map((_, i) => (
          <div key={i} className={`star-blob star-${i + 1}`}></div>
        ))}
      </div>

      {/* Navigation Bar */}
      <header className="navbar">
        <div className="nav-container">
          <a href="#" className="nav-logo">
            <img src={logo} alt="CRIMSON Logo" className="logo-img" />
            <span className="logo-text" style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 800, letterSpacing: '0.05em' }}>
              CRIM<span className="logo-accent">SON</span>
            </span>
          </a>

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
            <div className="hero-photo-blob"></div>

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