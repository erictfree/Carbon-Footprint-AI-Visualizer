import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createGeoMapLayers,
  EARTH_RADIUS_MILES,
  GLOBE_CENTER,
  GLOBE_RADIUS,
  globePositionAtDistance,
  mapRadiusForMiles,
  updateGeoMapLayer,
  type GeoMapMode,
} from './geoMap';

const PRODUCTION_CAR_URL = new URL(
  '../../models/tesla-model-3-2024/source/2024_tesla_model_3.glb',
  import.meta.url,
).href;
const PATH_ORIGIN_X = 1.45;
const CAR_LENGTH = 4.45;
const ROUTE_SEGMENTS = 96;
const ROUTE_TWEEN_MS = 620;
const CINEMATIC_DURATION_MS = 9_000;
const GLOBAL_AI_INSET_CENTER = new THREE.Vector3(-1, 3.15, 0.35);

type DistanceStageId = 'driveway' | 'neighborhood' | 'regional' | 'continental' | 'global';

interface DistanceStage {
  id: DistanceStageId;
  label: string;
  note: string;
  mapMode: GeoMapMode;
  camera: [number, number, number];
  target: [number, number, number];
}

interface CameraTransition {
  startedAt: number;
  fromCamera: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toCamera: THREE.Vector3;
  toTarget: THREE.Vector3;
}

const DISTANCE_STAGES: Record<DistanceStageId, DistanceStage> = {
  driveway: {
    id: 'driveway',
    label: 'Driveway scale',
    note: 'True-scale local distance',
    mapMode: 'none',
    camera: [4.25, 1.8, 4.4],
    target: [0.6, 0.58, 0],
  },
  neighborhood: {
    id: 'neighborhood',
    label: 'Neighborhood scale',
    note: 'Local-road distance field',
    mapMode: 'none',
    camera: [6.15, 3.05, 6.9],
    target: [1.25, 0.68, 0],
  },
  regional: {
    id: 'regional',
    label: 'Regional scale',
    note: 'Regional distance field',
    mapMode: 'none',
    camera: [7.65, 4.25, 8.85],
    target: [1.55, 0.78, 0],
  },
  continental: {
    id: 'continental',
    label: 'US map scale',
    note: 'True range ring · illustrative route · short path enlarged',
    mapMode: 'us',
    camera: [8.75, 6.6, 13.7],
    target: [2, 0.72, 0],
  },
  global: {
    id: 'global',
    label: '3D globe scale',
    note: 'AI local lens · lifestyle geodesic journey',
    mapMode: 'world',
    camera: [11.7, 8.2, 15.6],
    target: [2, 3.05, 0],
  },
};

export function distanceStageForMiles(miles: number): DistanceStage {
  if (miles < 10 / 5_280) return DISTANCE_STAGES.driveway;
  if (miles < 2) return DISTANCE_STAGES.neighborhood;
  if (miles < 50) return DISTANCE_STAGES.regional;
  if (miles < 2_500) return DISTANCE_STAGES.continental;
  return DISTANCE_STAGES.global;
}

function eased(progress: number): number {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
}

function createFallbackCar(): THREE.Group {
  const car = new THREE.Group();
  car.name = 'Model 3 placeholder';

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xd9e4e6,
    metalness: 0.72,
    roughness: 0.22,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x071018, metalness: 0.4, roughness: 0.38 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x19323d,
    metalness: 0.1,
    roughness: 0.08,
    transmission: 0.3,
    transparent: true,
    opacity: 0.86,
  });
  const headlight = new THREE.MeshStandardMaterial({
    color: 0xeaffff,
    emissive: 0xb7ffff,
    emissiveIntensity: 4,
  });
  const tailLight = new THREE.MeshStandardMaterial({
    color: 0xff4b3f,
    emissive: 0xff2b20,
    emissiveIntensity: 2.5,
  });

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.72, 1.82), paint);
  lowerBody.position.y = 0.72;
  lowerBody.castShadow = true;
  car.add(lowerBody);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 1.72), paint);
  nose.position.set(1.55, 1.05, 0);
  nose.rotation.z = -0.08;
  nose.castShadow = true;
  car.add(nose);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.76, 1.5), glass);
  cabin.position.set(-0.2, 1.42, 0);
  cabin.rotation.z = -0.035;
  cabin.castShadow = true;
  car.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 1.47), dark);
  roof.position.set(-0.28, 1.82, 0);
  car.add(roof);

  const wheelGeometry = new THREE.CylinderGeometry(0.41, 0.41, 0.24, 28);
  const rimGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.255, 18);
  const rim = new THREE.MeshStandardMaterial({ color: 0x64737a, metalness: 0.82, roughness: 0.25 });
  for (const x of [-1.3, 1.28]) {
    for (const z of [-0.96, 0.96]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark);
      wheel.position.set(x, 0.48, z);
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      car.add(wheel);

      const wheelRim = new THREE.Mesh(rimGeometry, rim);
      wheelRim.position.copy(wheel.position);
      wheelRim.rotation.x = Math.PI / 2;
      car.add(wheelRim);
    }
  }

  for (const z of [-0.62, 0.62]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.44), headlight);
    light.position.set(2.09, 1.02, z);
    car.add(light);

    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.48), tailLight);
    rear.position.set(-2.08, 0.96, z);
    car.add(rear);
  }

  return car;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const sprite = object as THREE.Sprite;
    if (sprite.isSprite) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
      return;
    }
    const renderable = object as THREE.Mesh;
    if (!renderable.geometry || !renderable.material) return;
    renderable.geometry.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of materials) material?.dispose();
  });
}

