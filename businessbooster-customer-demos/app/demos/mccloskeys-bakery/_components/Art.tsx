/**
 * Original, code-drawn still-life artwork. PROVISIONAL: stands in for commissioned product
 * photography, which must be supplied or licensed before any live launch. Rendered server-side
 * inside the gated route, so no customer imagery is ever served from /public.
 */
import { useId } from "react";

export type ArtKind =
  | "hero"
  | "cream"
  | "chocolate"
  | "mandarin"
  | "celebration"
  | "loaf"
  | "soda"
  | "rolls"
  | "brack"
  | "cafe"
  | "trade";

const BG: Record<ArtKind, string> = {
  hero: "#e9dcc6",
  cream: "#efe4d3",
  chocolate: "#e7d6c4",
  mandarin: "#f1dfc6",
  celebration: "#eadfd2",
  loaf: "#e6d7bf",
  soda: "#e9dcc6",
  rolls: "#ecdfca",
  brack: "#e6d4bd",
  cafe: "#ddd3c2",
  trade: "#d9cfbd",
};

function Grain({ id }: { id: string }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0.14 0" />
      <feComposite in2="SourceGraphic" operator="in" />
    </filter>
  );
}

function Cake({ top, sponge, filling, decor }: { top: string; sponge: string; filling: string; decor?: React.ReactNode }) {
  return (
    <g>
      <ellipse cx="300" cy="372" rx="210" ry="34" fill="#000" opacity="0.10" />
      <ellipse cx="300" cy="352" rx="200" ry="30" fill="#f7f1e7" />
      <ellipse cx="300" cy="346" rx="200" ry="30" fill="#fffaf2" />
      <path d="M140 230 v100 a160 26 0 0 0 320 0 v-100 z" fill={sponge} />
      <path d="M140 268 a160 26 0 0 0 320 0 v14 a160 26 0 0 1 -320 0 z" fill={filling} />
      <path d="M140 230 a160 26 0 0 0 320 0" fill="none" stroke={top} strokeWidth="18" />
      <ellipse cx="300" cy="230" rx="160" ry="26" fill={top} />
      {decor}
    </g>
  );
}

function Rosettes({ color, accent }: { color: string; accent?: string }) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    return [300 + Math.cos(a) * 128, 230 + Math.sin(a) * 19];
  });
  return (
    <g>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={(y ?? 0) - 6} r="13" fill={color} />
          <circle cx={x} cy={(y ?? 0) - 10} r="7" fill="#fff" opacity="0.55" />
          {accent && <circle cx={x} cy={(y ?? 0) - 20} r="6" fill={accent} />}
        </g>
      ))}
    </g>
  );
}

function Loaf({ x = 300, y = 300, scale = 1, crust = "#a55a2a", score = "#e9c58e" }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="62" rx="170" ry="20" fill="#000" opacity="0.12" />
      <path d="M-165 50 C-170 -40 -100 -80 0 -80 C100 -80 170 -40 165 50 Z" fill={crust} />
      <path d="M-150 40 C-150 -30 -90 -64 0 -64 C 90 -64 150 -30 150 40" fill="none" stroke="#7c3f1b" strokeWidth="6" opacity="0.35" />
      {[-90, -30, 30, 90].map((sx) => (
        <path key={sx} d={`M${sx - 22} -40 Q ${sx} -62 ${sx + 26} -46`} stroke={score} strokeWidth="9" fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
}

function Soda() {
  return (
    <g>
      <ellipse cx="300" cy="350" rx="170" ry="24" fill="#000" opacity="0.12" />
      <path d="M140 330 C120 200 220 150 300 150 C380 150 480 200 460 330 Z" fill="#b97a45" />
      <path d="M300 160 V330 M150 260 H450" stroke="#e8c79a" strokeWidth="14" strokeLinecap="round" opacity="0.9" />
      <path d="M140 330 C120 200 220 150 300 150" fill="none" stroke="#7c3f1b" strokeWidth="6" opacity="0.3" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={170 + ((i * 47) % 260)} cy={190 + ((i * 29) % 130)} r="2.2" fill="#f5e6cc" opacity="0.7" />
      ))}
    </g>
  );
}

function Rolls() {
  const rolls = [
    [210, 300],
    [330, 290],
    [270, 230],
    [400, 240],
  ];
  return (
    <g>
      <ellipse cx="300" cy="360" rx="200" ry="22" fill="#000" opacity="0.12" />
      {rolls.map(([cx, cy], i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy} rx="78" ry="56" fill={i % 2 ? "#b8733d" : "#c68650"} />
          <path d={`M${(cx ?? 0) - 40} ${(cy ?? 0) - 12} Q ${cx} ${(cy ?? 0) - 40} ${(cx ?? 0) + 42} ${(cy ?? 0) - 10}`} stroke="#f0d3a6" strokeWidth="8" fill="none" strokeLinecap="round" />
          {Array.from({ length: 12 }, (_, j) => (
            <ellipse key={j} cx={(cx ?? 0) - 40 + ((j * 23) % 80)} cy={(cy ?? 0) - 30 + ((j * 13) % 30)} rx="3" ry="1.6" fill="#fff6e6" opacity="0.8" />
          ))}
        </g>
      ))}
    </g>
  );
}

