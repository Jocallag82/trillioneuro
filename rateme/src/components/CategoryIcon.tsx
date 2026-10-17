const PATHS: Record<string, string> = {
  'trades-home-services': 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1 2.5-2.5Z',
  automotive: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a2 2 0 0 1 2 2v4h-2v2h-3v-2H8v2H5v-2H3v-4a2 2 0 0 1 2-2Zm2 3.5h.01M17 14.5h.01',
  'restaurants-cafes': 'M4 3v8a3 3 0 0 0 3 3v7M7 3v6M10 3v8a3 3 0 0 1-3 3M17 21V3c-2.2 1-3.5 3.6-3.5 7v4H17',
  'health-personal-care': 'M12 21s-7.5-4.6-9.3-9.4C1.6 8.5 3.6 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.4 3.5 4.3 6.6C19.5 16.4 12 21 12 21Z',
  'beauty-salons': 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm2.1-8.1L20 19M8.1 17.1 20 5',
  retail: 'M5 7h14l-1.2 12.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7Zm4 0V6a3 3 0 0 1 6 0v1',
  'professional-services': 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  hospitality: 'M3 18h18M5 18v-6a7 7 0 0 1 14 0v6M12 5V3',
  'education-training': 'M2 9l10-5 10 5-10 5L2 9Zm4 2.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5',
  'other-services': 'M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8L7 19l1-5.7-4-4 5.4-.7L12 3Z',
};

export function CategoryIcon({ slug, size = 26 }: { slug: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[slug] ?? PATHS['other-services']} />
    </svg>
  );
}
