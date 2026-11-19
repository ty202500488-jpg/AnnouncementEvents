import { useRef, useState } from 'react';

/**
 * Provides mouse-tracking spotlight, parallax, and click-ripple handlers
 * for a full-bleed crimson background container.
 */
export function useInteractiveCrimsonBg(
  ignoreSelector = 'a, button, input, select, textarea, label, .login-card, .hero-card'
) {
  const hostRef = useRef(null);
  const rippleIdRef = useRef(0);
  const moveRafRef = useRef(null);
  const [ripples, setRipples] = useState([]);

  const onMouseMove = (e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const el = hostRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const normX = (x / Math.max(rect.width, 1) - 0.5) * 2;
      const normY = (y / Math.max(rect.height, 1) - 0.5) * 2;
      el.style.setProperty('--mx', `${x.toFixed(1)}px`);
      el.style.setProperty('--my', `${y.toFixed(1)}px`);
      el.style.setProperty('--px', `${normX.toFixed(3)}`);
      el.style.setProperty('--py', `${normY.toFixed(3)}`);
      el.style.setProperty('--glow-opacity', '1');
    });
  };

  const onMouseLeave = () => {
    if (moveRafRef.current) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    const el = hostRef.current;
    if (!el) return;
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
    el.style.setProperty('--glow-opacity', '0.45');
  };

  const onClick = (e) => {
    if (ignoreSelector && e.target.closest(ignoreSelector)) return;
    const el = hostRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = ++rippleIdRef.current;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples((prev) => [...prev.slice(-4), { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 850);
  };

  return { hostRef, ripples, onMouseMove, onMouseLeave, onClick };
}
