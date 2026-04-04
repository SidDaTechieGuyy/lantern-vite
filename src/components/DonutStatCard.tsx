import React, { useEffect, useState, useRef } from "react";

interface DonutStatCardProps {
  glancesUrl?: string;
  endpoint?: string;
  dataKey?: string;
  duration?: number;
  label?: string;
  tick?: number;
  className?: string;
  style?: React.CSSProperties;
  staticValue?: number;
  emptyColor?: string;
  innerRadius?: number;
  outerRadius?: number;
  showValue?: boolean;
  gradientStart?: string;
  gradientMid?: string;
  gradientEnd?: string;
}

function extractValue(data: any, dataKey: string): number {
  if (dataKey.startsWith("label:")) {
    const withoutPrefix = dataKey.replace("label:", "");
    const dotIndex = withoutPrefix.lastIndexOf(".");
    const labelPart = withoutPrefix.substring(0, dotIndex);
    const field = withoutPrefix.substring(dotIndex + 1);
    const arr = Array.isArray(data) ? data : [data];
    const found = arr.find((item: any) => item.label === labelPart);
    return found ? parseFloat(found[field]) || 0 : 0;
  }
  const target = Array.isArray(data) ? data[0] : data;
  const keys = dataKey.split(".");
  let result = target;
  for (const k of keys) {
    if (result == null) return 0;
    result = result[k];
  }
  return typeof result === "number" ? result : parseFloat(result) || 0;
}

function useSpringValue(target: number, duration: number) {
  const [display, setDisplay] = useState(target);
  const animRef = useRef<number | null>(null);
  const startRef = useRef({ from: target, to: target, startTime: 0 });

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    startRef.current = { from: display, to: target, startTime: performance.now() };

    const animate = (now: number) => {
      const elapsed = now - startRef.current.startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const current =
        startRef.current.from + (startRef.current.to - startRef.current.from) * ease;
      setDisplay(current);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [target, duration]);

  return display;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const b2 = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${b2})`;
}

function gradientColor(
  t: number,
  start: string,
  mid: string,
  end: string
): string {
  const s = hexToRgb(start);
  const m = hexToRgb(mid);
  const e = hexToRgb(end);
  if (t < 0.5) return lerpColor(s, m, t / 0.5);
  return lerpColor(m, e, (t - 0.5) / 0.5);
}

// Instead of individual arc paths, we use a single SVG approach:
// draw the ring as a filled shape using clipPath so there are zero gaps.
function buildRingPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;

  // Clamp to just under 360 to avoid SVG arc edge case
  const sweep = Math.min(endAngleDeg - startAngleDeg, 359.999);
  const endAngle = startAngleDeg + sweep;

  const s = toRad(startAngleDeg);
  const e = toRad(endAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  const ox1 = cx + outerR * Math.cos(s);
  const oy1 = cy + outerR * Math.sin(s);
  const ox2 = cx + outerR * Math.cos(e);
  const oy2 = cy + outerR * Math.sin(e);

  const ix1 = cx + innerR * Math.cos(e);
  const iy1 = cy + innerR * Math.sin(e);
  const ix2 = cx + innerR * Math.cos(s);
  const iy2 = cy + innerR * Math.sin(s);

  return [
    `M ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
    `L ${ix1} ${iy1}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
    `Z`,
  ].join(" ");
}

const SEGMENTS = 200;

export function DonutStatCard({
  glancesUrl,
  endpoint,
  dataKey,
  duration = 0.6,
  label = "",
  tick = 0,
  className,
  style,
  staticValue,
  emptyColor = "rgba(255,255,255,0.06)",
  innerRadius = 10,
  outerRadius = 60,
  showValue = true,
  gradientStart = "#2dd4bf",
  gradientMid = "#facc15",
  gradientEnd = "#ef4444",
}: DonutStatCardProps) {
  const [value, setValue] = useState<number>(staticValue ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(staticValue === undefined);

  const animatedValue = useSpringValue(value, duration);
  const chartSize = outerRadius * 2 + 10;
  const cx = chartSize / 2;
  const cy = chartSize / 2;

  useEffect(() => {
    if (staticValue !== undefined) {
      setValue(staticValue);
      setLoading(false);
      setError(null);
      return;
    }
    if (!glancesUrl || !endpoint || !dataKey) return;

    const base = glancesUrl.replace(/\/$/, "");
    const url = `${base}/${endpoint}`;

    const fetchData = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const raw = extractValue(json, dataKey);
        setValue(raw);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Fetch error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [glancesUrl, endpoint, dataKey, tick, staticValue]);

  if (error) {
    return (
      <div style={{ ...styles.wrapper, ...style }} className={className}>
        {label && <div style={styles.label}>{label}</div>}
        <div style={styles.error}>⚠ {error}</div>
      </div>
    );
  }

  const startAngleDeg = -90;
  const filledDeg = (Math.min(animatedValue, 100) / 100) * 360;
  const segmentDeg = 360 / SEGMENTS;

  // Full background ring path
  const bgPath = buildRingPath(cx, cy, outerRadius, innerRadius, startAngleDeg, startAngleDeg + 360);

  return (
    <div style={{ ...styles.wrapper, ...style }} className={className}>
      <div style={{ position: "relative", width: chartSize, height: chartSize }}>
        <svg width={chartSize} height={chartSize}>

          {/* ── Background full ring ── */}
          <path d={bgPath} fill={loading ? "rgba(255,255,255,0.08)" : emptyColor} />

          {/* ── Gradient filled segments ── */}
          {!loading &&
            Array.from({ length: SEGMENTS }, (_, i) => {
              const segStartRel = i * segmentDeg;       // 0–360
              const segEndRel = segStartRel + segmentDeg;

              // Skip entirely if this segment hasn't started yet
              if (segStartRel >= filledDeg) return null;

              // Clip the last partial segment exactly
              const clippedEndRel = Math.min(segEndRel, filledDeg);

              const segStartAbs = startAngleDeg + segStartRel;
              // Add tiny 0.5° overdraw so adjacent filled segments overlap, killing gaps
              const segEndAbs = startAngleDeg + clippedEndRel + 0.5;

              const t = i / SEGMENTS;
              const color = gradientColor(t, gradientStart, gradientMid, gradientEnd);
              const d = buildRingPath(cx, cy, outerRadius, innerRadius, segStartAbs, segEndAbs);

              return <path key={i} d={d} fill={color} />;
            })}
        </svg>

        {showValue && (
          <div style={styles.centerText}>
            {loading ? (
              <span style={styles.loadingDots}>···</span>
            ) : (
              <span>{animatedValue.toFixed(1)}%</span>
            )}
          </div>
        )}
      </div>

      {label && <div style={styles.label}>{label}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  },
  centerText: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.85em",
    fontWeight: 600,
    pointerEvents: "none",
  },
  loadingDots: {
    opacity: 0.3,
    fontSize: "1.2em",
    letterSpacing: "0.1em",
  },
  label: {
    fontSize: "0.75em",
    opacity: 0.55,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  error: {
    color: "#f87171",
    fontSize: "0.75em",
  },
};

