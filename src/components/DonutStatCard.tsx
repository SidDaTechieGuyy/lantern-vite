import React, { useEffect, useState, useRef } from "react";
import { PieChart, Pie, Cell } from "recharts";

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
  filledColor?: string;
  emptyColor?: string;
  innerRadius?: number;
  outerRadius?: number;
  size?: number;
  showValue?: boolean; // 👈 new
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
    startRef.current = {
      from: display,
      to: target,
      startTime: performance.now(),
    };

    const animate = (now: number) => {
      const elapsed = now - startRef.current.startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const current =
        startRef.current.from +
        (startRef.current.to - startRef.current.from) * ease;
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
  filledColor = "#2dd4bf",
  emptyColor = "rgba(255,255,255,0.06)",
  innerRadius = 32,
  outerRadius = 44,
  size = 100,
  showValue = true, // 👈 new
}: DonutStatCardProps) {
  const [value, setValue] = useState<number>(staticValue ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(staticValue === undefined);

  const animatedValue = useSpringValue(value, duration);

  // 👇 actual chart size is driven by outerRadius
  const chartSize = outerRadius * 2 + 10;

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

  const donutData = [
    { value: Math.min(animatedValue, 100) },
    { value: Math.max(100 - animatedValue, 0) },
  ];

  if (error) {
    return (
      <div style={{ ...styles.wrapper, ...style }} className={className}>
        {label && <div style={styles.label}>{label}</div>}
        <div style={styles.error}>⚠ {error}</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.wrapper, ...style }} className={className}>
      {/* 👇 chartSize is now derived from outerRadius, size prop is gone */}
      <div style={{ position: "relative", width: chartSize, height: chartSize }}>
        <PieChart width={chartSize} height={chartSize}>
          <Pie
            data={loading ? [{ value: 1 }] : donutData}
            cx={chartSize / 2 - 1}
            cy={chartSize / 2 - 1}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {loading ? (
              <Cell fill="rgba(255,255,255,0.08)" />
            ) : (
              <>
                <Cell fill={filledColor} />
                <Cell fill={emptyColor} />
              </>
            )}
          </Pie>
        </PieChart>

        {/* 👇 only render if showValue is true */}
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

