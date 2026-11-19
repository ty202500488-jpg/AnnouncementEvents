import React, { useState } from 'react';

function buildTopRoundedBarPath(x, y, w, h, r = 5) {
  const radius = Math.min(r, w / 2, h);
  if (radius <= 0) {
    return `M ${x},${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  return [
    `M ${x},${y + h}`,
    `V ${y + radius}`,
    `Q ${x},${y} ${x + radius},${y}`,
    `H ${x + w - radius}`,
    `Q ${x + w},${y} ${x + w},${y + radius}`,
    `V ${y + h}`,
    'Z',
  ].join(' ');
}

function buildSmoothSplinePath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export const ReferenceBarChartCard = ({ number, title, badgeText, badgeTone = 'emerald', bars = [], loading, error, onRetry }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const rawMax = Math.max(0, ...bars.map((b) => Number(b.value) || 0));
  const maxVal = Math.max(4, Math.ceil(rawMax / 2) * 2);
  const hasData = bars.some((b) => (Number(b.value) || 0) > 0);
  const totalSum = bars.reduce((acc, b) => acc + (Number(b.value) || 0), 0);

  const width = 560;
  const height = 232;
  const padL = 36;
  const padR = 16;
  const padT = 26;
  const padB = 38;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];
  const uniqueYTicks = [...new Set(yTicks)];
  const getY = (val) => padT + plotH - ((Number(val) || 0) / maxVal) * plotH;

  const slotW = bars.length ? plotW / bars.length : plotW;
  const barW = Math.min(64, Math.max(34, slotW * 0.34));
  const hoveredBar = hoveredIdx !== null && bars[hoveredIdx] ? bars[hoveredIdx] : null;
  const hoveredShare = hoveredBar && totalSum > 0
    ? Math.round(((Number(hoveredBar.value) || 0) / totalSum) * 100)
    : 0;

  return (
    <section className="ov-card ov-ref-chart-card" aria-label={title}>
      <div className="ov-ref-chart-head">
        <h3 className="ov-ref-chart-title">{number}. {title}</h3>
        {badgeText && <span className={`ov-ref-badge ov-ref-badge-${badgeTone}`}>{badgeText}</span>}
      </div>

      <div className="ov-chart-body">
        {loading ? (
          <div className="ov-chart-skeleton"><div className="ov-skeleton ov-skeleton-chart"></div></div>
        ) : error ? (
          <div className="ov-section-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>{error}</span>
            <button type="button" className="ov-btn ov-btn-secondary ov-btn-sm" onClick={onRetry}>Retry</button>
          </div>
        ) : !hasData ? (
          <div className="ov-empty-box compact">
            <div className="ov-empty-icon-wrap" aria-hidden="true"><i className="fa-solid fa-chart-column"></i></div>
            <h3 className="ov-empty-title">No data recorded yet</h3>
            <p className="ov-empty-desc">Metrics will appear here once records are available for this period.</p>
          </div>
        ) : (
          <div className="ov-line-chart-wrap" onMouseLeave={() => setHoveredIdx(null)}>
            {hoveredBar && (
              <div className="ov-chart-tooltip" role="status">
                <div className="ov-tooltip-title">{hoveredBar.label}</div>
                <div className="ov-tooltip-row">
                  <span>
                    <span className="ov-dot" style={{ background: hoveredBar.color }}></span>
                    Total:
                  </span>
                  <strong>
                    {hoveredBar.value.toLocaleString()}
                    {totalSum > 0 ? ` (${hoveredShare}%)` : ''}
                  </strong>
                </div>
              </div>
            )}

            <svg viewBox={`0 0 ${width} ${height}`} className="ov-svg-chart" role="img" aria-label={title}>
              <defs>
                {bars.map((b, idx) => (
                  <linearGradient key={`bar-grad-${idx}`} id={`ovBarGrad-${number}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={b.color} stopOpacity="1" />
                    <stop offset="100%" stopColor={b.color} stopOpacity="0.78" />
                  </linearGradient>
                ))}
              </defs>

              {uniqueYTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={width - padR}
                      y2={y}
                      stroke={tick === 0 ? '#cbd5e1' : '#e2e8f0'}
                      strokeWidth={tick === 0 ? 1.25 : 1}
                      strokeDasharray={tick === 0 ? undefined : '4 4'}
                    />
                    <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="11" fontWeight="500" fill="#94a3b8">{tick}</text>
                  </g>
                );
              })}

              {bars.map((b, idx) => {
                const cx = padL + slotW * idx + slotW / 2;
                const val = Number(b.value) || 0;
                const yTop = getY(val);
                const h = Math.max(0, padT + plotH - yTop);
                const isHovered = hoveredIdx === idx;
                const isDimmed = hoveredIdx !== null && !isHovered;

                return (
                  <g
                    key={b.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    style={{ cursor: 'pointer', transition: 'opacity 0.18s ease' }}
                    opacity={isDimmed ? 0.5 : 1}
                  >
                    {/* Subtle column background track */}
                    <path
                      d={buildTopRoundedBarPath(cx - barW / 2, padT, barW, plotH, 8)}
                      fill={isHovered ? '#f1f5f9' : '#f8fafc'}
                    />

                    {/* Full-slot invisible hit target for easy hovering */}
                    <rect
                      x={cx - slotW / 2}
                      y={padT}
                      width={slotW}
                      height={plotH + padB}
                      fill="transparent"
                    />

                    {val > 0 ? (
                      <>
                        <path
                          d={buildTopRoundedBarPath(cx - barW / 2, yTop, barW, h, 8)}
                          fill={`url(#ovBarGrad-${number}-${idx})`}
                        />
                        <text
                          x={cx}
                          y={yTop - 8}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill="#0f172a"
                        >
                          {val.toLocaleString()}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect
                          x={cx - barW / 2}
                          y={padT + plotH - 2}
                          width={barW}
                          height={2}
                          rx="1"
                          fill="#cbd5e1"
                        />
                        <text
                          x={cx}
                          y={padT + plotH - 9}
                          textAnchor="middle"
                          fontSize="11.5"
                          fontWeight="600"
                          fill="#94a3b8"
                        >
                          0
                        </text>
                      </>
                    )}

                    {/* Category dot + label */}
                    <text
                      x={cx}
                      y={height - 12}
                      textAnchor="middle"
                      fontSize="11.5"
                      fontWeight={isHovered ? '700' : '600'}
                      fill={isHovered ? '#0f172a' : '#475569'}
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
};

export const ReferenceAreaLineChartCard = ({ number, title, color, gradId, series = [], valueLabel, loading, error, onRetry }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const rawMax = Math.max(0, ...series.map((s) => Number(s.value) || 0));
  const maxVal = Math.max(4, Math.ceil(rawMax / 2) * 2);
  const hasData = series.length > 0;

  const width = 380;
  const height = 210;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (idx) => (series.length <= 1 ? padL + plotW / 2 : padL + (idx / (series.length - 1)) * plotW);
  const getY = (val) => padT + plotH - ((Number(val) || 0) / maxVal) * plotH;

  const pts = series.map((s, idx) => ({ x: getX(idx), y: getY(s.value), label: s.label, value: Number(s.value) || 0 }));
  const linePath = buildSmoothSplinePath(pts);
  const areaPath = pts.length > 1
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${padT + plotH} L ${pts[0].x.toFixed(1)},${padT + plotH} Z`
    : '';

  const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];
  const uniqueYTicks = [...new Set(yTicks)];
  const labelStep = Math.max(1, Math.ceil(series.length / 7));
  const hoveredItem = hoveredIdx !== null && pts[hoveredIdx] ? pts[hoveredIdx] : null;

  return (
    <section className="ov-card ov-ref-chart-card" aria-label={title}>
      <div className="ov-ref-chart-head">
        <h3 className="ov-ref-chart-title">{number}. {title}</h3>
      </div>

      <div className="ov-chart-body">
        {loading ? (
          <div className="ov-chart-skeleton"><div className="ov-skeleton ov-skeleton-chart"></div></div>
        ) : error ? (
          <div className="ov-section-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>{error}</span>
            <button type="button" className="ov-btn ov-btn-secondary ov-btn-sm" onClick={onRetry}>Retry</button>
          </div>
        ) : !hasData ? (
          <div className="ov-empty-box compact">
            <div className="ov-empty-icon-wrap" aria-hidden="true"><i className="fa-solid fa-chart-area"></i></div>
            <h3 className="ov-empty-title">No trend data yet</h3>
            <p className="ov-empty-desc">No activity recorded in this period.</p>
          </div>
        ) : (
          <div className="ov-line-chart-wrap" onMouseLeave={() => setHoveredIdx(null)}>
            {hoveredItem && (
              <div className="ov-chart-tooltip" role="status">
                <div className="ov-tooltip-title">{hoveredItem.label}</div>
                <div className="ov-tooltip-row">
                  <span>
                    <span className="ov-dot" style={{ background: color }}></span>
                    {valueLabel}:
                  </span>
                  <strong>{hoveredItem.value}</strong>
                </div>
              </div>
            )}

            <svg viewBox={`0 0 ${width} ${height}`} className="ov-svg-chart" role="img" aria-label={title}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {uniqueYTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={width - padR}
                      y2={y}
                      stroke={tick === 0 ? '#cbd5e1' : '#e2e8f0'}
                      strokeWidth={tick === 0 ? 1.25 : 1}
                      strokeDasharray={tick === 0 ? undefined : '4 4'}
                    />
                    <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10.5" fontWeight="500" fill="#94a3b8">{tick}</text>
                  </g>
                );
              })}

              {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
              {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />}

              {hoveredItem && (
                <line
                  x1={hoveredItem.x}
                  y1={padT}
                  x2={hoveredItem.x}
                  y2={padT + plotH}
                  stroke={color}
                  strokeOpacity="0.35"
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
                />
              )}

              {pts.map((pt, idx) => {
                const showLabel = idx % labelStep === 0 || idx === pts.length - 1;
                const colW = pts.length > 1 ? plotW / pts.length : plotW;
                const isHovered = hoveredIdx === idx;
                return (
                  <g key={`${pt.label}-${idx}`}>
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={8}
                        fill={color}
                        fillOpacity="0.16"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 4.5 : 3}
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth={isHovered ? '2.4' : '2'}
                    />
                    {showLabel && (
                      <text
                        x={pt.x}
                        y={height - 16}
                        textAnchor="end"
                        fontSize="10"
                        fontWeight="500"
                        fill="#64748b"
                        transform={`rotate(-22 ${pt.x} ${height - 16})`}
                      >
                        {pt.label}
                      </text>
                    )}
                    <rect
                      x={pt.x - colW / 2}
                      y={padT}
                      width={Math.max(14, colW)}
                      height={plotH}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIdx(idx)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
};
