import React, { useEffect, useState } from "react";
import CountUp from "react-countup";

interface AnimatedStatProps {
  glancesUrl: string;
  endpoint: string;
  dataKey: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  divisor?: number;
  duration?: number;
  label?: string;
  refreshInterval?: number;
  className?: string; // 👈 added
}

function extractValue(data: any, dataKey: string): number {
  const target = Array.isArray(data) ? data[0] : data;
  const keys = dataKey.split(".");
  let result = target;
  for (const k of keys) {
    if (result == null) return 0;
    result = result[k];
  }
  return typeof result === "number" ? result : parseFloat(result) || 0;
}

export function AnimatedStat({
  glancesUrl,
  endpoint,
  dataKey,
  suffix = "",
  prefix = "",
  decimals = 1,
  divisor = 1,
  duration = 0.6,
  label = "",
  refreshInterval = 2000,
  className, // 👈 added
}: AnimatedStatProps) {
  const [value, setValue] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!glancesUrl || !endpoint || !dataKey) return;

    const base = glancesUrl.replace(/\/$/, "");
    const url = `${base}/${endpoint}`; // 👈 was `/api/3/${endpoint}`

    const fetchData = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const raw = extractValue(json, dataKey);
        setValue(raw / divisor);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Fetch error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [glancesUrl, endpoint, dataKey, divisor, refreshInterval]);

  if (loading) {
    return (
      <div style={styles.wrapper} className={className}> {/* 👈 added */}
        {label && <div style={styles.label}>{label}</div>}
        <div style={styles.loading}>...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.wrapper} className={className}> {/* 👈 added */}
        {label && <div style={styles.label}>{label}</div>}
        <div style={styles.error}>⚠ {error}</div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper} className={className}> {/* 👈 added */}
      {label && <div style={styles.label}>{label}</div>}
      <CountUp
        end={value}
        suffix={suffix}
        prefix={prefix}
        decimals={decimals}
        duration={duration}
        preserveValue={true}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  label: {
    fontSize: "0.8em",
    opacity: 0.6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  loading: {
    opacity: 0.4,
    fontSize: "1.2em",
  },
  error: {
    color: "#f87171",
    fontSize: "0.75em",
  },
};
