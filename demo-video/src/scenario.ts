export type Coordinate = { longitude: number; latitude: number }

// These values intentionally mirror backend/prisma/demo-seed.ts and
// backend/src/modules/demo/demo.constants.ts. The Remotion composition is a
// deterministic visual layer for the same controlled hackathon scenario.
export const scenario = {
  origin: { longitude: 3.3515, latitude: 6.6018, label: 'Ikeja' },
  destination: { longitude: 3.3788, latitude: 6.5088, label: 'Yaba' },
  officialWarning: {
    title: 'Controlled advisory: flooding near inland Lagos routes',
    authority: 'FloodLine Demo Authority',
    geometry: [
      { longitude: 3.33, latitude: 6.49 },
      { longitude: 3.40, latitude: 6.49 },
      { longitude: 3.40, latitude: 6.62 },
      { longitude: 3.33, latitude: 6.62 },
    ] as Coordinate[],
  },
  incidents: [
    {
      id: '10000000-0000-4000-8000-000000000011',
      label: 'Oshodi Interchange',
      type: 'MODERATE_FLOODING',
      severity: 'MODERATE',
      coordinates: { longitude: 3.3435, latitude: 6.5555 },
      confidence: 'HIGH',
      confirmations: 8,
    },
    {
      id: '10000000-0000-4000-8000-000000000012',
      label: 'Ikeja GRA access road',
      type: 'BLOCKED_DRAIN',
      severity: 'MODERATE',
      coordinates: { longitude: 3.348, latitude: 6.615 },
      confidence: 'MEDIUM',
      confirmations: 4,
    },
    {
      id: '10000000-0000-4000-8000-000000000013',
      label: 'Ojota interchange',
      type: 'BLOCKED_ROAD',
      severity: 'HIGH',
      coordinates: { longitude: 3.394, latitude: 6.588 },
      confidence: 'MEDIUM',
      confirmations: 5,
    },
    {
      id: '10000000-0000-4000-8000-000000000010',
      label: 'Flood hazard on the fast Ikeja–Yaba route',
      type: 'SEVERE_FLOODING',
      severity: 'SEVERE',
      coordinates: { longitude: 3.378719, latitude: 6.587862 },
      confidence: 'HIGH',
      confirmations: 14,
    },
  ],
  routes: {
    // Representative points sampled from the same inland route scenario.
    fast: [
      { longitude: 3.3515, latitude: 6.6018 },
      { longitude: 3.360967, latitude: 6.592825 },
      { longitude: 3.372892, latitude: 6.592066 },
      { longitude: 3.378719, latitude: 6.587862 },
      { longitude: 3.374894, latitude: 6.582361 },
      { longitude: 3.366899, latitude: 6.555491 },
      { longitude: 3.367406, latitude: 6.520225 },
      { longitude: 3.3788, latitude: 6.5088 },
    ] as Coordinate[],
    alternative: [
      { longitude: 3.3515, latitude: 6.6018 },
      { longitude: 3.361691, latitude: 6.588742 },
      { longitude: 3.355779, latitude: 6.589271 },
      { longitude: 3.361734, latitude: 6.57572 },
      { longitude: 3.366552, latitude: 6.56399 },
      { longitude: 3.367452, latitude: 6.524548 },
      { longitude: 3.373355, latitude: 6.505745 },
      { longitude: 3.3788, latitude: 6.5088 },
    ] as Coordinate[],
  },
} as const

export type ScenarioIncident = (typeof scenario.incidents)[number]
