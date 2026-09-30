const TENANT_COLORS: Record<string, string> = {
  'acme-corp': '#2563eb',
  'globex-ltd': '#16a34a',
  initech: '#dc2626',
};

const FALLBACK_PALETTE = ['#7c3aed', '#db2777', '#ea580c', '#0891b2', '#4f46e5', '#65a30d'];

export const DEFAULT_ACCENT = '#0f172a';

export function getTenantColor(slug: string | null | undefined): string {
  if (!slug) return DEFAULT_ACCENT;
  const known = TENANT_COLORS[slug];
  if (known) return known;
  // Stable hash so unknown tenants always get the same color.
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

/** Converts `#rrggbb` into `r g b`, the format Tailwind's `<alpha-value>` expects. */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function applyAccentColor(slug: string | null | undefined): void {
  document.documentElement.style.setProperty('--tv-accent', hexToRgbTriplet(getTenantColor(slug)));
}
