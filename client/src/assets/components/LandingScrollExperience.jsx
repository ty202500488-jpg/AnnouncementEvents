import { memo, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import wmsuCampusImg from '../images/wmsu-campus.jpg';
import '../../pages/styles/LandingScrollExperience.css';

const PORTAL_STEPS = [
  {
    number: '1',
    title: 'Sign In',
    desc: 'Use your @wmsu.edu.ph email and Student ID.',
    previewTitle: 'Verified Campus Accounts',
    previewDesc: 'Sign in for Student, Staff, or Admin access.',
    icon: 'signin',
  },
  {
    number: '2',
    title: 'Follow Pages',
    desc: 'Follow your college and student organizations.',
    previewTitle: 'Advisories & Updates',
    previewDesc: 'See announcements and deadlines in one feed.',
    icon: 'pages',
  },
  {
    number: '3',
    title: 'Events & Announcements',
    desc: 'Browse campus announcements, reserve event slots, and check in with QR.',
    previewTitle: 'Announcements & Check-In',
    previewDesc: 'Track announcements, registrations, and venue attendance.',
    icon: 'events',
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

function StepLineIcon({ type }) {
  if (type === 'signin') {
    return (
      <svg viewBox="0 0 88 88" fill="none" className="cx-step-svg" aria-hidden="true">
        <path
          d="M44 12L70 22V42C70 59.5 58.6 72.4 44 77C29.4 72.4 18 59.5 18 42V22L44 12Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="44" cy="39" r="8" stroke="currentColor" strokeWidth="2.2" />
        <path
          d="M31 57C33.8 51.8 38.5 49 44 49C49.5 49 54.2 51.8 57 57"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === 'pages') {
    return (
      <svg viewBox="0 0 88 88" fill="none" className="cx-step-svg" aria-hidden="true">
        <rect
          x="18"
          y="16"
          width="42"
          height="54"
          rx="6"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path
          d="M28 31H48M28 42H48M28 53H40"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M64 26L68 30L75 23M64 41L68 45L75 38M64 56L68 60L75 53"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 88 88" fill="none" className="cx-step-svg" aria-hidden="true">
      <rect
        x="22"
        y="16"
        width="44"
        height="56"
        rx="7"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect x="31" y="26" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="47" y="26" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="31" y="42" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M47 47L51 51L58 43"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M36 62H52" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

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
  const traceTopLRef = useRef(null);
  const traceTopRRef = useRef(null);
  const traceMidLRef = useRef(null);
  const traceMidRRef = useRef(null);
  const stemFillRef = useRef(null);
  const stemNodeRef = useRef(null);
  const horizonRef = useRef(null);
  const horizonDomeRef = useRef(null);
  const horizonArcRef = useRef(null);
  const horizonCoreRef = useRef(null);
  const cardRefs = useRef([]);

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
      { threshold: 0.08, rootMargin: '0px 0px -48px 0px' }
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
      busTop: -1,
      busMid: -1,
      busStem: -1,
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
        cardRefs.current.forEach((el, idx) => {
          if (el) el.classList.toggle('is-focused', idx === nextActiveStep);
        });
      }

      if (nextHorizonLit !== lastHorizonLit) {
        lastHorizonLit = nextHorizonLit;
        if (stemNodeRef.current) stemNodeRef.current.classList.toggle('is-lit', nextHorizonLit);
        if (horizonRef.current) horizonRef.current.classList.toggle('is-lit', nextHorizonLit);
      }

      if (progressBarRef.current && Math.abs(current.page - applied.page) > 0.0005) {
        applied.page = current.page;
        progressBarRef.current.style.transform = `scaleX(${current.page.toFixed(4)})`;
      }

      const howInView = !howRef.current || howRef.current.dataset.inView !== 'false';
      if (howInView) {
        const busTop = clamp01(current.how * 3.1);
        if (Math.abs(busTop - applied.busTop) > 0.01) {
          applied.busTop = busTop;
          const op = (0.15 + busTop * 0.85).toFixed(2);
          if (traceTopLRef.current) traceTopLRef.current.style.opacity = op;
          if (traceTopRRef.current) traceTopRRef.current.style.opacity = op;
        }

        const busMid = clamp01((current.how - 0.32) * 2.8);
        if (Math.abs(busMid - applied.busMid) > 0.01) {
          applied.busMid = busMid;
          const op = (0.15 + busMid * 0.85).toFixed(2);
          if (traceMidLRef.current) traceMidLRef.current.style.opacity = op;
          if (traceMidRRef.current) traceMidRRef.current.style.opacity = op;
        }

        const busStem = clamp01((current.how - 0.56) * 2.5);
        if (stemFillRef.current && Math.abs(busStem - applied.busStem) > 0.004) {
          applied.busStem = busStem;
          stemFillRef.current.style.transform = `scaleY(${busStem.toFixed(4)})`;
        }
      }

      const horizonInView = !horizonRef.current || horizonRef.current.dataset.inView !== 'false';
      if (horizonInView && Math.abs(current.horizon - applied.horizon) > 0.002) {
        applied.horizon = current.horizon;
        const hp = current.horizon;
        const inv = 1 - hp;
        if (horizonDomeRef.current) {
          horizonDomeRef.current.style.transform = `translate3d(-50%, ${(inv * 72).toFixed(1)}px, 0)`;
          horizonDomeRef.current.style.opacity = (0.28 + hp * 0.72).toFixed(2);
        }
        if (horizonArcRef.current) {
          horizonArcRef.current.style.transform = `translate3d(-50%, ${(inv * 64).toFixed(1)}px, 0)`;
          horizonArcRef.current.style.opacity = (0.45 + hp * 0.55).toFixed(2);
        }
        if (horizonCoreRef.current) {
          horizonCoreRef.current.style.transform = `translate3d(-50%, ${(inv * 48).toFixed(1)}px, 0)`;
          horizonCoreRef.current.style.opacity = (0.38 + hp * 0.62).toFixed(2);
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
          <h2 className="cx-light-heading cx-reveal">
            Western Mindanao State University
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
          BAND 2 — DEEP OBSIDIAN-CRIMSON BENTO + ANIMATED CIRCUIT NETWORK
          (Gcore 0:13 → 0:17 tailored to CRIMSON's 3 Portal Steps)
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

          {/* Scroll-driven top circuit bus feeding into the Bento grid */}
          <div className="cx-bus-top" aria-hidden="true">
            <svg viewBox="0 0 600 54" fill="none" preserveAspectRatio="none" className="cx-bus-svg">
              <path d="M300 0V24H150V54" className="cx-trace-base" />
              <path d="M300 0V24H450V54" className="cx-trace-base" />
              <path ref={traceTopLRef} d="M300 0V24H150V54" className="cx-trace-lit cx-trace-top-l" pathLength="1" />
              <path ref={traceTopRRef} d="M300 0V24H450V54" className="cx-trace-lit cx-trace-top-r" pathLength="1" />
            </svg>
          </div>

          {/* Asymmetric 2 + 1 Dark Obsidian Bento Grid */}
          <div className="cx-bento-grid">
            {/* STEP 1 — Sign In (Glowing Shield Orb Card) */}
            <article
              ref={(el) => { cardRefs.current[0] = el; }}
              className="cx-bento-card cx-bento-card-1 cx-reveal is-focused"
              onMouseMove={handleCardPointerMove}
              onMouseLeave={handleCardPointerLeave}
            >
              <span className="cx-card-spotlight" aria-hidden="true" />
              <div className="cx-bento-head">
                <span className="cx-step-badge">{PORTAL_STEPS[0].number}</span>
                <h3 className="cx-bento-title">{PORTAL_STEPS[0].title}</h3>
                <p className="cx-bento-desc">{PORTAL_STEPS[0].desc}</p>
                <p className="cx-bento-meta">
                  <strong>{PORTAL_STEPS[0].previewTitle}:</strong> {PORTAL_STEPS[0].previewDesc}
                </p>
              </div>

              <div className="cx-bento-stage cx-stage-shield" aria-hidden="true">
                <div className="cx-orb-glow" />
                <div className="cx-orb-ring cx-orb-ring-1" />
                <div className="cx-orb-ring cx-orb-ring-2" />
                <div className="cx-orb-ring cx-orb-ring-3" />
                <div className="cx-orb-core">
                  <StepLineIcon type="signin" />
                </div>
              </div>
            </article>

            {/* STEP 2 — Follow Pages (Radial Hub & Animated Circuit Pulses Card) */}
            <article
              ref={(el) => { cardRefs.current[1] = el; }}
              className="cx-bento-card cx-bento-card-2 cx-reveal"
              onMouseMove={handleCardPointerMove}
              onMouseLeave={handleCardPointerLeave}
            >
              <span className="cx-card-spotlight" aria-hidden="true" />
              <div className="cx-bento-head">
                <span className="cx-step-badge">{PORTAL_STEPS[1].number}</span>
                <h3 className="cx-bento-title">{PORTAL_STEPS[1].title}</h3>
                <p className="cx-bento-desc">{PORTAL_STEPS[1].desc}</p>
                <p className="cx-bento-meta">
                  <strong>{PORTAL_STEPS[1].previewTitle}:</strong> {PORTAL_STEPS[1].previewDesc}
                </p>
              </div>

              <div className="cx-bento-stage cx-stage-hub" aria-hidden="true">
                <svg viewBox="0 0 360 190" fill="none" className="cx-hub-svg">
                  {/* Base circuit traces */}
                  <path d="M52 44H116L146 84H162" className="cx-hub-line" />
                  <path d="M36 96H162" className="cx-hub-line" />
                  <path d="M52 148H116L146 108H162" className="cx-hub-line" />
                  <path d="M308 44H244L214 84H198" className="cx-hub-line" />
                  <path d="M324 96H198" className="cx-hub-line" />
                  <path d="M308 148H244L214 108H198" className="cx-hub-line" />

                  {/* Animated glowing crimson signal pulses */}
                  <path d="M52 44H116L146 84H162" className="cx-hub-pulse cx-pulse-a" pathLength="100" />
                  <path d="M36 96H162" className="cx-hub-pulse cx-pulse-b" pathLength="100" />
                  <path d="M52 148H116L146 108H162" className="cx-hub-pulse cx-pulse-c" pathLength="100" />
                  <path d="M308 44H244L214 84H198" className="cx-hub-pulse cx-pulse-b" pathLength="100" />
                  <path d="M324 96H198" className="cx-hub-pulse cx-pulse-a" pathLength="100" />
                  <path d="M308 148H244L214 108H198" className="cx-hub-pulse cx-pulse-c" pathLength="100" />
                </svg>

                <span className="cx-sat-node cx-sat-1"><i className="fa-solid fa-graduation-cap" /></span>
                <span className="cx-sat-node cx-sat-2"><i className="fa-solid fa-bullhorn" /></span>
                <span className="cx-sat-node cx-sat-3"><i className="fa-solid fa-building-columns" /></span>
                <span className="cx-sat-node cx-sat-4"><i className="fa-solid fa-users" /></span>
                <span className="cx-sat-node cx-sat-5"><i className="fa-solid fa-bell" /></span>
                <span className="cx-sat-node cx-sat-6"><i className="fa-solid fa-calendar-days" /></span>

                <div className="cx-hub-core">
                  <StepLineIcon type="pages" />
                </div>
              </div>
            </article>

            {/* Connecting Scroll-Driven Circuit Bridge into Step 3 */}
            <div className="cx-bus-mid" aria-hidden="true">
              <svg viewBox="0 0 600 44" fill="none" preserveAspectRatio="none" className="cx-bus-svg">
                <path d="M150 0V22H300V44" className="cx-trace-base" />
                <path d="M450 0V22H300V44" className="cx-trace-base" />
                <path ref={traceMidLRef} d="M150 0V22H300V44" className="cx-trace-lit cx-trace-mid-l" pathLength="1" />
                <path ref={traceMidRRef} d="M450 0V22H300V44" className="cx-trace-lit cx-trace-mid-r" pathLength="1" />
              </svg>
            </div>

            {/* STEP 3 — Events & Announcements (Wide Featured Circuit Waveform + QR Scan Card) */}
            <article
              ref={(el) => { cardRefs.current[2] = el; }}
              className="cx-bento-card cx-bento-wide cx-reveal"
              onMouseMove={handleCardPointerMove}
              onMouseLeave={handleCardPointerLeave}
            >
              <span className="cx-card-spotlight" aria-hidden="true" />
              <div className="cx-bento-head cx-bento-wide-copy">
                <span className="cx-step-badge">{PORTAL_STEPS[2].number}</span>
                <h3 className="cx-bento-title">{PORTAL_STEPS[2].title}</h3>
                <p className="cx-bento-desc">{PORTAL_STEPS[2].desc}</p>
                <p className="cx-bento-meta">
                  <strong>{PORTAL_STEPS[2].previewTitle}:</strong> {PORTAL_STEPS[2].previewDesc}
                </p>
              </div>

              <div className="cx-bento-stage cx-stage-wave" aria-hidden="true">
                <svg viewBox="0 0 460 180" fill="none" className="cx-wave-svg">
                  <path d="M0 36H104L134 62H236L264 90H340" className="cx-hub-line" />
                  <path d="M0 72H148L178 90H340" className="cx-hub-line" />
                  <path d="M0 108H148L178 90H340" className="cx-hub-line" />
                  <path d="M0 144H104L134 118H236L264 90H340" className="cx-hub-line" />

                  <path d="M0 36H104L134 62H236L264 90H340" className="cx-hub-pulse cx-pulse-a" pathLength="100" />
                  <path d="M0 72H148L178 90H340" className="cx-hub-pulse cx-pulse-c" pathLength="100" />
                  <path d="M0 108H148L178 90H340" className="cx-hub-pulse cx-pulse-b" pathLength="100" />
                  <path d="M0 144H104L134 118H236L264 90H340" className="cx-hub-pulse cx-pulse-a" pathLength="100" />
                </svg>

                <div className="cx-qr-chip">
                  <div className="cx-qr-scan-beam" />
                  <StepLineIcon type="events" />
                </div>
              </div>
            </article>
          </div>

          {/* Terminal circuit stem feeding into the Crimson Horizon Finale */}
          <div className="cx-bus-bottom" aria-hidden="true">
            <div className="cx-stem-track">
              <div ref={stemFillRef} className="cx-stem-fill" />
            </div>
            <span ref={stemNodeRef} className="cx-stem-node" />
          </div>
        </div>
      </section>

      {/* =======================================================
          BAND 3 — DOTTED DOME + BLAZING CRIMSON HORIZON FINALE
          (Gcore 0:20 dotted globe + 0:37 glowing horizon CTA)
         ======================================================= */}
      <section id="join-crimson" ref={horizonRef} className="cx-horizon-cta">
        <div ref={horizonDomeRef} className="cx-horizon-dome" aria-hidden="true" />
        <div ref={horizonArcRef} className="cx-horizon-arc" aria-hidden="true" />
        <div ref={horizonCoreRef} className="cx-horizon-core" aria-hidden="true" />

        <div className="cx-horizon-inner cx-reveal">
          <h2 className="cx-horizon-heading">
            JOIN <span className="cx-crimson-accent">CRIMSON</span>
          </h2>
          <div className="cx-horizon-action">
            <Link
              to="/auth"
              className="cx-horizon-btn"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
            >
              <span>Get Started</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default memo(LandingScrollExperience);
