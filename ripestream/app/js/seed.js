/* Reference data and starter content.
 *
 * Honesty rule: starter content is written by the RipeStream team, posted from
 * team accounts that are badged "Team" everywhere they appear, and every starter
 * post is labelled "Starter". There are no invented members.
 */

export const TOPICS = [
  ['technology', 'Technology'], ['cars', 'Cars'], ['fitness', 'Fitness'], ['running', 'Running'],
  ['football', 'Football'], ['gaa', 'GAA'], ['cycling', 'Cycling'], ['gaming', 'Gaming'],
  ['food', 'Food'], ['travel', 'Travel'], ['music', 'Music'], ['photography', 'Photography'],
  ['diy', 'DIY & Home'], ['parenting', 'Parenting'], ['careers', 'Careers'], ['business', 'Business'],
  ['transport', 'Transport'], ['outdoors', 'Outdoors']
];
export const TOPIC_NAME = Object.fromEntries(TOPICS);

/* Broad areas only. Never a pin, never an address. parent = county. */
export const AREAS = [
  ['dublin', 'Dublin (county)', null],
  ['dublin-city', 'Dublin City', 'dublin'], ['clondalkin', 'Clondalkin', 'dublin'], ['tallaght', 'Tallaght', 'dublin'],
  ['lucan', 'Lucan', 'dublin'], ['blanchardstown', 'Blanchardstown', 'dublin'], ['swords', 'Swords', 'dublin'],
  ['dun-laoghaire', 'Dún Laoghaire', 'dublin'], ['rathmines', 'Rathmines', 'dublin'], ['finglas', 'Finglas', 'dublin'],
  ['cork', 'Cork (county)', null], ['cork-city', 'Cork City', 'cork'], ['ballincollig', 'Ballincollig', 'cork'],
  ['galway', 'Galway (county)', null], ['galway-city', 'Galway City', 'galway'],
  ['limerick', 'Limerick', null], ['waterford', 'Waterford', null], ['kildare', 'Kildare', null],
  ['maynooth', 'Maynooth', 'kildare'], ['naas', 'Naas', 'kildare'], ['meath', 'Meath', null], ['wicklow', 'Wicklow', null],
  ['bray', 'Bray', 'wicklow'], ['louth', 'Louth', null], ['kerry', 'Kerry', null], ['mayo', 'Mayo', null],
  ['donegal', 'Donegal', null], ['sligo', 'Sligo', null], ['kilkenny', 'Kilkenny', null], ['wexford', 'Wexford', null],
  ['tipperary', 'Tipperary', null], ['clare', 'Clare', null], ['westmeath', 'Westmeath', null], ['other-ie', 'Elsewhere in Ireland', null]
];
export const AREA = Object.fromEntries(AREAS.map(([id, name, parent]) => [id, { id, name, parent }]));
export const parentOf = (id) => (AREA[id] && AREA[id].parent) || null;

export const COMMUNITIES = [
  // Interests
  { id: 'c-running', name: 'Running Ireland', emoji: '🏃', category: 'Fitness', topics: ['running', 'fitness'], description: 'parkruns, plans, routes and race-day nerves. All paces welcome.' },
  { id: 'c-lifting', name: 'Lifting & Gym', emoji: '🏋️', category: 'Fitness', topics: ['fitness'], description: 'Programmes, form checks, gym recommendations. No supplement shilling.' },
  { id: 'c-football', name: 'League of Ireland', emoji: '⚽', category: 'Sport', topics: ['football'], description: 'Matchday chat, away-day lifts, and the domestic game done properly.' },
  { id: 'c-gaa', name: 'GAA Chat', emoji: '🏑', category: 'Sport', topics: ['gaa'], description: 'Club and county. Fixtures, results, and the eternal referee debate.' },
  { id: 'c-cycling', name: 'Cycling Ireland', emoji: '🚴', category: 'Fitness', topics: ['cycling', 'outdoors'], description: 'Commutes, greenways, club spins, and bike-shop recommendations.' },
  { id: 'c-cars', name: 'Cars Ireland', emoji: '🚗', category: 'Interests', topics: ['cars'], description: 'NCT survival, honest mechanics, EV questions and weekend projects.' },
  { id: 'c-tech', name: 'Tech Ireland', emoji: '💻', category: 'Interests', topics: ['technology', 'careers'], description: 'Building, buying and working in tech in Ireland.' },
  { id: 'c-gaming', name: 'Gaming Ireland', emoji: '🎮', category: 'Interests', topics: ['gaming'], description: 'What you are playing, LAN nights, and finding a squad.' },
  { id: 'c-photo', name: 'Photography Ireland', emoji: '📷', category: 'Interests', topics: ['photography', 'outdoors'], description: 'Share shots, get useful critique, find locations.' },
  { id: 'c-diy', name: 'DIY & Home', emoji: '🔨', category: 'Life', topics: ['diy'], description: 'Renovations, tradespeople worth calling, and fixes that worked.' },
  { id: 'c-parents', name: 'Parents Ireland', emoji: '🧸', category: 'Life', topics: ['parenting'], description: 'Childcare, schools, and 3am questions answered by people who get it.' },
  { id: 'c-careers', name: 'Careers Ireland', emoji: '💼', category: 'Life', topics: ['careers', 'business'], description: 'CVs, interviews, salaries and switching careers — honestly.' },
  { id: 'c-food', name: 'Food Ireland', emoji: '🍽️', category: 'Life', topics: ['food'], description: 'Where to eat, what to cook, and the chipper rankings nobody agrees on.' },
  { id: 'c-travel', name: 'Travel from Ireland', emoji: '✈️', category: 'Life', topics: ['travel'], description: 'Routes, deals, airport tips and trip reports.' },
  // Local
  { id: 'c-dublin', name: 'Dublin', emoji: '🏙️', category: 'Local', topics: ['transport', 'food'], area: 'dublin', description: 'What is on, what is changing, and what is closed on the M50 today.' },
  { id: 'c-clondalkin', name: 'Clondalkin', emoji: '📍', category: 'Local', topics: [], area: 'clondalkin', description: 'Neighbourhood notices, clubs, lost & found and local questions.' },
  { id: 'c-tallaght', name: 'Tallaght', emoji: '📍', category: 'Local', topics: [], area: 'tallaght', description: 'Neighbourhood notices, clubs, lost & found and local questions.' },
  { id: 'c-lucan', name: 'Lucan', emoji: '📍', category: 'Local', topics: [], area: 'lucan', description: 'Neighbourhood notices, clubs, lost & found and local questions.' },
  { id: 'c-cork', name: 'Cork', emoji: '🏙️', category: 'Local', topics: [], area: 'cork', description: 'The real capital. Events, food, sport and local news.' },
  { id: 'c-galway', name: 'Galway', emoji: '🏙️', category: 'Local', topics: [], area: 'galway', description: 'Gigs, sessions, the Prom, and when the rain will stop (never).' }
].map((c) => ({
  ...c,
  rules: [
    'Be decent. Disagree with ideas, not people.',
    'No spam or undisclosed self-promotion.',
    'Stay on topic for this community.',
    'No personal information about others — including exact addresses.'
  ],
  mods: ['u-team']
}));

