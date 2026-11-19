import './InteractiveCrimsonBg.css';

export default function InteractiveCrimsonBg({ ripples = [] }) {
  return (
    <div className="hero-interactive-bg" aria-hidden="true">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-dot-grid" />
      <div className="hero-spotlight" />
      {ripples.map((r) => (
        <span
          key={r.id}
          className="hero-click-ripple"
          style={{ left: `${r.x}px`, top: `${r.y}px` }}
        />
      ))}
    </div>
  );
}
