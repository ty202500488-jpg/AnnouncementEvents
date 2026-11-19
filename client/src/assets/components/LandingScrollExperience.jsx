import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import wmsuCampusImg from '../images/wmsu-campus.jpg';
import '../../pages/styles/LandingScrollExperience.css';

const ABOUT_HEADING_WORDS = 'Western Mindanao State University'.split(' ');

const PORTAL_STEPS = [
  {
    number: '1',
    title: 'Sign In',
    desc: 'Use your @wmsu.edu.ph email and Student ID.',
    previewTitle: 'Verified Campus Accounts',
    previewDesc: 'Sign in for Student, Staff, or Admin access.',
    icon: 'fa-shield-halved',
  },
  {
    number: '2',
    title: 'Follow Pages',
    desc: 'Follow your college and student organizations.',
    previewTitle: 'Advisories & Updates',
    previewDesc: 'See announcements and deadlines in one feed.',
    icon: 'fa-layer-group',
  },
  {
    number: '3',
    title: 'Events & Announcements',
    desc: 'Browse updates, reserve seats, and check in with QR.',
    previewTitle: 'Events & Check-In',
    previewDesc: 'Track posts, registrations, and attendance.',
    icon: 'fa-calendar-check',
  },
];

const COLLEGE_ICONS = [
  'fa-scale-balanced',
  'fa-stethoscope',
  'fa-compass-drafting',
  'fa-seedling',
  'fa-book-open',
  'fa-drafting-compass',
  'fa-heart-pulse',
  'fa-chalkboard-user',
  'fa-atom',
  'fa-microchip',
  'fa-tree',
  'fa-shield-halved',
  'fa-landmark',
  'fa-house-chimney',
  'fa-building-columns',
  'fa-person-running',
  'fa-hands-holding-circle',
];

