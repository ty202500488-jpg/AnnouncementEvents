import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import InteractiveCrimsonBg from '../assets/components/InteractiveCrimsonBg';
import { useInteractiveCrimsonBg } from '../utils/useInteractiveCrimsonBg';
import LandingScrollExperience from '../assets/components/LandingScrollExperience';
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('campus-life');
  const { hostRef: heroRef, ripples, onMouseMove: handleHeroMouseMove, onMouseLeave: handleHeroMouseLeave, onClick: handleHeroClick } =
    useInteractiveCrimsonBg('a, button, .hero-card');

  useEffect(() => {
    const timer = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);
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
    // Smooth scrolling for anchor links (including # back-to-top)
    const anchors = document.querySelectorAll('a[href^="#"]');
    const handleAnchorClick = function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    anchors.forEach((anchor) => {
      anchor.addEventListener('click', handleAnchorClick);
    });

    return () => {
      anchors.forEach((anchor) => anchor.removeEventListener('click', handleAnchorClick));
    };
  }, []);

  useEffect(() => {
    const aboutEl = document.getElementById('about-wmsu');
    const howItWorksEl = document.getElementById('how-it-works');

    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    // Track navbar scrolled state using a lightweight sentinel at the top of the page
    const navSentinel = document.createElement('div');
    navSentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:16px;pointer-events:none;visibility:hidden;';
    document.body.prepend(navSentinel);

    const navObserver = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    navObserver.observe(navSentinel);

    // Track active nav section without scroll-event getBoundingClientRect() calls
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target === howItWorksEl) {
            setActiveNav('how-it-works');
          } else if (entry.target === aboutEl) {
            setActiveNav('about-wmsu');
          }
        });
      },
      { rootMargin: '-180px 0px -65% 0px', threshold: 0 }
    );

    if (aboutEl) sectionObserver.observe(aboutEl);
    if (howItWorksEl) sectionObserver.observe(howItWorksEl);

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveNav('campus-life');
        }
      },
      { rootMargin: '0px 0px -75% 0px', threshold: 0 }
    );
    if (heroRef.current) heroObserver.observe(heroRef.current);

    return () => {
      navObserver.disconnect();
      sectionObserver.disconnect();
      heroObserver.disconnect();
      navSentinel.remove();
    };
  }, [heroRef]);

  return (
    <div className="landing-page-wrapper">
      {/* Navigation Bar */}
      <header className={`navbar ${isScrolled ? 'is-scrolled' : ''}`}>
        <div className="nav-container">
          <a href="#" className="nav-logo">
            <img src={logo} alt="CRIMSON Logo" className="logo-img" />
            <span className="logo-text" style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 800, letterSpacing: '0.05em' }}>
              CRIM<span className="logo-accent">SON</span>
            </span>
          </a>

          <nav className="nav-links" aria-label="Primary">
            <a href="#campus-life" className={`nav-link-item ${activeNav === 'campus-life' ? 'is-active' : ''}`}>Home</a>
            <a href="#about-wmsu" className={`nav-link-item ${activeNav === 'about-wmsu' ? 'is-active' : ''}`}>About WMSU</a>
            <a href="#how-it-works" className={`nav-link-item ${activeNav === 'how-it-works' ? 'is-active' : ''}`}>How It Works</a>
          </nav>

          <div className="nav-actions">
            <Link to="/auth" className="btn-nav-ghost">Sign In</Link>
            <Link to="/auth" className="btn-nav">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main
        id="campus-life"
        ref={heroRef}
        className="hero interactive-crimson-host"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        onClick={handleHeroClick}
      >
        <InteractiveCrimsonBg ripples={ripples} />

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

      <LandingScrollExperience colleges={WMSU_COLLEGES} logo={logo} />

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