import * as THREE from 'three';
import { mesh } from 'topojson-client';
import type { GeometryObject, Topology } from 'topojson-specification';
import worldAtlasJson from 'world-atlas/countries-110m.json';
import usAtlasJson from 'us-atlas/states-10m.json';

export type GeoMapMode = 'none' | 'us' | 'world';

export interface GeoMapLayer {
  group: THREE.Group;
  materials: Array<THREE.Material & { opacity: number }>;
}

const ORIGIN = { latitude: 30.2672, longitude: -97.7431 } as const;
const PATH_ORIGIN_X = 1.45;
const US_SCALE = 0.5;
export const EARTH_RADIUS_MILES = 3_958.8;
export const GLOBE_RADIUS = 3.75;
export const GLOBE_CENTER = new THREE.Vector3(5.6, 3.05, 0);
const LONGITUDE_COSINE = Math.cos(THREE.MathUtils.degToRad(ORIGIN.latitude));

interface City {
  label: string;
  latitude: number;
  longitude: number;
  origin?: boolean;
}

const US_CITIES: City[] = [
  { label: 'Austin', latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, origin: true },
  { label: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
  { label: 'Denver', latitude: 39.7392, longitude: -104.9903 },
  { label: 'Chicago', latitude: 41.8781, longitude: -87.6298 },
  { label: 'Atlanta', latitude: 33.749, longitude: -84.388 },
  { label: 'New York', latitude: 40.7128, longitude: -74.006 },
  { label: 'Miami', latitude: 25.7617, longitude: -80.1918 },
];

const WORLD_CITIES: City[] = [
  { label: 'Austin', latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, origin: true },
  { label: 'São Paulo', latitude: -23.5505, longitude: -46.6333 },
  { label: 'London', latitude: 51.5074, longitude: -0.1278 },
  { label: 'Cairo', latitude: 30.0444, longitude: 31.2357 },
  { label: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { label: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { label: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
];

function wrapLongitude(longitude: number): number {
  return ((longitude - ORIGIN.longitude + 540) % 360) - 180;
}

function projectUs(coordinate: number[]): THREE.Vector2 | null {
  const [longitude, latitude] = coordinate;
  if (longitude === undefined || latitude === undefined) return null;
  if (longitude < -130 || longitude > -60 || latitude < 22 || latitude > 52) return null;
  return new THREE.Vector2(
    PATH_ORIGIN_X + (longitude - ORIGIN.longitude) * US_SCALE * LONGITUDE_COSINE,
    -(latitude - ORIGIN.latitude) * US_SCALE,
  );
}

export function globePosition(
  latitude: number,
  longitude: number,
  altitude = 0,
): THREE.Vector3 {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(wrapLongitude(longitude));
  const radius = GLOBE_RADIUS + altitude;
  const latitudeCosine = Math.cos(latitudeRadians);
  return new THREE.Vector3(
    GLOBE_CENTER.x + radius * latitudeCosine * Math.sin(longitudeRadians),
    GLOBE_CENTER.y + radius * Math.sin(latitudeRadians),
    GLOBE_CENTER.z + radius * latitudeCosine * Math.cos(longitudeRadians),
  );
}

export function globePositionAtDistance(
  miles: number,
  bearingDegrees: number,
  altitude = 0,
): THREE.Vector3 {
  const angularDistance = miles / EARTH_RADIUS_MILES;
  const bearing = THREE.MathUtils.degToRad(bearingDegrees);
  const startLatitude = THREE.MathUtils.degToRad(ORIGIN.latitude);
  const startLongitude = THREE.MathUtils.degToRad(ORIGIN.longitude);
  const endLatitude = Math.asin(
    Math.sin(startLatitude) * Math.cos(angularDistance)
      + Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const endLongitude = startLongitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLatitude),
    Math.cos(angularDistance) - Math.sin(startLatitude) * Math.sin(endLatitude),
  );
  return globePosition(
    THREE.MathUtils.radToDeg(endLatitude),
    THREE.MathUtils.radToDeg(endLongitude),
    altitude,
  );
}

function createLineGeometry(
  coordinates: number[][][],
  project: (coordinate: number[]) => THREE.Vector2 | null,
  maximumSegmentLength: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  coordinates.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const start = project(line[index - 1]!);
      const end = project(line[index]!);
      if (!start || !end || start.distanceTo(end) > maximumSegmentLength) continue;
      positions.push(start.x, 0.045, start.y, end.x, 0.045, end.y);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createGlobeLineGeometry(coordinates: number[][][]): THREE.BufferGeometry {
  const positions: number[] = [];
  coordinates.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const [startLongitude, startLatitude] = line[index - 1] ?? [];
      const [endLongitude, endLatitude] = line[index] ?? [];
      if (
        startLongitude === undefined
        || startLatitude === undefined
        || endLongitude === undefined
        || endLatitude === undefined
      ) continue;
      const start = globePosition(startLatitude, startLongitude, 0.035);
      const end = globePosition(endLatitude, endLongitude, 0.035);
      const startNormal = start.clone().sub(GLOBE_CENTER).normalize();
      const endNormal = end.clone().sub(GLOBE_CENTER).normalize();
      if (startNormal.angleTo(endNormal) > THREE.MathUtils.degToRad(24)) continue;
      positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createGraticuleGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const addSegment = (start: THREE.Vector3, end: THREE.Vector3) => {
    positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
  };
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    for (let longitude = -180; longitude < 180; longitude += 4) {
      addSegment(
        globePosition(latitude, longitude, 0.012),
        globePosition(latitude, longitude + 4, 0.012),
      );
    }
  }
  for (let longitude = -150; longitude <= 180; longitude += 30) {
    for (let latitude = -88; latitude < 88; latitude += 4) {
      addSegment(
        globePosition(latitude, longitude, 0.012),
        globePosition(Math.min(88, latitude + 4), longitude, 0.012),
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function lineMaterial(color: number, baseOpacity: number): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  material.userData.baseOpacity = baseOpacity;
  return material;
}

function createLabelMaterial(label: string, origin: boolean, depthTest = false): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = origin ? 'rgba(8, 36, 44, 0.92)' : 'rgba(5, 18, 26, 0.78)';
    context.beginPath();
    context.roundRect(2, 8, 252, 48, 16);
    context.fill();
    context.strokeStyle = origin ? 'rgba(66, 232, 223, 0.85)' : 'rgba(151, 199, 202, 0.34)';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = origin ? '#dffffd' : '#aac2c5';
    context.font = `600 ${origin ? 24 : 21}px Inter, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 128, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest,
    depthWrite: false,
  });
  material.userData.baseOpacity = origin ? 0.96 : 0.72;
  return material;
}

function addGlobeCities(layer: GeoMapLayer, cities: City[]): void {
  cities.forEach((city) => {
    const surface = globePosition(city.latitude, city.longitude, city.origin ? 0.12 : 0.075);
    const normal = surface.clone().sub(GLOBE_CENTER).normalize();
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: city.origin ? 0x42e8df : 0x7aa7ac,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dotMaterial.userData.baseOpacity = city.origin ? 1 : 0.74;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(city.origin ? 0.105 : 0.055, 18, 12),
      dotMaterial,
    );
    dot.position.copy(surface);
    layer.group.add(dot);
    layer.materials.push(dotMaterial);

    const labelMaterial = createLabelMaterial(city.label, city.origin === true, true);
    const label = new THREE.Sprite(labelMaterial);
    label.position.copy(surface).addScaledVector(normal, city.origin ? 0.38 : 0.23);
    label.scale.set(city.origin ? 1.65 : 1.18, city.origin ? 0.41 : 0.3, 1);
    layer.group.add(label);
    layer.materials.push(labelMaterial);
  });
}

function addCities(
  layer: GeoMapLayer,
  cities: City[],
  project: (coordinate: number[]) => THREE.Vector2 | null,
): void {
  cities.forEach((city) => {
    const point = project([city.longitude, city.latitude]);
    if (!point) return;
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: city.origin ? 0x42e8df : 0x739ca1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dotMaterial.userData.baseOpacity = city.origin ? 1 : 0.7;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(city.origin ? 0.12 : 0.07, 24), dotMaterial);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(point.x, 0.07, point.y);
    layer.group.add(dot);
    layer.materials.push(dotMaterial);

    const labelMaterial = createLabelMaterial(city.label, city.origin === true);
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(point.x, city.origin ? 0.72 : 0.48, point.y - 0.12);
    label.scale.set(city.origin ? 2.25 : 1.75, city.origin ? 0.56 : 0.44, 1);
    layer.group.add(label);
    layer.materials.push(labelMaterial);
  });
}

function addLine(
  layer: GeoMapLayer,
  geometry: THREE.BufferGeometry,
  color: number,
  baseOpacity: number,
): void {
  const material = lineMaterial(color, baseOpacity);
  layer.group.add(new THREE.LineSegments(geometry, material));
  layer.materials.push(material);
}

function blankLayer(name: string): GeoMapLayer {
  const group = new THREE.Group();
  group.name = name;
  group.visible = false;
  return { group, materials: [] };
}

export function createGeoMapLayers(): { us: GeoMapLayer; world: GeoMapLayer } {
  const us = blankLayer('Continental US map');
  const world = blankLayer('3D world globe');
  const usTopology = usAtlasJson as unknown as Topology;
  const worldTopology = worldAtlasJson as unknown as Topology;

  const states = mesh(
    usTopology,
    usTopology.objects.states as GeometryObject,
    (left, right) => left !== right,
  );
  const nation = mesh(usTopology, usTopology.objects.nation as GeometryObject);
  addLine(us, createLineGeometry(states.coordinates, projectUs, 1.5), 0x508c96, 0.34);
  addLine(us, createLineGeometry(nation.coordinates, projectUs, 1.5), 0x8de6e1, 0.82);
  addCities(us, US_CITIES, projectUs);

  const countries = mesh(
    worldTopology,
    worldTopology.objects.countries as GeometryObject,
    (left, right) => left !== right,
  );
  const land = mesh(worldTopology, worldTopology.objects.land as GeometryObject);

  const oceanMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x010a0f,
    emissive: 0x03151c,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0,
    roughness: 0.96,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.92,
    depthWrite: true,
  });
  oceanMaterial.userData.baseOpacity = 0.96;
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64), oceanMaterial);
  ocean.position.copy(GLOBE_CENTER);
  world.group.add(ocean);
  world.materials.push(oceanMaterial);

  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x42e8df,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  atmosphereMaterial.userData.baseOpacity = 0.11;
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS + 0.22, 64, 48),
    atmosphereMaterial,
  );
  atmosphere.position.copy(GLOBE_CENTER);
  world.group.add(atmosphere);
  world.materials.push(atmosphereMaterial);

  addLine(world, createGraticuleGeometry(), 0x24515c, 0.16);
  addLine(world, createGlobeLineGeometry(countries.coordinates), 0x4f8a93, 0.4);
  addLine(world, createGlobeLineGeometry(land.coordinates), 0x92e1de, 0.82);
  addGlobeCities(world, WORLD_CITIES);

  return { us, world };
}

export function mapRadiusForMiles(miles: number, mode: GeoMapMode): number {
  if (mode === 'us') return miles * (US_SCALE / 69);
  if (mode === 'world') return GLOBE_RADIUS * (miles / EARTH_RADIUS_MILES);
  return 0;
}

export function updateGeoMapLayer(layer: GeoMapLayer, visibility: number): void {
  const shown = THREE.MathUtils.clamp(visibility, 0, 1);
  layer.group.visible = shown > 0.005;
  layer.materials.forEach((material) => {
    material.opacity = Number(material.userData.baseOpacity ?? 1) * shown;
  });
}