function createRibbonGeometry(curve: THREE.CatmullRomCurve3, width: number, elevation: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfWidth = width / 2;

  for (let index = 0; index <= ROUTE_SEGMENTS; index += 1) {
    const progress = index / ROUTE_SEGMENTS;
    const point = curve.getPoint(progress);
    const tangent = curve.getTangent(progress).normalize();
    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(halfWidth);
    const left = point.clone().add(perpendicular);
    const right = point.clone().sub(perpendicular);
    positions.push(left.x, elevation, left.z, right.x, elevation, right.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, progress, 1, progress);

    if (index < ROUTE_SEGMENTS) {
      const vertex = index * 2;
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 2, vertex + 3, vertex + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createDistanceField(): THREE.Group {
  const field = new THREE.Group();
  field.name = 'Logarithmic distance field';
  field.position.set(PATH_ORIGIN_X, 0.028, 0);

  [2.5, 5, 8.5, 13, 19, 27].forEach((radius, index) => {
    const baseOpacity = Math.max(0.025, 0.1 - index * 0.012);
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 === 0 ? 0x42e8df : 0x4b8e98,
      transparent: true,
      opacity: baseOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    material.userData.baseOpacity = baseOpacity;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.018, radius + 0.018, 160), material);
    ring.rotation.x = -Math.PI / 2;
    field.add(ring);
  });

  return field;
}

function createStars(): THREE.Points {
  const positions: number[] = [];
  let seed = 91;
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 4_294_967_296;
  };

  for (let index = 0; index < 420; index += 1) {
    positions.push((random() - 0.5) * 70, 2 + random() * 24, (random() - 0.5) * 70);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x8ac4cc,
    size: 0.04,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function visualLength(miles: number): number {
  if (miles <= 0) return 0;
  return THREE.MathUtils.clamp(3.2 + Math.log10(Math.max(0, miles) * 12 + 1) * 4.1, 3.2, 28);
}

function createSceneLabel(text: string, color: number, width = 320): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 72;
  const context = canvas.getContext('2d');
  if (context) {
    const accent = new THREE.Color(color).getStyle();
    context.fillStyle = 'rgba(5, 18, 26, 0.9)';
    context.beginPath();
    context.roundRect(3, 5, width - 6, 62, 18);
    context.fill();
    context.strokeStyle = accent;
    context.globalAlpha = 0.72;
    context.lineWidth = 2;
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = '#e8f8f7';
    context.font = '700 24px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, 36);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.2, 0.5, 1);
  return sprite;
}

function orientToSurface(object: THREE.Object3D, position: THREE.Vector3): void {
  const normal = position.clone().sub(GLOBE_CENTER).normalize();
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
}

export class PromptMilesScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly car = new THREE.Group();
  private readonly carModel = new THREE.Group();
  private readonly fallbackCar = createFallbackCar();
  private readonly headlights: THREE.SpotLight[] = [];
  private readonly stars = createStars();
  private readonly distanceField = createDistanceField();
  private readonly geoMaps = createGeoMapLayers();
  private readonly timer = new THREE.Timer();
  private readonly resizeObserver: ResizeObserver;
  private readonly pathGroup = new THREE.Group();
  private readonly cinematicCameraStart = new THREE.Vector3(PATH_ORIGIN_X + 2.35, 1.45, 3.15);
  private readonly cinematicTargetStart = new THREE.Vector3(PATH_ORIGIN_X - 1.25, 0.68, 0);
  private environmentTexture: THREE.Texture | null = null;
  private ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null;
  private grid: THREE.GridHelper | null = null;
  private currentStage = DISTANCE_STAGES.regional;
  private usMapVisibility = 0;
  private worldMapVisibility = 0;
  private carVisualScale = 1;
  private cameraTransition: CameraTransition | null = null;
  private cinematicStartedAt: number | null = null;
  private cinematicLabelsRevealed = false;
  private cinematicMapReveal = 1;
  private routesReady = false;
  private carAssetReady = false;
  private hasAutoPlayed = false;
  private frame = 0;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.renderer.domElement);
    this.timer.connect(document);

    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.environmentTexture = pmremGenerator.fromScene(environment).texture;
    this.scene.environment = this.environmentTexture;
    environment.dispose();
    pmremGenerator.dispose();

    this.scene.fog = new THREE.FogExp2(0x07131d, 0.025);
    this.camera.position.fromArray(this.currentStage.camera);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.target.fromArray(this.currentStage.target);

    const hemi = new THREE.HemisphereLight(0x9fe8ff, 0x101719, 2.5);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1_024, 1_024);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    this.scene.add(key);

    const rim = new THREE.PointLight(0x2ae1dc, 22, 17, 2);
    rim.position.set(-4, 2.2, -4);
    this.scene.add(rim);

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a171d,
      roughness: 0.86,
      metalness: 0.08,
      transparent: true,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.ground = ground;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(70, 70, 0x1b6a70, 0x11343b);
    grid.material.transparent = true;
    grid.material.opacity = 0.17;
    grid.position.y = 0.012;
    this.grid = grid;
    this.scene.add(grid);

    this.car.name = '2024 Tesla Model 3';
    this.carModel.name = 'Vehicle asset';
    // Keep the car's nose connected to the paths while clearing the left-side HUD.
    this.car.position.set(PATH_ORIGIN_X - CAR_LENGTH / 2, 0, 0);
    this.fallbackCar.visible = false;
    this.carModel.add(this.fallbackCar);
    this.car.add(this.carModel);
    this.addHeadlights();
    this.container.dataset.carAsset = 'loading';
    this.container.dataset.cinematic = 'idle';
    this.container.dataset.distanceStage = this.currentStage.id;

    this.scene.add(
      this.stars,
      this.distanceField,
      this.geoMaps.us.group,
      this.geoMaps.world.group,
      this.car,
      this.pathGroup,
    );
    this.loadProductionCar();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
  }

  private addHeadlights(): void {
    for (const z of [-0.58, 0.58]) {
      const target = new THREE.Object3D();
      target.position.set(7.2, 0.16, z);
      const light = new THREE.SpotLight(0xd9ffff, 18, 15, Math.PI / 9, 0.58, 1.45);
      light.position.set(2.02, 0.82, z);
      light.target = target;
      light.castShadow = false;
      this.car.add(light, target);
      this.headlights.push(light);
    }
  }

  private maybeAutoReplay(): void {
    if (this.hasAutoPlayed || !this.carAssetReady || !this.routesReady) return;
    this.hasAutoPlayed = true;
    requestAnimationFrame(() => this.replay());
  }

  private loadProductionCar(): void {
    const loader = new GLTFLoader();
    loader.load(
      PRODUCTION_CAR_URL,
      (gltf) => {
        if (this.disposed) {
          disposeObject(gltf.scene);
          return;
        }

        const model = new THREE.Group();
        model.name = '2024 Tesla Model 3 · CC BY 4.0';
        model.add(gltf.scene);
        model.updateMatrixWorld(true);

        let box = new THREE.Box3().setFromObject(model);
        const initialSize = box.getSize(new THREE.Vector3());
        if (initialSize.z > initialSize.x) {
          model.rotation.y = Math.PI / 2;
          model.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(model);
        }

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = CAR_LENGTH / Math.max(size.x, 0.001);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            const standard = material as THREE.MeshStandardMaterial;
            standard.envMapIntensity = 1.2;
            for (const texture of [standard.map, standard.normalMap, standard.roughnessMap, standard.metalnessMap]) {
              if (texture) texture.anisotropy = anisotropy;
            }
          }
        });

        for (const child of [...this.carModel.children]) {
          disposeObject(child);
          this.carModel.remove(child);
        }
        this.carModel.add(model);
        this.carAssetReady = true;
        this.container.dataset.carAsset = 'loaded';
        this.maybeAutoReplay();
      },
      undefined,
      () => {
        if (this.disposed) return;
        this.fallbackCar.visible = true;
        this.carAssetReady = true;
        this.container.dataset.carAsset = 'fallback';
        this.maybeAutoReplay();
      },
    );
  }

  setDistances(aiMiles: number, lifestyleMiles: number, lifestyleColor = 0xffa856): void {
    const nextStage = distanceStageForMiles(Math.max(aiMiles, lifestyleMiles));
    const previousLengths = this.pathGroup.children.map((route) => (
      Number(route.userData.visualLength ?? 0) * route.scale.x
    ));
    for (const child of [...this.pathGroup.children]) {
      disposeObject(child);
      this.pathGroup.remove(child);
    }

    const addRoute = (route: THREE.Group, previousLength: number | undefined) => {
      const nextLength = Number(route.userData.visualLength);
      const startingLength = previousLength ?? (previousLengths.length > 0 ? nextLength * 0.01 : undefined);
      if (
        !route.userData.disableScaleTween
        && startingLength
        && nextLength > 0
        && this.cinematicStartedAt === null
      ) {
        route.scale.x = THREE.MathUtils.clamp(startingLength / nextLength, 0.01, 4.5);
        route.userData.scaleTween = {
          from: route.scale.x,
          startedAt: performance.now(),
        };
      }
      this.setRouteReveal(route, this.cinematicStartedAt === null ? 1 : 0);
      this.pathGroup.add(route);
    };

    let routeIndex = 0;
    if (aiMiles > 0) {
      const aiLane = nextStage.mapMode === 'none' ? -0.52 : -1;
      addRoute(
        this.createRoute(aiMiles, aiLane, 0x42e8df, 0.5, nextStage.mapMode, 'ai'),
        previousLengths[routeIndex],
      );
      routeIndex += 1;
    }
    if (lifestyleMiles > 0) {
      addRoute(
        this.createRoute(lifestyleMiles, 0.52, lifestyleColor, 0.44, nextStage.mapMode, 'lifestyle'),
        previousLengths[routeIndex],
      );
    }

    const stageChanged = nextStage.id !== this.currentStage.id;
    const hadRoutes = this.routesReady;
    this.currentStage = nextStage;
    this.container.dataset.distanceStage = nextStage.id;
    this.routesReady = this.pathGroup.children.length > 0;

    if (stageChanged && this.cinematicStartedAt === null) {
      if (hadRoutes) this.beginCameraTransition(performance.now());
      else this.applyStageCamera();
    }
    this.maybeAutoReplay();
  }

  get distanceStageLabel(): string {
    return this.currentStage.label;
  }

  get distanceStageNote(): string {
    return this.currentStage.note;
  }

  private createRoute(
    miles: number,
    lane: number,
    color: number,
    width: number,
    mapMode: GeoMapMode,
    role: 'ai' | 'lifestyle',
  ): THREE.Group {
    if (mapMode === 'world') {
      return role === 'ai'
        ? this.createGlobalAiInset(miles, color)
        : this.createGlobeRoute(miles, color, width);
    }
    const mappedRadius = mapRadiusForMiles(miles, mapMode);
    const length = mapMode === 'none'
      ? visualLength(miles)
      : THREE.MathUtils.clamp(mappedRadius, 2.2, 30);
    const mapBend = mapMode === 'none' ? 0 : -Math.min(2.6, length * 0.14);
    const points = mapMode === 'none'
      ? [
          new THREE.Vector3(0, 0.13, lane),
          new THREE.Vector3(length * 0.22, 0.16, lane * 1.1),
          new THREE.Vector3(length * 0.52, 0.2 + Math.min(length / 90, 0.18), lane * 1.8),
          new THREE.Vector3(length, 0.26 + Math.min(length / 55, 0.38), lane * 2.4),
        ]
      : [
          new THREE.Vector3(0, 0.13, lane),
          new THREE.Vector3(length * 0.24, 0.18, lane + mapBend * 0.65),
          new THREE.Vector3(length * 0.62, 0.32, lane + mapBend),
          new THREE.Vector3(length, 0.5, lane + mapBend * 0.35),
        ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.45);
    const route = new THREE.Group();
    route.name = `${miles.toFixed(1)} mile route`;
    route.position.x = PATH_ORIGIN_X;

    const auraMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.17,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const routeWidth = mapMode === 'none' ? width : width * 0.7;
    const aura = new THREE.Mesh(createRibbonGeometry(curve, routeWidth * 1.85, 0.055), auraMaterial);
    route.add(aura);

    const roadColor = new THREE.Color(color).lerp(new THREE.Color(0x07131d), 0.78);
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: roadColor,
      emissive: color,
      emissiveIntensity: 0.36,
      transparent: true,
      opacity: 0.94,
      roughness: 0.72,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const road = new THREE.Mesh(createRibbonGeometry(curve, routeWidth, 0.07), roadMaterial);
    road.receiveShadow = true;
    route.add(road);

    const markerMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 4.2,
      transparent: true,
      opacity: 0.92,
      roughness: 0.25,
    });
    const dashGeometry = new THREE.BoxGeometry(0.48, 0.025, Math.max(0.035, routeWidth * 0.1));
    for (let progress = 0.08; progress < 0.98; progress += 0.09) {
      const point = curve.getPoint(progress);
      const tangent = curve.getTangent(progress).normalize();
      const dash = new THREE.Mesh(dashGeometry, markerMaterial);
      dash.position.set(point.x, 0.096, point.z);
      dash.rotation.y = -Math.atan2(tangent.z, tangent.x);
      dash.userData.routeProgress = progress;
      route.add(dash);
    }

    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    if (mapMode !== 'none' && mappedRadius >= 0.14) {
      const reachRadius = Math.min(mappedRadius, 30);
      const reachMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const reachRing = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.01, reachRadius - 0.035), reachRadius + 0.035, 180),
        reachMaterial,
      );
      reachRing.rotation.x = -Math.PI / 2;
      reachRing.position.y = 0.082;
      reachRing.userData.routeProgress = 0.82;
      route.add(reachRing);
    }
    [0.25, 0.5, 0.75].forEach((progress) => {
      const point = curve.getPoint(progress);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.14, 28), ringMaterial);
      ring.position.set(point.x, 0.11, point.z);
      ring.rotation.x = -Math.PI / 2;
      ring.userData.routeProgress = progress;
      route.add(ring);
    });

    const endpoint = curve.getPoint(1);
    const endpointRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.31, 40), ringMaterial);
    endpointRing.position.set(endpoint.x, 0.105, endpoint.z);
    endpointRing.rotation.x = -Math.PI / 2;
    endpointRing.userData.routeProgress = 0.97;
    route.add(endpointRing);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.75, 16), markerMaterial);
    beacon.position.set(endpoint.x, 0.45, endpoint.z);
    beacon.userData.routeProgress = 0.99;
    route.add(beacon);

    const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), markerMaterial);
    beaconLight.position.set(endpoint.x, 0.86, endpoint.z);
    beaconLight.userData.routeProgress = 1;
    route.add(beaconLight);

    route.userData.auraMaterial = auraMaterial;
    route.userData.markerMaterial = markerMaterial;
    route.userData.revealMeshes = [aura, road];
    route.userData.visualLength = length;
    return route;
  }

  private createGlobalAiInset(miles: number, color: number): THREE.Group {
    const route = new THREE.Group();
    route.name = `${miles.toFixed(1)} mile Austin local lens`;
    route.userData.disableScaleTween = true;
    route.userData.visualLength = Math.max(miles, 0.001);

    const lens = new THREE.Group();
    lens.position.copy(GLOBAL_AI_INSET_CENTER);
    lens.lookAt(new THREE.Vector3().fromArray(DISTANCE_STAGES.global.camera));
    route.add(lens);

    const discMaterial = new THREE.MeshBasicMaterial({
      color: 0x061821,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 72), discMaterial);
    disc.userData.routeProgress = 0.06;
    lens.add(disc);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    [0.42, 0.82, 1.28].forEach((radius, index) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.012, radius + 0.012, 72), ringMaterial);
      ring.position.z = 0.018;
      ring.userData.routeProgress = 0.12 + index * 0.04;
      lens.add(ring);
    });

    const localLength = THREE.MathUtils.clamp(0.72 + Math.log10(miles + 1) * 0.58, 0.78, 1.55);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.72, -0.28, 0.065),
      new THREE.Vector3(-0.2, -0.08, 0.09),
      new THREE.Vector3(localLength * 0.28, 0.18, 0.1),
      new THREE.Vector3(localLength * 0.52, 0.46, 0.11),
    ]);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const aura = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.11, 8, false), auraMaterial);
    lens.add(aura);

    const pathMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b5659,
      emissive: color,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.96,
      roughness: 0.45,
    });
    const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.045, 8, false), pathMaterial);
    lens.add(path);

    const markerMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 4,
      transparent: true,
      opacity: 0.96,
    });
    [0, 1].forEach((progress) => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(progress === 0 ? 0.095 : 0.075, 18, 12), markerMaterial);
      marker.position.copy(curve.getPoint(progress));
      marker.userData.routeProgress = progress === 0 ? 0.18 : 0.94;
      lens.add(marker);
    });

    const label = createSceneLabel(`AI · AUSTIN · ${Math.round(miles).toLocaleString('en-US')} MI`, color);
    label.position.copy(GLOBAL_AI_INSET_CENTER).add(new THREE.Vector3(0, 1.65, 0.2));
    label.userData.routeProgress = 0.35;
    route.add(label);

    route.userData.auraMaterial = auraMaterial;
    route.userData.markerMaterial = markerMaterial;
    route.userData.revealMeshes = [aura, path];
    return route;
  }

  private createGlobeRoute(miles: number, color: number, width: number): THREE.Group {
    const route = new THREE.Group();
    route.name = `${miles.toFixed(1)} mile globe journey`;
    route.userData.disableScaleTween = true;
    route.userData.visualLength = Math.max(miles, 0.001);

    const maximumRenderedMiles = EARTH_RADIUS_MILES * Math.PI * 1.92;
    const renderedMiles = Math.min(miles, maximumRenderedMiles);
    const bearing = 52;
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 160; index += 1) {
      const progress = index / 160;
      const altitude = 0.1 + Math.pow(Math.sin(Math.PI * progress), 1.25) * 0.27;
      points.push(globePositionAtDistance(renderedMiles * progress, bearing, altitude));
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45);
    const routeRadius = Math.max(0.035, width * 0.11);

    const auraMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const aura = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, routeRadius * 2.4, 8, false), auraMaterial);
    route.add(aura);

    const pathMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).lerp(new THREE.Color(0x06131d), 0.62),
      emissive: color,
      emissiveIntensity: 1.18,
      transparent: true,
      opacity: 0.98,
      roughness: 0.46,
      metalness: 0.08,
    });
    const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, routeRadius, 8, false), pathMaterial);
    route.add(path);

    const markerMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 4.2,
      transparent: true,
      opacity: 0.96,
      roughness: 0.25,
    });
    [0, 0.25, 0.5, 0.75, 1].forEach((progress, index) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(index === 0 || index === 4 ? 0.105 : 0.055, 20, 14),
        markerMaterial,
      );
      marker.position.copy(curve.getPoint(progress));
      marker.userData.routeProgress = Math.max(0.14, progress);
      route.add(marker);
    });

    if (miles < EARTH_RADIUS_MILES * Math.PI) {
      const reachPoints: THREE.Vector3[] = [];
      for (let bearingIndex = 0; bearingIndex < 180; bearingIndex += 1) {
        reachPoints.push(globePositionAtDistance(miles, bearingIndex * 2, 0.055));
      }
      const reachMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const reachGeometry = new THREE.BufferGeometry().setFromPoints(reachPoints);
      const reachRing = new THREE.LineLoop(reachGeometry, reachMaterial);
      reachRing.userData.routeProgress = 0.8;
      route.add(reachRing);
    }

    const endpoint = curve.getPoint(1);
    const endpointRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 10, 44), markerMaterial);
    endpointRing.position.copy(endpoint);
    orientToSurface(endpointRing, endpoint);
    endpointRing.userData.routeProgress = 0.96;
    route.add(endpointRing);

    const label = createSceneLabel(`LIFESTYLE · ${Math.round(miles).toLocaleString('en-US')} MI`, color);
    label.position.copy(GLOBE_CENTER).add(new THREE.Vector3(0.25, GLOBE_RADIUS + 0.62, 0.15));
    label.scale.set(2.45, 0.55, 1);
    label.userData.routeProgress = 0.98;
    route.add(label);

    route.userData.auraMaterial = auraMaterial;
    route.userData.markerMaterial = markerMaterial;
    route.userData.revealMeshes = [aura, path];
    return route;
  }

  private setRouteReveal(route: THREE.Object3D, progress: number): void {
    const reveal = THREE.MathUtils.clamp(progress, 0, 1);
    const revealMeshes = route.userData.revealMeshes as THREE.Mesh[] | undefined;
    revealMeshes?.forEach((mesh) => {
      const available = mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count;
      const drawCount = Math.floor((available * reveal) / 6) * 6;
      mesh.geometry.setDrawRange(0, Math.min(available, drawCount));
    });
    route.traverse((child) => {
      const markerProgress = child.userData.routeProgress as number | undefined;
      if (markerProgress !== undefined) child.visible = reveal >= markerProgress;
    });
    route.userData.reveal = reveal;
  }

  private applyStageCamera(): void {
    this.camera.position.fromArray(this.currentStage.camera);
    this.controls.target.fromArray(this.currentStage.target);
    this.controls.update();
  }

  private beginCameraTransition(startedAt: number): void {
    this.cameraTransition = {
      startedAt,
      fromCamera: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toCamera: new THREE.Vector3().fromArray(this.currentStage.camera),
      toTarget: new THREE.Vector3().fromArray(this.currentStage.target),
    };
  }

  private updateTransitions(timestamp: number): void {
    this.pathGroup.children.forEach((route) => {
      const tween = route.userData.scaleTween as { from: number; startedAt: number } | undefined;
      if (!tween) return;
      const progress = eased((timestamp - tween.startedAt) / ROUTE_TWEEN_MS);
      route.scale.x = THREE.MathUtils.lerp(tween.from, 1, progress);
      if (progress >= 1) delete route.userData.scaleTween;
    });

    if (!this.cameraTransition || this.cinematicStartedAt !== null) return;
    const progress = eased((timestamp - this.cameraTransition.startedAt) / ROUTE_TWEEN_MS);
    this.camera.position.lerpVectors(
      this.cameraTransition.fromCamera,
      this.cameraTransition.toCamera,
      progress,
    );
    this.controls.target.lerpVectors(
      this.cameraTransition.fromTarget,
      this.cameraTransition.toTarget,
      progress,
    );
    if (progress >= 1) this.cameraTransition = null;
  }

  replay(): void {
    if (!this.routesReady || this.disposed) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.finishCinematic();
      return;
    }

    this.cinematicStartedAt = performance.now();
    this.cinematicLabelsRevealed = false;
    this.cinematicMapReveal = 0;
    this.cameraTransition = null;
    this.controls.enabled = false;
    this.camera.position.copy(this.cinematicCameraStart);
    this.controls.target.copy(this.cinematicTargetStart);
    this.car.position.x = PATH_ORIGIN_X - CAR_LENGTH / 2 - 0.9;
    this.headlights.forEach((light) => { light.intensity = 0; });
    this.pathGroup.children.forEach((route) => {
      route.scale.x = 1;
      delete route.userData.scaleTween;
      this.setRouteReveal(route, 0);
    });
    this.container.dataset.cinematic = 'true';
    this.container.dispatchEvent(new CustomEvent('promptmiles:cinematicstart', { bubbles: true }));
  }

  private finishCinematic(): void {
    this.cinematicStartedAt = null;
    this.cinematicLabelsRevealed = false;
    this.cinematicMapReveal = 1;
    this.car.position.x = PATH_ORIGIN_X - CAR_LENGTH / 2;
    this.pathGroup.children.forEach((route) => this.setRouteReveal(route, 1));
    this.headlights.forEach((light) => { light.intensity = 18; });
    this.applyStageCamera();
    this.controls.enabled = true;
    this.container.dataset.cinematic = 'idle';
    this.container.dispatchEvent(new CustomEvent('promptmiles:cinematicend', { bubbles: true }));
  }

  private updateCinematic(timestamp: number): void {
    if (this.cinematicStartedAt === null) return;
    const elapsed = timestamp - this.cinematicStartedAt;
    this.cinematicMapReveal = eased((elapsed - 2_350) / 3_200);
    const cameraProgress = eased((elapsed - 850) / 6_900);
    const settledCamera = new THREE.Vector3().fromArray(this.currentStage.camera);
    const settledTarget = new THREE.Vector3().fromArray(this.currentStage.target);
    this.camera.position.lerpVectors(this.cinematicCameraStart, settledCamera, cameraProgress);
    this.controls.target.lerpVectors(this.cinematicTargetStart, settledTarget, cameraProgress);

    const carProgress = eased((elapsed - 250) / 3_450);
    this.car.position.x = PATH_ORIGIN_X - CAR_LENGTH / 2 - (1 - carProgress) * 0.9;

    const ignition = eased((elapsed - 250) / 900);
    const settle = eased((elapsed - 4_800) / 2_400);
    const headlightIntensity = THREE.MathUtils.lerp(0, 135, ignition);
    this.headlights.forEach((light) => {
      light.intensity = THREE.MathUtils.lerp(headlightIntensity, 18, settle);
    });

    this.pathGroup.children.forEach((route, index) => {
      const globeDelay = this.currentStage.mapMode === 'world' ? 1_450 : 0;
      const revealStart = (index === 0 ? 900 : 1_450) + globeDelay;
      const revealDuration = index === 0 ? 2_900 : 4_250;
      this.setRouteReveal(route, eased((elapsed - revealStart) / revealDuration));
    });

    if (!this.cinematicLabelsRevealed && elapsed >= 6_450) {
      this.cinematicLabelsRevealed = true;
      this.container.dataset.cinematic = 'settling';
      this.container.dispatchEvent(new CustomEvent('promptmiles:cinematicreveal', { bubbles: true }));
    }

    if (elapsed >= CINEMATIC_DURATION_MS) this.finishCinematic();
  }

  private updateMapLayers(): void {
    const reveal = this.cinematicMapReveal;
    const usTarget = this.currentStage.mapMode === 'us' ? reveal : 0;
    const worldTarget = this.currentStage.mapMode === 'world' ? reveal : 0;
    this.usMapVisibility = THREE.MathUtils.lerp(this.usMapVisibility, usTarget, 0.075);
    this.worldMapVisibility = THREE.MathUtils.lerp(this.worldMapVisibility, worldTarget, 0.075);
    updateGeoMapLayer(this.geoMaps.us, this.usMapVisibility);
    updateGeoMapLayer(this.geoMaps.world, this.worldMapVisibility);

    const mapVisibility = Math.max(this.usMapVisibility, this.worldMapVisibility);
    this.distanceField.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshBasicMaterial;
      const baseOpacity = Number(material.userData.baseOpacity ?? material.opacity);
      material.opacity = baseOpacity * THREE.MathUtils.lerp(1, 0.12, mapVisibility);
    });
    if (this.grid) {
      this.grid.material.opacity = this.worldMapVisibility > 0.01
        ? THREE.MathUtils.lerp(0.17, 0, this.worldMapVisibility)
        : THREE.MathUtils.lerp(0.17, 0.035, this.usMapVisibility);
    }
    if (this.ground) {
      this.ground.material.opacity = THREE.MathUtils.lerp(1, 0.04, this.worldMapVisibility);
      this.ground.visible = this.ground.material.opacity > 0.045;
    }

    this.carVisualScale = 1 - eased(this.worldMapVisibility / 0.56);
    this.car.scale.setScalar(Math.max(0.001, this.carVisualScale));
    this.car.visible = this.carVisualScale > 0.025;
    if (this.cinematicStartedAt !== null) {
      this.headlights.forEach((light) => { light.intensity *= this.carVisualScale; });
    }
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate = (timestamp?: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    this.timer.update(timestamp);
    const frameTime = timestamp ?? performance.now();
    const elapsed = this.timer.getElapsed();
    this.updateTransitions(frameTime);
    this.updateCinematic(frameTime);
    this.updateMapLayers();
    this.car.position.y = Math.sin(elapsed * 0.7) * 0.008;
    this.stars.rotation.y = elapsed * 0.0025;
    if (this.cinematicStartedAt === null) {
      this.headlights.forEach((light, index) => {
        light.intensity = (18 + Math.sin(elapsed * 1.15 + index * 0.7) * 2.2) * this.carVisualScale;
      });
    }
    this.pathGroup.children.forEach((route, index) => {
      const aura = route.userData.auraMaterial as THREE.MeshBasicMaterial | undefined;
      const markers = route.userData.markerMaterial as THREE.MeshStandardMaterial | undefined;
      if (aura) aura.opacity = 0.15 + Math.sin(elapsed * 1.2 + index * 1.7) * 0.025;
      if (markers) markers.emissiveIntensity = 3.8 + Math.sin(elapsed * 1.8 + index) * 0.7;
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.controls.dispose();
    disposeObject(this.car);
    this.environmentTexture?.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