function ChevronRun({ direction = 'right' }) {
  const isLeft = direction === 'left';
  return (
    <span className={`cx-chevrons ${isLeft ? 'is-left' : 'is-right'}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((idx) => (
        <svg key={idx} viewBox="0 0 10 14" fill="none" className="cx-chevron-item" style={{ '--ci': idx }}>
          <path
            d={isLeft ? 'M8 2L3 7L8 12' : 'M2 2L7 7L2 12'}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

const pointerRafMap = new WeakMap();

const handleMagneticMove = (e) => {
  const btn = e.currentTarget;
  const clientX = e.clientX;
  const clientY = e.clientY;
  const prevRaf = pointerRafMap.get(btn);
  if (prevRaf) cancelAnimationFrame(prevRaf);
  pointerRafMap.set(
    btn,
    requestAnimationFrame(() => {
      pointerRafMap.delete(btn);
      const rect = btn.getBoundingClientRect();
      const nx = (clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const ny = (clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      btn.style.transform = `translate3d(${(nx * 9).toFixed(1)}px, ${(ny * 7).toFixed(1)}px, 0)`;
    })
  );
};

const handleMagneticLeave = (e) => {
  const btn = e.currentTarget;
  const prevRaf = pointerRafMap.get(btn);
  if (prevRaf) {
    cancelAnimationFrame(prevRaf);
    pointerRafMap.delete(btn);
  }
  btn.style.transform = '';
};

const handleCardPointerMove = (e) => {
  const card = e.currentTarget;
  const clientX = e.clientX;
  const clientY = e.clientY;
  const prevRaf = pointerRafMap.get(card);
  if (prevRaf) cancelAnimationFrame(prevRaf);
  pointerRafMap.set(
    card,
    requestAnimationFrame(() => {
      pointerRafMap.delete(card);
      const rect = card.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const nx = x / Math.max(rect.width, 1) - 0.5;
      const ny = y / Math.max(rect.height, 1) - 0.5;
      const spotlight = card.firstElementChild;
      if (spotlight && spotlight.classList.contains('cx-card-spotlight')) {
        spotlight.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
      card.style.transform = `perspective(950px) rotateX(${(-ny * 3.2).toFixed(2)}deg) rotateY(${(nx * 3.2).toFixed(2)}deg) translate3d(0, 0, 0)`;
    })
  );
};

const handleCardPointerLeave = (e) => {
  const card = e.currentTarget;
  const prevRaf = pointerRafMap.get(card);
  if (prevRaf) {
    cancelAnimationFrame(prevRaf);
    pointerRafMap.delete(card);
  }
  card.style.transform = '';
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function LandingScrollExperience({ colleges = [] }) {
  const rootRef = useRef(null);
  const progressBarRef = useRef(null);
  const aboutRef = useRef(null);
  const tickerWrapRef = useRef(null);
  const howRef = useRef(null);
  const horizonRef = useRef(null);
  const horizonArcRef = useRef(null);
  const horizonCoreRef = useRef(null);
  const cardRefs = useRef([]);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return undefined;
    const revealEls = rootEl.querySelectorAll('.cx-reveal');
    if (typeof IntersectionObserver === 'undefined') {
      revealEls.forEach((el) => {
        el.dataset.visible = 'true';
        el.classList.add('is-visible');
      });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.dataset.visible = 'true';
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -24px 0px' }
    );

    revealEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sections = [aboutRef.current, howRef.current, horizonRef.current].filter(Boolean);
    if (!sections.length) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      sections.forEach((el) => {
        el.dataset.inView = 'true';
      });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.dataset.inView = entry.isIntersecting ? 'true' : 'false';
        });
      },
      { threshold: 0, rootMargin: '140px 0px 140px 0px' }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const target = { page: 0, how: 0, horizon: 0 };
    const current = { ...target };
    const applied = {
      page: -1,
      horizon: -1,
    };

    let lastActiveStep = 0;
    let lastHorizonLit = false;
    let needsCompute = true;
    let rafId = null;

    const computeTargets = () => {
      const doc = document.documentElement;
      const vh = window.innerHeight || 800;
      const scrollY = window.scrollY;
      const maxScroll = Math.max(doc.scrollHeight - vh, 1);

      target.page = clamp01(scrollY / maxScroll);

      const howEl = howRef.current;
      let nextActiveStep = lastActiveStep;
      if (howEl && howEl.dataset.inView !== 'false') {
        const r = howEl.getBoundingClientRect();
        target.how = clamp01((vh * 0.72 - r.top) / Math.max(r.height * 0.85, 1));

        const focusY = vh * 0.52;
        let closestIdx = 0;
        let closestDist = Infinity;
        const cards = cardRefs.current;
        for (let idx = 0; idx < cards.length; idx += 1) {
          const el = cards[idx];
          if (!el) continue;
          const cr = el.getBoundingClientRect();
          const mid = cr.top + cr.height * 0.5;
          const dist = Math.abs(mid - focusY);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = idx;
          }
        }
        nextActiveStep = closestIdx;
      }

      const horizonEl = horizonRef.current;
      let nextHorizonLit = lastHorizonLit;
      if (horizonEl && horizonEl.dataset.inView !== 'false') {
        const r = horizonEl.getBoundingClientRect();
        const hp = clamp01((vh * 1.05 - r.top) / (vh * 0.82));
        target.horizon = hp;
        nextHorizonLit = hp >= 0.48;
      }

      return { nextActiveStep, nextHorizonLit };
    };

    const applyDirectStyles = (nextActiveStep, nextHorizonLit) => {
      if (nextActiveStep !== lastActiveStep) {
        lastActiveStep = nextActiveStep;
        setActiveStep(nextActiveStep);
        cardRefs.current.forEach((el, idx) => {
          if (el) el.classList.toggle('is-focused', idx === nextActiveStep);
        });
      }

      if (nextHorizonLit !== lastHorizonLit) {
        lastHorizonLit = nextHorizonLit;
        if (horizonRef.current) horizonRef.current.classList.toggle('is-lit', nextHorizonLit);
      }

      if (progressBarRef.current && Math.abs(current.page - applied.page) > 0.0005) {
        applied.page = current.page;
        progressBarRef.current.style.transform = `scaleX(${current.page.toFixed(4)})`;
      }

      const horizonInView = !horizonRef.current || horizonRef.current.dataset.inView !== 'false';
      if (horizonInView && Math.abs(current.horizon - applied.horizon) > 0.002) {
        applied.horizon = current.horizon;
        const hp = current.horizon;
        const inv = 1 - hp;
        if (horizonArcRef.current) {
          horizonArcRef.current.style.transform = `translate3d(-50%, ${(inv * 72).toFixed(1)}px, 0) scaleX(${(0.82 + hp * 0.22).toFixed(3)})`;
          horizonArcRef.current.style.opacity = (0.35 + hp * 0.65).toFixed(2);
        }
        if (horizonCoreRef.current) {
          horizonCoreRef.current.style.transform = `translate3d(-50%, ${(inv * 56).toFixed(1)}px, 0) scaleX(${(0.86 + hp * 0.18).toFixed(3)})`;
          horizonCoreRef.current.style.opacity = (0.32 + hp * 0.68).toFixed(2);
        }
      }
    };

    const tick = () => {
      rafId = null;
      let nextActiveStep = lastActiveStep;
      let nextHorizonLit = lastHorizonLit;

      if (needsCompute) {
        needsCompute = false;
        const computed = computeTargets();
        nextActiveStep = computed.nextActiveStep;
        nextHorizonLit = computed.nextHorizonLit;
      }

      const ease = reducedMotion ? 1 : 0.2;
      let moving = false;

      for (const key of ['page', 'how', 'horizon']) {
        const diff = target[key] - current[key];
        if (Math.abs(diff) > 0.001) {
          current[key] += diff * ease;
          moving = true;
        } else {
          current[key] = target[key];
        }
      }

      applyDirectStyles(nextActiveStep, nextHorizonLit);

      if (moving || needsCompute) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const scheduleTick = () => {
      needsCompute = true;
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('scroll', scheduleTick, { passive: true });
    window.addEventListener('resize', scheduleTick, { passive: true });
    scheduleTick();

    return () => {
      window.removeEventListener('scroll', scheduleTick);
      window.removeEventListener('resize', scheduleTick);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Split the 17 existing colleges across 3 staggered counter-scrolling marquee rows
  const marqueeRows = useMemo(() => {
    const collegeEntries = colleges.map((name, idx) => ({
      name,
      icon: COLLEGE_ICONS[idx % COLLEGE_ICONS.length],
    }));
    const rowSize = Math.ceil(collegeEntries.length / 3);
    return [
      collegeEntries.slice(0, rowSize),
      collegeEntries.slice(rowSize, rowSize * 2),
      collegeEntries.slice(rowSize * 2),
    ].filter((row) => row.length > 0);
  }, [colleges]);

  return (
    <div ref={rootRef} className="cx-scroll-root">
      {/* Ultra-fine top scroll progress hairline */}
      <div ref={progressBarRef} className="cx-scroll-progress" aria-hidden="true" />

      {/* =======================================================
          BAND 1 — RISING PURE-WHITE EDITORIAL CURTAIN + NEBULA SPLIT + 3-ROW MARQUEE
          (Gcore 0:07 → 0:10 tailored to WMSU CRIMSON)
         ======================================================= */}
      <section id="about-wmsu" ref={aboutRef} className="cx-light-band">
        <div className="cx-inner">
          <h2
            className="cx-light-heading cx-reveal"
            aria-label="Western Mindanao State University"
          >
            {(() => {
              let charIdx = 0;
              return ABOUT_HEADING_WORDS.map((word, wordIdx) => (
                <span key={word} className="cx-letter-word" aria-hidden="true">
                  {word.split('').map((char) => {
                    const idx = charIdx++;
                    return (
                      <span
                        key={idx}
                        className="cx-letter-char"
                        style={{ '--char-index': idx }}
                      >
                        {char}
                      </span>
                    );
                  })}
                  {wordIdx < ABOUT_HEADING_WORDS.length - 1 ? ' ' : null}
                </span>
              ));
            })()}
          </h2>

          {/* Asymmetric 2-Column Showcase Card */}
          <div className="cx-showcase-grid cx-reveal">
            {/* Left: WMSU Campus Photo Showcase Card */}
            <div
              className="cx-nebula-card"
              onMouseMove={handleCardPointerMove}
              onMouseLeave={handleCardPointerLeave}
            >
              <span className="cx-card-spotlight cx-card-spotlight-nebula" aria-hidden="true" />
              <img
                src={wmsuCampusImg}
                alt="Western Mindanao State University Campus"
                className="cx-campus-photo"
              />
              <div className="cx-campus-overlay" aria-hidden="true" />

              <div className="cx-nebula-footer">
                <a
                  href="https://wmsu.edu.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cx-visit-btn"
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                >
                  <span>Visit</span>
                  <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Right: Crisp White Copy + 3-Row Elevated College Pill Marquee */}
            <div className="cx-right-panel">
              <div className="cx-right-copy">
                <p className="cx-light-lead">
                  Founded in 1904, WMSU is Western Mindanao&apos;s flagship state university for instruction, research, and extension.
                </p>
              </div>

              <div id="colleges" ref={tickerWrapRef} className="cx-ticker-wrap" aria-label="Colleges and Academic Units">
                {marqueeRows.map((row, rowIdx) => (
                  <div
                    key={`marquee-row-${rowIdx}`}
                    className={`cx-ticker-row ${rowIdx % 2 === 1 ? 'is-reverse' : ''}`}
                    style={{ '--row-dur': `${34 + rowIdx * 7}s` }}
                  >
                    {[...row, ...row].map((item, idx) => (
                      <div key={`r${rowIdx}-${idx}-${item.name}`} className="cx-college-pill">
                        <span className="cx-college-icon" aria-hidden="true">
                          <i className={`fa-solid ${item.icon}`} />
                        </span>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================
          BAND 2 — SPLIT-SCREEN EDITORIAL STEPPER + STICKY LIVE PREVIEW STAGE
         ======================================================= */}
      <section id="how-it-works" ref={howRef} className="cx-dark-band">
        <div className="cx-dark-ambient" aria-hidden="true" />

        <div className="cx-inner cx-dark-inner">
          <div className="cx-how-header cx-reveal">
            <ChevronRun direction="right" />
            <h2 className="cx-dark-heading">
              How it <span className="cx-crimson-accent">works</span>
            </h2>
            <ChevronRun direction="left" />
          </div>

          <div className="cx-stages-grid">
            {PORTAL_STEPS.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <article
                  key={step.number}
                  ref={(el) => { cardRefs.current[idx] = el; }}
                  className={`cx-stage-col cx-reveal${isActive ? ' is-active is-focused' : ''}`}
                  style={{ '--stage-idx': idx }}
                  onMouseEnter={() => setActiveStep(idx)}
                >
                  <div className="cx-stage-slash-wrap" aria-hidden="true">
                    <span className="cx-stage-big-num">{step.number}</span>
                    <span className="cx-stage-slash" />
                  </div>

                  <div className="cx-stage-body">
                    <span className="cx-stage-icon" aria-hidden="true">
                      <i className={`fa-solid ${step.icon}`} />
                    </span>
                    <h3 className="cx-stage-title">{step.title}</h3>
                    <div className="cx-stage-rule" aria-hidden="true">
                      <span className="cx-stage-rule-lit" />
                    </div>
                    <p className="cx-stage-desc">{step.desc}</p>
                    <p className="cx-stage-meta">{step.previewDesc}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="cx-band-divider cx-reveal" aria-hidden="true">
            <span className="cx-band-divider-line" />
            <span className="cx-band-divider-diamonds">
              <span className="cx-band-divider-diamond cx-band-divider-diamond-side" />
              <span className="cx-band-divider-diamond" />
              <span className="cx-band-divider-diamond cx-band-divider-diamond-side" />
            </span>
            <span className="cx-band-divider-line" />
          </div>
        </div>
      </section>

      {/* =======================================================
          BAND 3 — DOTTED DOME + BLAZING CRIMSON HORIZON FINALE
          (Gcore 0:20 dotted globe + 0:37 glowing horizon CTA)
         ======================================================= */}
      <section id="join-crimson" ref={horizonRef} className="cx-horizon-cta">
        <div ref={horizonArcRef} className="cx-horizon-arc" aria-hidden="true" />
        <div ref={horizonCoreRef} className="cx-horizon-core" aria-hidden="true" />

        <div className="cx-horizon-inner cx-reveal">
          <h2 className="cx-horizon-heading">
            <span className="cx-horizon-word-left">JOIN</span>{' '}
            <span className="cx-crimson-accent cx-horizon-word-right">CRIMSON</span>
          </h2>
          <p className="cx-horizon-sub">
            Stay connected with official university advisories, college updates, and campus events in one unified feed.
          </p>
          <div className="cx-horizon-action">
            <Link
              to="/auth"
              className="cx-horizon-btn"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
            >
              <span>Get Started</span>
              <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default memo(LandingScrollExperience);
