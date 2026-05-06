import React, { useEffect, useState } from "react";
import { DataProvider } from "@plasmicapp/host";

interface StatsProviderProps {
  children: React.ReactNode;
  className?: string;
}

interface Stats {
  cpu: { percent: number; temp: number | null };
  mem: { percent: number; used: number; total: number };
  disk: { percent: number; used: number; total: number };
  containers: unknown[];
}

const initialStats: Stats = {
  cpu: { percent: 0, temp: null },
  mem: { percent: 0, used: 0, total: 0 },
  disk: { percent: 0, used: 0, total: 0 },
  containers: [],
};

export function StatsProvider({ children, className }: StatsProviderProps) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`${window.location.origin}/stream`);

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (e) => {
      try {
        setStats(JSON.parse(e.data));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to parse stats");
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => es.close();
  }, []);

  return (
    <DataProvider name="stats" data={{ ...stats, connected, error }}>
      <div className={className ?? ""}>{children}</div>
    </DataProvider>
  );
}
