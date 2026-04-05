// components/PortBadges.tsx

interface Port {
  host: string;
  container: string;
  protocol: string;
}

interface PortBadgesProps {
  ports: string;           // raw string from Glances e.g. "443->443/tcp,80->80/tcp"
  className?: string;      // override container styles
  badgeClassName?: string; // override individual badge styles
}

function parsePorts(raw: string): Port[] {
  if (!raw || raw === "--") return [];

  return raw.split(",").map((entry) => {
    // handles: "443->443/tcp" or "8000/tcp" (no mapping)
    const protoSplit = entry.split("/");
    const protocol = protoSplit[1] ?? "tcp";
    const mapping = protoSplit[0];

    if (mapping.includes("->")) {
      const [host, container] = mapping.split("->");
      return { host, container, protocol };
    } else {
      return { host: mapping, container: mapping, protocol };
    }
  });
}

export default function PortBadges({
  ports,
  className,
  badgeClassName,
}: PortBadgesProps) {
  const parsed = parsePorts(ports);

  if (parsed.length === 0) return <span className="text-gray-500">—</span>;

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {parsed.map((p, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono 
            bg-white/10 text-white/70 border border-white/10 ${badgeClassName ?? ""}`}
        >
          {p.host === p.container ? p.host : `${p.host}→${p.container}`}
          <span className="text-white/30">{p.protocol}</span>
        </span>
      ))}
    </div>
  );
}
