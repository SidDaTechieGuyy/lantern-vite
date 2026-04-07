import { PlasmicCanvasHost, registerComponent } from "@plasmicapp/host";
import { AnimatedStat } from "@/components/AnimatedStat";
import { DonutStatCard } from "@/components/DonutStatCard";
import PortBadges from "@/components/PortBadges";
import { StatsProvider } from "@/components/StatsProvider";

registerComponent(AnimatedStat, {
  name: "AnimatedStat",
  importPath: "@/components/AnimatedStat",
  props: {
    value: { type: "number", defaultValue: 0 },
    suffix: { type: "string", defaultValue: "%" },
    prefix: { type: "string", defaultValue: "" },
    decimals: { type: "number", defaultValue: 1 },
    divisor: { type: "number", defaultValue: 1 },
    duration: { type: "number", defaultValue: 0.3 },
    label: { type: "string", defaultValue: "Label" },
    className: { type: "string" },
  },
});


registerComponent(DonutStatCard, {
  name: "DonutStatCard",
  importPath: "@/components/DonutStatCard",
  props: {
    glancesUrl: { type: "string", defaultValue: "http://localhost:61208" },
    endpoint: { type: "string", defaultValue: "cpu" },
    dataKey: { type: "string", defaultValue: "total" },
    duration: { type: "number", defaultValue: 0.6 },
    label: { type: "string", defaultValue: "CPU" },
    tick: { type: "number", defaultValue: 0 },
    className: { type: "string" },
    style: { type: "object" },
    staticValue: { type: "number" },
    emptyColor: { type: "string", defaultValue: "rgba(255,255,255,0.06)" },
    innerRadius: { type: "number", defaultValue: 32 },
    outerRadius: { type: "number", defaultValue: 44 },
    showValue: { type: "boolean", defaultValue: true },
    gradientStart: { type: "string", defaultValue: "#2dd4bf" },
    gradientMid: { type: "string", defaultValue: "#facc15" },
    gradientEnd: { type: "string", defaultValue: "#ef4444" },
  },
});

registerComponent(PortBadges, {
  name: "PortBadges",
  importPath: "@/components/PortBadges",
  providesData: true,  // THIS is what was missing
  props: {
    ports: { type: "string", defaultValue: "443->443/tcp,80->80/tcp" },
    className: { type: "string" },
    children: { type: "slot" },
  },
});

registerComponent(StatsProvider, {
  name: "StatsProvider",
  importPath: "@/components/StatsProvider",
  providesData: true,
  props: {
    children: { type: "slot" },
    className: { type: "string" },
  },
});

export default function PlasmicHost() {
  return <PlasmicCanvasHost />;
}
