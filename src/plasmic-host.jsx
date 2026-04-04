import { PlasmicCanvasHost, registerComponent } from "@plasmicapp/host";
import { AnimatedStat } from "./components/AnimatedStat";

registerComponent(AnimatedStat, {
  name: "AnimatedStat",
  importPath: "./components/AnimatedStat",
  props: {
    glancesUrl: { type: "string", defaultValue: "http://localhost:61208" },
    endpoint: { type: "string", defaultValue: "cpu" },
    dataKey: { type: "string", defaultValue: "total" },
    staticValue: { type: "number" },
    suffix: { type: "string", defaultValue: "%" },
    prefix: { type: "string", defaultValue: "" },
    decimals: { type: "number", defaultValue: 1 },
    divisor: { type: "number", defaultValue: 1 },
    duration: { type: "number", defaultValue: 0.6 },
    label: { type: "string", defaultValue: "CPU Usage" },
    tick: { type: "number", defaultValue: 0 }, // 👈 add this alongside the others
    className: { type: "string" }, // 👈 added
  },
});

export default function PlasmicHost() {
  return <PlasmicCanvasHost />;
}
