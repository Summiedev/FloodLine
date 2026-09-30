function required(name: 'VITE_API_BASE_URL'): string {
  const value = import.meta.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Copy .env.example to .env and set it.`);
  return value.replace(/\/$/, '');
}

export const env = {
  apiBaseUrl: required('VITE_API_BASE_URL'),
  mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() || null,
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  demoNavigationSeconds: Math.max(60, Number(import.meta.env.VITE_DEMO_NAVIGATION_SECONDS) || 1800),
} as const;