function Brack() {
  return (
    <g>
      <ellipse cx="300" cy="350" rx="190" ry="22" fill="#000" opacity="0.12" />
      <rect x="130" y="180" width="340" height="160" rx="26" fill="#6b3d22" />
      <rect x="130" y="180" width="340" height="40" rx="20" fill="#8a4f2b" />
      <path d="M440 190 v148 h30 v-130 a20 20 0 0 0 -20 -18z" fill="#c49461" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={150 + ((i * 53) % 290)} cy={230 + ((i * 37) % 100)} r={4 + (i % 3)} fill={i % 2 ? "#2a1408" : "#9b2f1e"} opacity="0.85" />
      ))}
    </g>
  );
}

function Cup({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="70" rx="90" ry="16" fill="#000" opacity="0.1" />
      <ellipse cx="0" cy="62" rx="84" ry="16" fill="#fffaf2" />
      <path d="M-55 -10 h110 l-10 70 a45 12 0 0 1 -90 0z" fill="#f7f1e7" />
      <ellipse cx="0" cy="-10" rx="55" ry="12" fill="#5a3b26" />
      <ellipse cx="-8" cy="-12" rx="22" ry="5" fill="#c89a6c" opacity="0.8" />
      <path d="M55 5 q34 2 22 30 q-8 14 -26 14" fill="none" stroke="#f7f1e7" strokeWidth="10" />
    </g>
  );
}

function Crate() {
  return (
    <g>
      <ellipse cx="300" cy="372" rx="230" ry="22" fill="#000" opacity="0.12" />
      <rect x="90" y="250" width="420" height="120" rx="8" fill="#5d6b4e" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="104" y={262 + i * 36} width="392" height="22" rx="3" fill="#4b583e" />
      ))}
      <Loaf x={210} y={220} scale={0.6} />
      <Loaf x={390} y={214} scale={0.6} crust="#8f4a21" />
      <Loaf x={300} y={190} scale={0.58} crust="#b9703a" />
    </g>
  );
}

export function Art({ kind, className, label }: { kind: ArtKind; className?: string; label: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 600 420" role="img" aria-label={label} className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <Grain id={`g${id}`} />
        <radialGradient id={`l${id}`} cx="30%" cy="20%" r="90%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="420" fill={BG[kind]} />
      <rect y="300" width="600" height="120" fill="#000" opacity="0.04" />
      <rect width="600" height="420" fill={`url(#l${id})`} />
      {kind === "hero" && (
        <g>
          <Loaf x={230} y={280} scale={0.9} />
          <Cup x={470} y={290} />
        </g>
      )}
      {kind === "cream" && <Cake top="#fffaf0" sponge="#f1d39b" filling="#fff7ea" decor={<Rosettes color="#fffaf0" accent="#c0392b" />} />}
      {kind === "mandarin" && <Cake top="#fff8ec" sponge="#f3d7a2" filling="#f4a24a" decor={<Rosettes color="#fff8ec" accent="#ef8a2f" />} />}
      {kind === "chocolate" && <Cake top="#3b2416" sponge="#5a3622" filling="#e9d3b8" decor={<Rosettes color="#4e301e" accent="#e9d3b8" />} />}
      {kind === "celebration" && (
        <Cake
          top="#fbf3ec"
          sponge="#f2d7ab"
          filling="#f6e7ea"
          decor={
            <g>
              <Rosettes color="#f8e6ea" />
              {[250, 290, 330, 370].map((x, i) => (
                <g key={x}>
                  <rect x={x - 4} y={150 - (i % 2) * 8} width="8" height="70" rx="3" fill={i % 2 ? "#5d6b4e" : "#a55a2a"} />
                  <path d={`M${x} ${136 - (i % 2) * 8} q8 10 0 16 q-8 -6 0 -16`} fill="#f2a93b" />
                </g>
              ))}
            </g>
          }
        />
      )}
      {kind === "loaf" && <Loaf x={300} y={290} />}
      {kind === "soda" && <Soda />}
      {kind === "rolls" && <Rolls />}
      {kind === "brack" && <Brack />}
      {kind === "cafe" && (
        <g>
          <Cup x={230} y={280} />
          <Cup x={400} y={300} />
        </g>
      )}
      {kind === "trade" && <Crate />}
      <rect width="600" height="420" filter={`url(#g${id})`} />
    </svg>
  );
}
