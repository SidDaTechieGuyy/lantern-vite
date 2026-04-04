import { PlasmicCanvasHost, registerComponent } from "@plasmicapp/react-web/lib/host";
import { AnimatedStat } from "./components/AnimatedStat";

// Register your custom components here
registerComponent(AnimatedStat, {
  name: "AnimatedStat",
  importPath: "./components/AnimatedStat", // 👈 important for codegen!
  props: {
    glancesUrl: {
      type: "string",
      defaultValue: "http://localhost:61208",
    },
    endpoint: {
      type: "string",
      defaultValue: "cpu",
    },
    dataKey: {
      type: "string",
      defaultValue: "total",
    },
    suffix: { type: "string", defaultValue: "%" },
    prefix: { type: "string", defaultValue: "" },
    decimals: { type: "number", defaultValue: 1 },
    divisor: { type: "number", defaultValue: 1 },
    duration: { type: "number", defaultValue: 0.6 },
    label: { type: "string", defaultValue: "CPU Usage" },
    refreshInterval: { type: "number", defaultValue: 2000 },
  },
});

export default function PlasmicHost() {
  return <PlasmicCanvasHost />;
}