export const TEAM = [
  { id: 'u-team', name: 'RipeStream Team', handle: 'ripestream', bio: 'The people building RipeStream. We post starter questions to get communities going — we are not pretending to be members.', team: true, interests: [], area: null, color: '#ff5b1f' },
  { id: 'u-guide-dublin', name: 'RipeStream Dublin guide', handle: 'dublin.guide', bio: 'Team account that seeds local Dublin discussion until locals take over.', team: true, interests: ['transport'], area: 'dublin-city', color: '#6b3fa0' }
];

/* hoursAgo is relative to first open of the preview, so a starter post never looks a month stale. */
export const STARTER_POSTS = [
  { author: 'u-team', community: 'c-running', hoursAgo: 3, kind: 'question', text: 'Which parkrun do you do, and what is the one thing you wish someone told you before your first? Answers here help the next person who joins.' },
  { author: 'u-team', community: 'c-cars', hoursAgo: 6, kind: 'question', text: 'NCT next month on a 2014 diesel. What actually fails cars most often, and what is worth checking yourself before booking?' },
  { author: 'u-team', community: 'c-tech', hoursAgo: 9, kind: 'question', text: 'If you work in tech in Ireland: remote, hybrid or office in 2026? And did it change what you would accept salary-wise?' },
  { author: 'u-team', community: 'c-food', hoursAgo: 12, kind: 'question', text: 'Name one place outside the city centre that does food better than anywhere in it. Area + dish, that is all we need.' },
  { author: 'u-guide-dublin', community: 'c-dublin', area: 'dublin-city', hoursAgo: 2, kind: 'question', text: 'Roadworks, Luas or bus changes affecting your commute this week? Post them here so everyone heading the same way knows.' },
  { author: 'u-guide-dublin', community: 'c-clondalkin', area: 'clondalkin', hoursAgo: 5, kind: 'question', text: 'Clondalkin: which clubs are taking new members this season? Sports, scouts, choirs, anything. Clubs can reply directly.' },
  { author: 'u-guide-dublin', community: 'c-tallaght', area: 'tallaght', hoursAgo: 8, kind: 'question', text: 'Tallaght: lost & found thread for the week. Lost a pet, keys or a bike? Post area (not your address) and a description.' },
  { author: 'u-guide-dublin', community: 'c-lucan', area: 'lucan', hoursAgo: 14, kind: 'question', text: 'Lucan: best spot for a weekend walk with kids? Bonus points if there is coffee at the end.' },
  { author: 'u-team', community: 'c-cork', area: 'cork-city', hoursAgo: 10, kind: 'question', text: 'Cork: what is on this weekend that people outside Cork would never hear about?' },
  { author: 'u-team', community: 'c-galway', area: 'galway-city', hoursAgo: 15, kind: 'question', text: 'Galway: best trad session that is not packed with tourists? (We will not tell anyone. Much.)' },
  { author: 'u-team', community: 'c-gaa', hoursAgo: 20, kind: 'question', text: 'Club volunteers: what does your club struggle to find people for? Some members here might be able to help.' },
  { author: 'u-team', community: 'c-careers', hoursAgo: 26, kind: 'question', text: 'What was your salary jump when you last changed jobs, and what role? Anonymous-ish ranges are fine. Pay transparency helps everyone.' },
  { author: 'u-guide-dublin', community: 'c-cycling', area: 'dublin-city', hoursAgo: 4, kind: 'event', text: 'Easy-pace social spin along the canal for anyone new to group riding. No-drop, coffee after. Team-organised to get the community started.', event: { title: 'Beginner-friendly canal spin', inDays: 4, time: '10:00', place: 'Grand Canal, Dublin City' } },
  { author: 'u-team', community: 'c-photo', hoursAgo: 30, kind: 'question', text: 'Post your best shot from this week — phone photos count. Say what you would change about it and people will tell you if you are right.' }
];
