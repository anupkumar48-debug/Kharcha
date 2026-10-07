import { useEffect, useRef, useState } from 'react';

function useWidth(initial = 400) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
import { compact, money } from '../lib/format.js';

function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Vertical bars. data: [{label, value, hint?, highlight?}] ; refLine: optional budget line */
export function BarChart({ data, height = 190, refLine, refLabel }) {
  const [tip, setTip] = useState(null);
  const [ref, W] = useWidth();
  const H = height, padL = 40, padB = 22, padT = 12;
  const max = niceMax(Math.max(...data.map((d) => d.value), refLine || 0));
  const bw = (W - padL) / Math.max(data.length, 1);
  const y = (v) => H - padB - ((H - padB - padT) * v) / max;
  const ticks = [0, max / 2, max];
  return (
    <div className="chart" ref={ref} style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
            <text className="axis" x={padL - 6} y={y(t) + 3} textAnchor="end">{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(0, H - padB - y(d.value));
          const w = Math.min(bw - 4, 36);
          const x = padL + i * bw + (bw - w) / 2;
          const r = Math.min(4, w / 2, h);
          const top = y(d.value);
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${H - padB} Z`}
                  fill="var(--accent)" opacity={d.highlight === false ? 0.45 : 1}
                />
              )}
              <text className="axis" x={x + w / 2} y={H - 6} textAnchor="middle">{d.label}</text>
              <rect className="hit" x={padL + i * bw} y={padT} width={bw} height={H - padB - padT}
                onMouseEnter={() => setTip({ i, x: ((x + w / 2) / W) * 100, y: (top / H) * 100 })}
                onClick={() => setTip({ i, x: ((x + w / 2) / W) * 100, y: (top / H) * 100 })} />
            </g>
          );
        })}
        {refLine > 0 && (
          <g>
            <line x1={padL} x2={W} y1={y(refLine)} y2={y(refLine)} stroke="var(--bad)" strokeDasharray="5 4" strokeWidth="1.5" />
            <text className="axis" x={padL + 4} y={y(refLine) - 5} textAnchor="start" style={{ fill: 'var(--bad)' }}>{refLabel || 'Budget'}</text>
          </g>
        )}
      </svg>
      {tip && (
        <div className="tip" style={{ left: tip.x + '%', top: tip.y + '%' }}>
          <b>{data[tip.i].hint || data[tip.i].label}</b> · {money(data[tip.i].value)}
        </div>
      )}
    </div>
  );
}

/** Cumulative line: this month vs last month, by day */
export function LineChart({ series, days = 31, height = 200 }) {
  const [hx, setHx] = useState(null);
  const [ref, W] = useWidth();
  const H = height, padL = 40, padB = 20, padT = 12;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null))));
  const x = (i) => padL + ((W - padL - 4) * i) / (days - 1);
  const y = (v) => H - padB - ((H - padB - padT) * v) / max;
  const path = (vals) => vals.map((v, i) => (v == null ? '' : `${i && vals[i - 1] != null ? 'L' : 'M'}${x(i)},${y(v)}`)).join(' ');
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHx(Math.max(0, Math.min(days - 1, Math.round(((px - padL) / (W - padL - 4)) * (days - 1)))));
  };
  return (
    <div className="chart" ref={ref} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onTouchStart={(e) => onMove(e.touches[0] ? { ...e, clientX: e.touches[0].clientX, currentTarget: e.currentTarget } : e)} onMouseLeave={() => setHx(null)} role="img" aria-label="Cumulative spend line chart">
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
            <text className="axis" x={padL - 6} y={y(t) + 3} textAnchor="end">{compact(t)}</text>
          </g>
        ))}
        {[1, 8, 15, 22, 29].filter((d) => d <= days).map((d) => (
          <text key={d} className="axis" x={x(d - 1)} y={H - 4} textAnchor="middle">{d}</text>
        ))}
        {series.map((s) => (
          <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash ? '5 4' : undefined} strokeLinejoin="round" />
        ))}
        {hx != null && <line x1={x(hx)} x2={x(hx)} y1={padT} y2={H - padB} stroke="var(--muted)" strokeWidth="1" />}
        {hx != null && series.map((s) => s.values[hx] != null && (
          <circle key={s.name} cx={x(hx)} cy={y(s.values[hx])} r="4" fill={s.color} stroke="var(--card)" strokeWidth="2" />
        ))}
      </svg>
      {hx != null && (
        <div className="tip" style={{ left: (x(hx) / W) * 100 + '%', top: '10%' }}>
          Day {hx + 1}: {series.map((s) => s.values[hx] != null && `${s.name} ${money(s.values[hx])}`).filter(Boolean).join(' · ')}
        </div>
      )}
      <div className="row small muted" style={{ gap: 16, marginTop: 6 }}>
        {series.map((s) => (
          <span key={s.name} className="row" style={{ gap: 6, whiteSpace: 'nowrap' }}>
            <svg width="18" height="4"><line x1="0" x2="18" y1="2" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash ? '4 3' : undefined} /></svg>
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal category bars with icon + label + value (identity never by color alone) */
export function CategoryBars({ items, total, onPick, limit = 8 }) {
  const list = items.slice(0, limit);
  const max = Math.max(1, ...list.map((i) => i.value));
  if (!list.length) return <div className="empty small">No spending yet</div>;
  return (
    <div className="stack">
      {list.map((c) => (
        <div key={c.id} className="hbar" style={{ cursor: onPick ? 'pointer' : undefined }} onClick={() => onPick?.(c.id)} title={`${c.name}: ${money(c.value)}`}>
          <span style={{ fontSize: 18 }}>{c.icon}</span>
          <div>
            <div className="row between"><span>{c.name}</span><span className="muted xs">{total ? Math.round((c.value / total) * 100) : 0}%</span></div>
            <div className="track" style={{ marginTop: 4 }}><div className="fill" style={{ width: (c.value / max) * 100 + '%', background: c.color }} /></div>
          </div>
          <b className="num">{money(c.value)}</b>
        </div>
      ))}
    </div>
  );
}
