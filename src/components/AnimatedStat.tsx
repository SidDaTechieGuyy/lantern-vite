import React from "react";
import CountUp from "react-countup";

interface AnimatedStatProps {
  value?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  divisor?: number;
  duration?: number;
  label?: string;
  className?: string;
}

export function AnimatedStat({
  value = 0,
  suffix = "",
  prefix = "",
  decimals = 1,
  divisor = 1,
  duration = 0.3,
  label = "",
  className,
}: AnimatedStatProps) {
  return (
    <div style={styles.wrapper} className={className}>
      {label && <div style={styles.label}>{label}</div>}
      <CountUp
        end={value / divisor}
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
};
