import React from 'react';

/**
 * Stepped wavy diagonal crimson layers with floating gradient orbs, hollow rings,
 * and minimal dot accents in the Admin Dashboard crimson & white palette.
 */
export default function WaveBackground() {
  return (
    <div className="interactive-bg" aria-hidden="true">
      <svg
        className="wave-bg-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Base deep crimson canvas */}
          <linearGradient id="baseCrimson" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b0413" />
            <stop offset="55%" stopColor="#4c0519" />
            <stop offset="100%" stopColor="#6b0f2a" />
          </linearGradient>

          {/* Mid stepped wavy band */}
          <linearGradient id="midBandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#881337" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#9f1239" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#4c0519" stopOpacity="0.98" />
          </linearGradient>

          {/* Top-right vibrant crimson wave */}
          <linearGradient id="topRightWaveGrad" x1="15%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#be123c" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#9f1239" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#881337" stopOpacity="0.98" />
          </linearGradient>

          {/* Bottom-left vibrant crimson-rose wave (no white gap) */}
          <linearGradient id="botLeftLightGrad" x1="0%" y1="10%" x2="95%" y2="95%">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.96" />
            <stop offset="55%" stopColor="#e11d48" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#be123c" stopOpacity="0.98" />
          </linearGradient>

          {/* Secondary deep crimson under-wave on bottom-left */}
          <linearGradient id="botLeftUnderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#be123c" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#881337" stopOpacity="0.96" />
          </linearGradient>

          {/* Floating gradient orbs */}
          <linearGradient id="orbGrad1" x1="15%" y1="15%" x2="85%" y2="85%">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="50%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>

          <linearGradient id="orbGrad2" x1="0%" y1="20%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#fff1f2" />
            <stop offset="55%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>

          <filter id="waveSoftShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#1e030a" floodOpacity="0.32" />
          </filter>

          <filter id="orbShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#1e030a" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Deep crimson base */}
        <rect width="1440" height="900" fill="url(#baseCrimson)" />

        {/* Center stepped wavy crimson band */}
        <path
          className="wave-layer wave-anim-4"
          fill="url(#midBandGrad)"
          filter="url(#waveSoftShadow)"
          d="M 480,-40 C 560,40 570,120 505,195 C 440,270 465,360 540,425 C 615,490 610,590 685,665 C 760,740 830,835 900,940 L 1480,940 L 1480,-40 Z"
        />

        {/* Top-right vibrant crimson wavy layer */}
        <path
          className="wave-layer wave-anim-3"
          fill="url(#topRightWaveGrad)"
          filter="url(#waveSoftShadow)"
          d="M 760,-40 C 815,35 795,110 740,165 C 685,220 715,310 790,340 C 865,370 935,380 960,460 C 985,540 1055,585 1130,570 C 1205,555 1260,605 1300,665 C 1340,725 1410,740 1480,715 L 1480,-40 Z"
        />

        {/* Bottom-left soft rose under-wave */}
        <path
          className="wave-layer wave-anim-2"
          fill="url(#botLeftUnderGrad)"
          filter="url(#waveSoftShadow)"
          d="M -40,145 C 85,175 155,245 145,340 C 135,435 195,495 255,555 C 315,615 320,715 390,775 C 460,835 510,885 575,940 L -40,940 Z"
        />

        {/* Bottom-left bright white-to-rose foreground wave */}
        <path
          className="wave-layer wave-anim-1"
          fill="url(#botLeftLightGrad)"
          filter="url(#waveSoftShadow)"
          d="M -40,185 C 65,215 115,285 105,375 C 95,465 150,520 205,575 C 260,630 265,730 335,790 C 405,850 450,895 505,940 L -40,940 Z"
        />

        {/* Floating gradient orbs */}
        <circle
          className="wave-layer wave-anim-1"
          cx="325"
          cy="345"
          r="38"
          fill="url(#orbGrad1)"
          filter="url(#orbShadow)"
        />
        <circle
          className="wave-layer wave-anim-3"
          cx="1135"
          cy="525"
          r="32"
          fill="url(#orbGrad2)"
          filter="url(#orbShadow)"
        />
        <circle
          className="wave-layer wave-anim-2"
          cx="760"
          cy="895"
          r="54"
          fill="url(#orbGrad1)"
          filter="url(#orbShadow)"
        />

        {/* Crisp hollow rings */}
        <circle
          className="wave-layer wave-anim-4"
          cx="562"
          cy="44"
          r="9"
          fill="none"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="2.5"
        />
        <circle
          className="wave-layer wave-anim-3"
          cx="1285"
          cy="118"
          r="11"
          fill="none"
          stroke="rgba(255, 228, 230, 0.72)"
          strokeWidth="2.5"
        />
        <circle
          className="wave-layer wave-anim-2"
          cx="885"
          cy="445"
          r="8"
          fill="none"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="2.5"
        />
        <circle
          className="wave-layer wave-anim-1"
          cx="350"
          cy="760"
          r="9"
          fill="none"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="2.5"
        />

        {/* Minimal solid dot accents */}
        <circle className="wave-layer wave-anim-1" cx="170" cy="495" r="7" fill="#ffffff" opacity="0.95" />
        <circle className="wave-layer wave-anim-2" cx="425" cy="230" r="8" fill="rgba(255, 228, 230, 0.55)" />
        <circle className="wave-layer wave-anim-3" cx="722" cy="368" r="6" fill="rgba(255, 228, 230, 0.42)" />
        <circle className="wave-layer wave-anim-4" cx="1050" cy="775" r="5.5" fill="#ffffff" opacity="0.9" />
        <circle className="wave-layer wave-anim-3" cx="1395" cy="480" r="7" fill="rgba(255, 228, 230, 0.35)" />
      </svg>
    </div>
  );
}
