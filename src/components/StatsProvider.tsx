import React, { useEffect, useState } from "react";
import { DataProvider } from "@plasmicapp/host";

interface StatsProviderProps {
  children: React.ReactNode;
  className?: string;
}

export function StatsProvider({ children, className }: StatsProviderProps) {
  const [stats, setStats] = useState({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${window.location.origin}/stream`);
    
    es.onopen = () => setConnected(true);
    
    es.onmessage = (e) => {
      try {
        setStats(JSON.parse(e.data));
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // retry after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    return () => es.close();
  }, []);

  return (
    <DataProvider name="stats" data={{ ...stats, connected }}>
      <div className={className ?? ""}>{children}</div>
    </DataProvider>
  );
}
