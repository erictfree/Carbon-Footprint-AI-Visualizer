import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function createCar(): THREE.Group {
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

  car.position.set(-3.1, 0, 0);
  return car;
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
  return THREE.MathUtils.clamp(3.2 + Math.log10(Math.max(0, miles) * 12 + 1) * 4.1, 3.2, 28);
}

export class PromptMilesScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly car = createCar();
  private readonly stars = createStars();
  private readonly timer = new THREE.Timer();
  private readonly resizeObserver: ResizeObserver;
  private readonly pathGroup = new THREE.Group();
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

    this.scene.fog = new THREE.FogExp2(0x07131d, 0.025);
    this.camera.position.set(8.4, 4.9, 9.8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.target.set(0.4, 0.9, 0);

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
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(70, 70, 0x1b6a70, 0x11343b);
    grid.material.transparent = true;
    grid.material.opacity = 0.17;
    grid.position.y = 0.012;
    this.scene.add(grid);

    this.scene.add(this.stars, this.car, this.pathGroup);
    this.setDistances(0.4, 650);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
  }

  setDistances(aiMiles: number, lifestyleMiles: number): void {
    for (const child of [...this.pathGroup.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
      else mesh.material?.dispose();
      this.pathGroup.remove(child);
    }

    this.pathGroup.add(
      this.createPath(aiMiles, -0.58, 0x42e8df, 0.11),
      this.createPath(lifestyleMiles, 0.58, 0xffa856, 0.095),
    );
  }

  private createPath(miles: number, lane: number, color: number, radius: number): THREE.Mesh {
    const length = visualLength(miles);
    const points = [
      new THREE.Vector3(-0.85, 0.13, lane),
      new THREE.Vector3(length * 0.22, 0.16, lane * 1.1),
      new THREE.Vector3(length * 0.52, 0.2 + Math.min(length / 90, 0.18), lane * 1.8),
      new THREE.Vector3(length, 0.26 + Math.min(length / 55, 0.38), lane * 2.4),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.45);
    const geometry = new THREE.TubeGeometry(curve, 80, radius, 10, false);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 3.2,
      transparent: true,
      opacity: 0.9,
      roughness: 0.3,
    });
    const path = new THREE.Mesh(geometry, material);
    path.receiveShadow = true;
    return path;
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
    const elapsed = this.timer.getElapsed();
    this.car.position.y = Math.sin(elapsed * 0.7) * 0.008;
    this.stars.rotation.y = elapsed * 0.0025;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
