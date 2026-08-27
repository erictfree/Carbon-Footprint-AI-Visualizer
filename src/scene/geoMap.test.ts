import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_MILES,
  GLOBE_CENTER,
  GLOBE_RADIUS,
  globePosition,
  globePositionAtDistance,
} from './geoMap';

describe('globe projection', () => {
  it('places geographic coordinates on the globe surface', () => {
    const point = globePosition(30.2672, -97.7431);
    expect(point.distanceTo(GLOBE_CENTER)).toBeCloseTo(GLOBE_RADIUS, 5);
  });

  it('uses geodesic miles for globe routes', () => {
    const origin = globePositionAtDistance(0, 90).sub(GLOBE_CENTER).normalize();
    const quarterTurn = globePositionAtDistance(
      EARTH_RADIUS_MILES * Math.PI / 2,
      90,
    ).sub(GLOBE_CENTER).normalize();
    expect(THREE.MathUtils.radToDeg(origin.angleTo(quarterTurn))).toBeCloseTo(90, 4);
  });
});
