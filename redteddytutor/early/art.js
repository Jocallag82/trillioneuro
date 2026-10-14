// Flat illustrations for Little World's Look and Name cards. One shape language:
// soft ink outline (#3a2a24), flat fills, one highlight. viewBox 0 0 200 200.
const O = 'stroke="#3a2a24" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="#3a2a24"/><circle cx="${x + 2}" cy="${y - 2}" r="2" fill="#fff"/>`;

export const ART = {
  apple: `<path d="M100 62c-14-12-58-12-62 30-4 40 26 76 46 76 8 0 10-4 16-4s8 4 16 4c20 0 50-36 46-76-4-42-48-42-62-30z" fill="#d23b3b" ${O}/><path d="M100 62c0-14 4-24 12-32" fill="none" ${O}/><path d="M106 48c10-14 28-16 36-12-6 14-22 18-36 12z" fill="#4f9a4a" ${O}/><ellipse cx="66" cy="96" rx="9" ry="16" fill="#fff" opacity=".35"/>`,
  duck: `<ellipse cx="96" cy="128" rx="62" ry="38" fill="#f6cf3c" ${O}/><circle cx="132" cy="78" r="30" fill="#f6cf3c" ${O}/><path d="M158 80l28 6-28 10z" fill="#ee8a2b" ${O}/>${eye(140, 70)}<path d="M66 122c14 14 36 14 48 2" fill="none" ${O}/>`,
  ball: `<circle cx="100" cy="104" r="64" fill="#3b78c4" ${O}/><path d="M40 92c40 18 80 18 120 0M54 150c20-40 72-72 106-72" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".85"/><circle cx="100" cy="104" r="64" fill="none" ${O}/>`,
  cow: `<ellipse cx="100" cy="112" rx="58" ry="52" fill="#fbf6ec" ${O}/><path d="M56 70c-18-8-30-2-30 8 10 4 22 4 32-2M144 70c18-8 30-2 30 8-10 4-22 4-32-2" fill="#fbf6ec" ${O}/><path d="M70 64c-4-12 0-20 6-24M130 64c4-12 0-20-6-24" fill="none" ${O}/><ellipse cx="74" cy="104" rx="16" ry="12" fill="#3a2a24"/><ellipse cx="100" cy="146" rx="40" ry="24" fill="#f2a7a7" ${O}/>${eye(80, 92)}${eye(120, 92)}<circle cx="86" cy="146" r="5" fill="#3a2a24"/><circle cx="114" cy="146" r="5" fill="#3a2a24"/>`,
  sun: `<g ${O}><path d="M100 18v22M100 160v22M18 100h22M160 100h22M42 42l16 16M142 142l16 16M42 158l16-16M142 58l16-16" fill="none"/></g><circle cx="100" cy="100" r="46" fill="#f6cf3c" ${O}/><path d="M82 110c10 10 26 10 36 0" fill="none" ${O}/>${eye(84, 92)}${eye(116, 92)}`,
  cat: `<path d="M50 70l6-44 30 26h28l30-26 6 44c10 18 10 46-6 64-16 18-72 18-88 0-16-18-16-46-6-64z" fill="#ee8a2b" ${O}/><path d="M100 118l-8-8h16z" fill="#f2a7a7" ${O}/><path d="M100 118v8c-4 8-14 8-18 2M100 126c4 8 14 8 18 2M60 112h-30M62 122l-28 8M140 112h30M138 122l28 8" fill="none" ${O}/>${eye(78, 96)}${eye(122, 96)}`,
  leaf: `<path d="M40 162C40 80 90 34 170 30c4 80-40 132-122 132z" fill="#4f9a4a" ${O}/><path d="M40 162C80 120 120 80 150 52M90 112l-4-30M112 90l20 2" fill="none" ${O}/>`,
  fish: `<path d="M30 100c26-40 92-50 124 0-32 50-98 40-124 0z" fill="#ee8a2b" ${O}/><path d="M152 100l32-28v56z" fill="#f6cf3c" ${O}/>${eye(64, 92)}<path d="M96 76c10 14 10 34 0 48M116 80c8 12 8 28 0 40" fill="none" ${O}/>`,
  star: `<path d="M100 22l22 50 54 4-42 34 14 54-48-30-48 30 14-54-42-34 54-4z" fill="#f6cf3c" ${O}/><path d="M86 112c8 8 20 8 28 0" fill="none" ${O}/>${eye(86, 96)}${eye(114, 96)}`,
  sheep: `<g fill="#fbf6ec" ${O}><circle cx="62" cy="96" r="24"/><circle cx="92" cy="80" r="26"/><circle cx="126" cy="84" r="24"/><circle cx="146" cy="110" r="22"/><circle cx="120" cy="132" r="24"/><circle cx="80" cy="130" r="26"/></g><ellipse cx="54" cy="116" rx="24" ry="28" fill="#3a2a24"/>${eye(46, 110)}<path d="M84 154v24M118 154v24" ${O}/>`,
  circle: `<circle cx="100" cy="100" r="66" fill="#d23b3b" ${O}/><circle cx="76" cy="76" r="12" fill="#fff" opacity=".35"/>`,
  bear: `<circle cx="56" cy="56" r="24" fill="#a3171f" ${O}/><circle cx="144" cy="56" r="24" fill="#a3171f" ${O}/><circle cx="56" cy="56" r="11" fill="#e7a07e"/><circle cx="144" cy="56" r="11" fill="#e7a07e"/><circle cx="100" cy="106" r="66" fill="#a3171f" ${O}/><ellipse cx="100" cy="128" rx="32" ry="24" fill="#e7a07e" ${O}/><ellipse cx="100" cy="116" rx="11" ry="8" fill="#3a2a24"/><path d="M100 124v8M88 138c6 6 18 6 24 0" fill="none" ${O}/>${eye(76, 94)}${eye(124, 94)}`,
};

export const svg = (name, label) =>
  `<svg viewBox="0 0 200 200" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${ART[name]}</svg>`;
