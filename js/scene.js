// PAUSE-FUSE — 모든 장면이 공유하는 3D 배경 (개념 시각화)
// 해저케이블 위로 구리색 전기 진행파(양쪽 단자 방향)와 청록색 광섬유 진동(DAS)이 지나간다.
// 실제 계측 화면이나 실측 자료가 아니라 제품이 다루는 상황을 그림으로 옮긴 것이다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 04_brand/website_tokens.css
const COL = {
  abyss: 0x04121f, navy: 0x071d30, navy2: 0x0b2740, navy3: 0x12385a,
  cu: 0xe2874a, cu2: 0xf0a56e, fiber: 0x5fd0e8, fg: 0xedf3f8, fg2: 0xa9bbca,
};

const FOG = 0.02;

// 해저면 높이 (케이블도 이 위에 얹는다)
const seabedY = (x, z) =>
  0.9 * Math.sin(x * 0.08 + 0.5) * Math.cos(z * 0.07) +
  0.35 * Math.sin(x * 0.23 + z * 0.17) +
  0.18 * Math.sin(z * 0.41 - x * 0.13) - 0.25;

const cableZ = (x) => 2.4 * Math.sin(x * 0.06 + 0.4) + 0.8 * Math.sin(x * 0.17 + 1.3);

/* ── 셰이더 ─────────────────────────────────────────────── */

const CORE_VERT = /* glsl */`
  varying vec2 vUv;
  varying float vDepth;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

// uP[i] = (케이블 위 위치 0..1, 폭, 세기, -)
const CORE_FRAG = /* glsl */`
  uniform float uTime, uBase, uFlow, uFog, uGain, uPower, uEdge, uS;
  uniform vec3 uColor, uHot;
  uniform vec4 uP[4];
  varying vec2 vUv;
  varying float vDepth;
  void main(){
    float u = vUv.x / uS;
    float flow = 0.5 + 0.5 * sin(u * 1400.0 - uTime * uFlow);
    // uPower: 통전 정도(정전이면 0 에 가깝다). uEdge 보다 왼쪽은 다시 통전된 구간.
    float on = mix(uPower, 1.0, smoothstep(uEdge + 0.004, uEdge - 0.004, u));
    float glow = uBase * (0.5 + 0.5 * flow) * on;
    float p = 0.0;
    for (int i = 0; i < 4; i++){
      float d = (u - uP[i].x) / max(uP[i].y, 1e-5);
      p += uP[i].z * exp(-d * d);
    }
    p *= uGain;
    vec3 col = uColor * glow + mix(uColor, uHot, clamp(p * 0.3, 0.0, 1.0)) * p;
    float fog = exp(-vDepth * vDepth * uFog * uFog);
    // 카메라에 아주 가까울 때 번짐이 화면을 덮지 않게 누른다
    float near = mix(0.45, 1.0, smoothstep(2.0, 9.0, vDepth));
    gl_FragColor = vec4(col * fog * near, 1.0);
  }`;

const SEABED_VERT = /* glsl */`
  uniform float uTime, uPx, uFog, uSweep;
  uniform vec4 uRipple;   // xy = 중심(x,z), z = 경과 시간, w = 세기
  uniform vec4 uPulseA;   // xyz = 위치, w = 세기
  uniform vec4 uPulseB;
  attribute float aSeed;
  varying float vGlow, vRing, vCu, vFade;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;

    // 광섬유 진동이 해저면으로 퍼지는 원형 파면
    float d = distance(position.xz, uRipple.xy);
    float age = uRipple.z;
    float r = age * 7.0;
    float wd = 0.5 + age * 0.3;
    float q1 = (d - r) / wd;
    float q2 = (d - r * 0.6) / wd;
    float ring = exp(-q1 * q1) + 0.55 * exp(-q2 * q2);
    ring *= uRipple.w * exp(-age * 0.5);

    // 전기 진행파가 지나는 자리의 구리빛
    vec3 da = position - uPulseA.xyz;
    vec3 db = position - uPulseB.xyz;
    float cu = uPulseA.w * exp(-dot(da, da) / 7.0) + uPulseB.w * exp(-dot(db, db) / 7.0);

    float crest = smoothstep(-0.7, 1.0, position.y);
    float qs = (position.x - uSweep) / 2.2;
    float sweep = exp(-qs * qs);
    float tw = 0.75 + 0.25 * sin(uTime * 0.9 + aSeed * 40.0);

    vGlow = (0.34 + 0.95 * crest) * tw + sweep * 0.7;
    vRing = ring;
    vCu = cu;
    vFade = exp(-depth * depth * uFog * uFog * 0.7);

    float size = uPx * 58.0 / max(depth, 0.5);
    size *= 1.0 + 1.5 * ring + 1.1 * cu;
    gl_PointSize = clamp(size, 1.0, uPx * 9.0);
    gl_Position = projectionMatrix * mv;
  }`;

const SEABED_FRAG = /* glsl */`
  uniform vec3 uBase, uCyan, uCu;
  varying float vGlow, vRing, vCu, vFade;
  void main(){
    float a = smoothstep(0.5, 0.08, length(gl_PointCoord - 0.5));
    vec3 col = uBase * vGlow + uCyan * vRing * 2.2 + uCu * vCu * 1.7;
    gl_FragColor = vec4(col, a * vFade);
  }`;

const SNOW_VERT = /* glsl */`
  uniform float uTime, uPx, uFog;
  attribute vec3 aSeed;
  varying float vAlpha;
  void main(){
    vec3 p = position;
    p.y = mod(p.y - uTime * (0.1 + aSeed.x * 0.22), 17.0) - 1.5;
    p.x += sin(uTime * 0.23 + aSeed.y * 6.283) * 0.7;
    p.z += cos(uTime * 0.19 + aSeed.z * 6.283) * 0.7;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    gl_PointSize = clamp(uPx * (0.7 + aSeed.x * 1.9) * 24.0 / max(depth, 0.5), 1.0, uPx * 7.0);
    vAlpha = (0.16 + 0.42 * aSeed.y) * exp(-depth * depth * uFog * uFog * 1.6) * smoothstep(0.4, 3.0, depth);
    gl_Position = projectionMatrix * mv;
  }`;

const SNOW_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying float vAlpha;
  void main(){
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(uColor, a * vAlpha);
  }`;

const DOME_VERT = /* glsl */`
  varying vec3 vDir;
  void main(){
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const DOME_FRAG = /* glsl */`
  uniform vec3 uEnv, uHaze;
  varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    float up = smoothstep(-0.02, 0.75, d.y);
    vec3 col = mix(uEnv, uHaze, up * 0.85);
    float beam = pow(max(dot(d, normalize(vec3(0.62, 0.5, -0.6))), 0.0), 4.0);
    col += uHaze * beam * 1.25;
    gl_FragColor = vec4(col, 1.0);
  }`;

// 수면에서 내려오는 빛줄기
const RAY_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const RAY_FRAG = /* glsl */`
  uniform float uTime, uSeed, uGain;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main(){
    float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
    float along = smoothstep(0.0, 0.35, vUv.y) * (0.25 + 0.75 * vUv.y);
    float flick = 0.6 + 0.4 * sin(uTime * 0.35 + uSeed * 9.0);
    gl_FragColor = vec4(uColor, across * across * along * flick * uGain);
  }`;

// 닻이 끌리며 일으키는 해저 부유물
const SED_VERT = /* glsl */`
  uniform float uPx, uFog;
  attribute float aLife, aSize;
  varying float vA;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;
    float a = smoothstep(1.0, 0.88, aLife) * smoothstep(0.0, 0.55, aLife);
    vA = a * exp(-depth * depth * uFog * uFog * 1.2);
    gl_PointSize = clamp(uPx * aSize * (1.7 - aLife) * 64.0 / max(depth, 0.5), 1.0, uPx * 30.0);
    gl_Position = projectionMatrix * mv;
  }`;

const SED_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying float vA;
  void main(){
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(uColor, a * a * vA * 0.2);
  }`;

// 장면 02(문제)의 진행도 기준점 — scenes/problem.js 의 타임라인과 함께 쓴다
export const S2 = { impact: 0.2, relight0: 0.8, relight1: 0.92 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ── 장면 ───────────────────────────────────────────────── */

export class OceanScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.reduced = !!opts.reduced;
    this.small = Math.min(window.innerWidth, window.innerHeight) < 700;

    // main.js 의 GSAP 가 직접 움직이는 값
    //  progress: 장면 01 스크롤 0→1 / fly2: 01→02 이동 0→1 / s2: 장면 02 스크롤 0→1
    //  duel: 장면 03 의 두 사건 반복(0/1) / gates·gate: 장면 05 의 관문 표시와 진행(0..4)
    //  autoRig: 리그 시점에서도 무작위 사건을 낼지(0/1) / live: 0 이면 그리기를 쉰다(불투명 화면이 덮은 동안)
    this.params = { progress: 0, intro: this.reduced ? 1 : 0, auto: 1, dim: 0, fly2: 0, s2: 0, duel: 0, gates: 0, gate: 0, autoRig: 0, live: 1 };
    // 장면 03 이후의 카메라: 케이블의 x 지점을 기준으로 한 상대 위치. mix 가 1 이면 이 리그만 쓴다.
    //  dist: 케이블에서 +z 쪽 거리 / h: 높이 / ahead: 바라보는 지점이 x 로 얼마나 앞인지 / lift·tz: 바라보는 지점의 높이·z 보정
    this.rig = { mix: 0, x: 41, dist: 8.5, h: 2.6, ahead: 3.5, lift: 0.3, tz: 0 };
    this._rp = new THREE.Vector3();
    this._rt = new THREE.Vector3();
    this._nextDuel = 0;
    this.envColor = new THREE.Color(COL.abyss);

    this.time = 0;
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2();
    this.pointerS = new THREE.Vector2();
    this._queue = [];
    this._nextAuto = 4.5;
    this._v = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._tgt = new THREE.Vector3();

    this._initRenderer();
    this._initWorld();
    this._initCable();
    this._initSeabed();
    this._initSnow();
    this._initAnchor();
    this._initSediment();
    this._initStage();
    this._initPost();
    this._initCamera();

    this._onResize = () => this.resize();
    this._onPointer = (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointer, { passive: true });
    this.resize();
    this._tick = this._tick.bind(this);
  }

  /* 초기화 */

  _initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance',
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, this.small ? 1.5 : 2);
    renderer.setPixelRatio(this.dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(this.envColor, 1);
    this.renderer = renderer;
  }

  _initWorld() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COL.abyss, FOG);
    scene.fog.color = this.envColor;          // 같은 Color 를 공유해 배경 전환이 한 번에 반영되게
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);

    // 수면 쪽이 조금 밝은 물기둥
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { uEnv: { value: this.envColor }, uHaze: { value: new THREE.Color(0x1d5583) } },
        vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
        side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      }),
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.dome = dome;
    scene.add(dome);

    // 빛줄기: 멀리 오른쪽 위에서 비스듬히 내려온다
    this.rays = [];
    const rayGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uSeed: { value: Math.random() }, uGain: { value: 0.1 + Math.random() * 0.08 },
          uColor: { value: new THREE.Color(0x7fc4ea) },
        },
        vertexShader: RAY_VERT, fragmentShader: RAY_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      });
      const ray = new THREE.Mesh(rayGeo, mat);
      ray.scale.set(3.5 + Math.random() * 6, 46, 1);
      ray.position.set(8 + i * 6.5 + Math.random() * 3, 17, -14 - Math.random() * 16);
      ray.rotation.set(0, -0.9 + Math.random() * 0.3, -0.42 + Math.random() * 0.1);
      ray.renderOrder = -5;
      ray.userData.gain = mat.uniforms.uGain.value;
      this.rays.push(ray);
      scene.add(ray);
    }

    scene.add(new THREE.HemisphereLight(0x9cc3e2, 0x04121f, 2.3));
    const key = new THREE.DirectionalLight(0xd4e8f8, 3.4);
    key.position.set(-8, 14, 9);
    scene.add(key);

    this.lightCu = [new THREE.PointLight(COL.cu, 0, 12, 1.5), new THREE.PointLight(COL.cu, 0, 12, 1.5)];
    this.lightFb = new THREE.PointLight(COL.fiber, 0, 14, 1.5);
    scene.add(this.lightCu[0], this.lightCu[1], this.lightFb);
  }

  // x 좌표가 주어진 값이 되는 곡선 위치(0~1, 실제 호 길이 비율)
  _uRawAtX(x) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      if (this.curve.getPointAt(mid, this._v).x < x) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // 펄스 단위 u → 케이블 위 3D 위치
  pointAtU(u, target) {
    return this.curve.getPointAt(clamp01(u * this.uS), target);
  }

  _coreMaterial(color, hot, base, flow) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBase: { value: base }, uFlow: { value: flow }, uFog: { value: FOG }, uGain: { value: 1 },
        uPower: { value: 1 }, uEdge: { value: -1 }, uS: { value: this.uS },
        uColor: { value: new THREE.Color(color) }, uHot: { value: new THREE.Color(hot) },
        uP: { value: [new THREE.Vector4(-1, 1, 0, 0), new THREE.Vector4(-1, 1, 0, 0), new THREE.Vector4(-1, 1, 0, 0), new THREE.Vector4(-1, 1, 0, 0)] },
      },
      vertexShader: CORE_VERT, fragmentShader: CORE_FRAG,
    });
  }

  _initCable() {
    const pts = [];
    for (let x = -84; x <= 132; x += 3) {
      const z = cableZ(x);
      pts.push(new THREE.Vector3(x, seabedY(x, z) + 0.46, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    curve.arcLengthDivisions = 1100;
    this.curve = curve;
    // 펄스 위치값 u 는 "x=-84~84 구간을 0~1" 로 보는 단위다. 케이블을 x=132 까지 늘렸으므로
    // 실제 곡선 위치(0~1)로 바꿀 때 uS 를 곱한다. (셰이더도 같은 변환을 한다)
    this.uS = this._uRawAtX(84);

    const R = 0.34;
    const group = new THREE.Group();

    // 외피
    const sheath = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 900, R, 20, false),
      new THREE.MeshStandardMaterial({ color: 0x1f5480, roughness: 0.42, metalness: 0.3 }),
    );
    group.add(sheath);

    // 외피를 감는 도체 3가닥(3상)과 광섬유 1가닥
    const N = 1160;
    const frames = curve.computeFrenetFrames(N, false);
    const strand = (angle0, radius, turns) => {
      const p = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = angle0 + turns * Math.PI * 2 * t;
        p.push(curve.getPointAt(t)
          .addScaledVector(frames.normals[i], Math.cos(a) * radius)
          .addScaledVector(frames.binormals[i], Math.sin(a) * radius));
      }
      const c = new THREE.CatmullRomCurve3(p);
      c.arcLengthDivisions = 2300;
      return c;
    };

    const turns = 24 / this.uS;      // 늘어난 길이에서도 꼬임 간격을 그대로
    this.matCu = this._coreMaterial(COL.cu, 0xfff0df, 1.15, 5.0);
    for (let k = 0; k < 3; k++) {
      const c = strand((k * Math.PI * 2) / 3, R + 0.012, turns);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 1930, 0.036, 6, false), this.matCu));
    }
    this.matFb = this._coreMaterial(COL.fiber, 0xf2fdff, 1.2, -3.2);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(strand(Math.PI / 3, R + 0.02, -turns / 2), 1930, 0.024, 6, false), this.matFb));

    // 일정 간격의 고정 링
    const ringGeo = new THREE.TorusGeometry(R + 0.045, 0.04, 8, 28);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x25577f, roughness: 0.35, metalness: 0.55 });
    const count = 82;
    const rings = new THREE.InstancedMesh(ringGeo, ringMat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      q.setFromUnitVectors(zAxis, curve.getTangentAt(t));
      m.compose(curve.getPointAt(t), q, one);
      rings.setMatrixAt(i, m);
    }
    rings.instanceMatrix.needsUpdate = true;
    group.add(rings);

    this.scene.add(group);

    // 전기 진행파 4개(좌·우 1차 + 뒤따르는 2차), 광섬유 진동 3개(중심 + 좌·우로 퍼짐)
    this.ePulses = Array.from({ length: 4 }, () => ({ pos: -1, vel: 0, amp: 0, w: 0.0045 }));
    this.dPulses = Array.from({ length: 3 }, () => ({ pos: -1, vel: 0, amp: 0, w: 0.004, grow: 0 }));
    this.ripple = { x: 0, z: 0, age: 99, amp: 0 };
  }

  _initSeabed() {
    const step = this.small ? 0.82 : 0.62;
    const x0 = -70, x1 = 132, z0 = -44, z1 = 30;
    const nx = Math.floor((x1 - x0) / step), nz = Math.floor((z1 - z0) / step);
    const pos = new Float32Array(nx * nz * 3);
    const seed = new Float32Array(nx * nz);
    let k = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = x0 + i * step + (Math.random() - 0.5) * step * 0.35;
        const z = z0 + j * step + (Math.random() - 0.5) * step * 0.35;
        pos[k * 3] = x; pos[k * 3 + 1] = seabedY(x, z); pos[k * 3 + 2] = z;
        seed[k] = Math.random();
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.matSeabed = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uPx: { value: this.dpr }, uFog: { value: FOG }, uSweep: { value: -80 },
        uRipple: { value: new THREE.Vector4(0, 0, 99, 0) },
        uPulseA: { value: new THREE.Vector4() }, uPulseB: { value: new THREE.Vector4() },
        uBase: { value: new THREE.Color(0x3d8fd0) },
        uCyan: { value: new THREE.Color(COL.fiber) }, uCu: { value: new THREE.Color(COL.cu) },
      },
      vertexShader: SEABED_VERT, fragmentShader: SEABED_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, this.matSeabed);
    points.frustumCulled = false;
    this.scene.add(points);
  }

  _initSnow() {
    const n = this.small ? 1300 : 3200;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -34 + Math.random() * 146;
      pos[i * 3 + 1] = Math.random() * 17;
      pos[i * 3 + 2] = -34 + Math.random() * 54;
      seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    this.matSnow = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.dpr }, uFog: { value: FOG }, uColor: { value: new THREE.Color(COL.fg2) } },
      vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, this.matSnow);
    points.frustumCulled = false;
    this.scene.add(points);
  }

  // 장면 02: 닻과 사슬. 닻은 카메라에서 멀어지는 방향으로 끌려가다 케이블(x=30)에 걸린다.
  _initAnchor() {
    const up = new THREE.Vector3(0, 1, 0);
    const d = new THREE.Vector3(-0.25, 0, -0.97).normalize();
    this.dragDir = d;

    // 케이블 위 x=30 지점과 그 위치값(0..1)
    this.uImpact = this._uRawAtX(30) / this.uS;
    this.impactPoint = this.pointAtU(this.uImpact, new THREE.Vector3());

    // 닻 머리(크라운)가 지나는 직선 경로: 걸리는 순간 아래쪽 닻가지가 케이블에 닿는다
    const end = this.impactPoint.clone().addScaledVector(d, -1.2);
    const start = end.clone().addScaledVector(d, -11);
    this.anchorPath = { start, end };

    const metal = new THREE.MeshStandardMaterial({ color: 0x6b8194, roughness: 0.55, metalness: 0.5 });
    const body = new THREE.Group();   // 로컬 +Y = 자루(머리→고리), XY 평면 = 닻가지
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.12, 2.4, 10), metal);
    shank.position.y = 1.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 20), metal);
    ring.position.y = 2.56; ring.rotation.y = Math.PI / 2;
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), metal);
    stock.rotation.x = Math.PI / 2; stock.position.y = 2.1;
    const arc = Math.PI * 0.8;
    const a0 = Math.PI + (Math.PI - arc) / 2;
    const arms = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.105, 8, 28, arc), metal);
    arms.rotation.z = a0; arms.position.y = 0.95;
    body.add(shank, ring, stock, arms);
    const yAxis = new THREE.Vector3(0, 1, 0);
    [a0, a0 + arc].forEach((ang, i) => {
      const dir = new THREE.Vector3(i === 0 ? -0.45 : 0.45, 1, 0).normalize();
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 4), metal);
      fluke.scale.z = 0.3;
      fluke.quaternion.setFromUnitVectors(yAxis, dir);
      fluke.position.set(0.95 * Math.cos(ang), 0.95 + 0.95 * Math.sin(ang), 0).addScaledVector(dir, 0.2);
      body.add(fluke);
    });

    // 사슬: 끌려가는 방향 앞·위로 뻗어 안개 속으로 사라진다
    const cdir = d.clone().multiplyScalar(0.6).addScaledVector(up, 0.8).normalize();
    const links = 112;
    const chain = new THREE.InstancedMesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), metal, links);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const q0 = new THREE.Quaternion().setFromUnitVectors(xAxis, cdir);
    const q1 = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI / 2));
    const m = new THREE.Matrix4(), s = new THREE.Vector3(1.5, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < links; i++) {
      p.copy(cdir).multiplyScalar(0.18 + i * 0.215);
      m.compose(p, i % 2 ? q1 : q0, s);
      chain.setMatrixAt(i, m);
    }
    chain.instanceMatrix.needsUpdate = true;
    chain.frustumCulled = false;

    const group = new THREE.Group();
    group.add(body, chain);
    group.visible = false;
    this.anchor = { group, body, chain, up, shankDir: new THREE.Vector3(), xw: new THREE.Vector3(), zw: new THREE.Vector3(), basis: new THREE.Matrix4(), prev: start.clone(), emit: 0, lastRipple: -9 };
    this.scene.add(group);

    this.lightAnchor = new THREE.PointLight(0xc4e2ff, 0, 24, 1.4);
    this.scene.add(this.lightAnchor);
    this._impactTime = -99;
    this._shake = 0;
    this._prevS2 = 0;
  }

  _initSediment() {
    const n = 700;
    const geo = new THREE.BufferGeometry();
    this.sed = {
      n, cursor: 0, alive: 0,
      pos: new Float32Array(n * 3), vel: new Float32Array(n * 3),
      life: new Float32Array(n), rate: new Float32Array(n), size: new Float32Array(n),
    };
    geo.setAttribute('position', new THREE.BufferAttribute(this.sed.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.sed.life, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sed.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: this.dpr }, uFog: { value: FOG }, uColor: { value: new THREE.Color(0xb4c4d2) } },
      vertexShader: SED_VERT, fragmentShader: SED_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.sed.geo = geo;
    this.scene.add(points);
  }

  _emitSediment(x, y, z, vx, vy, vz, spread, size, lifeSec) {
    const s = this.sed, i = s.cursor;
    s.cursor = (s.cursor + 1) % s.n;
    s.pos[i * 3] = x + (Math.random() - 0.5) * spread;
    s.pos[i * 3 + 1] = y + Math.random() * spread * 0.5;
    s.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
    s.vel[i * 3] = vx; s.vel[i * 3 + 1] = vy; s.vel[i * 3 + 2] = vz;
    s.life[i] = 1;
    s.rate[i] = 1 / lifeSec;
    s.size[i] = size;
  }

  _updateSediment(dt) {
    const s = this.sed;
    let alive = 0;
    const drag = Math.exp(-dt * 1.5);
    for (let i = 0; i < s.n; i++) {
      if (s.life[i] <= 0) continue;
      s.life[i] = Math.max(0, s.life[i] - s.rate[i] * dt);
      s.vel[i * 3] *= drag; s.vel[i * 3 + 1] = s.vel[i * 3 + 1] * drag + 0.03 * dt; s.vel[i * 3 + 2] *= drag;
      s.pos[i * 3] += s.vel[i * 3] * dt;
      s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
      s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
      alive++;
    }
    if (alive || s.alive) {
      s.geo.attributes.position.needsUpdate = true;
      s.geo.attributes.aLife.needsUpdate = true;
      s.geo.attributes.aSize.needsUpdate = true;
    }
    s.alive = alive;
  }

  // 닻이 케이블에 걸리는 순간 (장면 02 진행도가 S2.impact 를 앞으로 넘을 때 한 번)
  _impact() {
    const P = this.impactPoint, d = this.dragDir;
    this._impactTime = this.time;
    this._shake = 1;
    this._startDas(this.uImpact);
    this._startElec(this.uImpact);
    this.ePulses[0].amp = this.ePulses[1].amp = 9;
    this.ripple.amp = 1.7;
    for (let i = 0; i < 240; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 3.2;
      this._emitSediment(P.x, P.y - 0.3, P.z,
        Math.cos(a) * sp + d.x * 1.2, 0.3 + Math.random() * 2.4, Math.sin(a) * sp + d.z * 1.2,
        0.5, 0.7 + Math.random() * 1.6, 2.2 + Math.random() * 3.2);
    }
  }

  _updateAnchor(dt, fly, s2) {
    const A = this.anchor, d = this.dragDir, t = this.time;
    const on = fly > 0.001 && this.rig.mix < 0.995;      // 장면 03 이후(리그 시점)에는 닻을 치운다
    A.group.visible = on;
    this.lightAnchor.intensity = on ? 30 * fly : 0;
    if (!on) return;

    const travel = fly * 0.45 + clamp01(s2 / S2.impact) * 0.55;
    const q = clamp01((s2 - S2.impact) / 0.08);
    const post = 1 - Math.pow(1 - q, 3);                       // 걸린 뒤 조금 더 끌리며 기운다
    const pos = A.group.position;
    pos.lerpVectors(this.anchorPath.start, this.anchorPath.end, travel).addScaledVector(d, 0.3 * post);
    const speed = Math.min(pos.distanceTo(A.prev) / Math.max(dt, 1e-3), 14);
    A.prev.copy(pos);
    const moving = clamp01(speed / 2);
    pos.y = seabedY(pos.x, pos.z) + 1.15 + Math.abs(Math.sin(t * 7.3)) * 0.07 * moving;

    const tilt = THREE.MathUtils.degToRad(15 + 12 * post) + Math.sin(t * 9.1) * 0.025 * moving;
    A.shankDir.copy(d).multiplyScalar(Math.cos(tilt)).addScaledVector(A.up, Math.sin(tilt)).normalize();
    A.xw.copy(A.up).addScaledVector(A.shankDir, -A.up.dot(A.shankDir)).normalize();
    A.zw.crossVectors(A.xw, A.shankDir);
    A.body.quaternion.setFromRotationMatrix(A.basis.makeBasis(A.xw, A.shankDir, A.zw));
    A.chain.position.copy(A.shankDir).multiplyScalar(2.56);
    this.lightAnchor.position.set(pos.x - 2.5, pos.y + 5, pos.z - 4.5);

    // 끌리는 동안: 부유물 + 해저면 진동(광섬유가 먼저 감지)
    const cx = pos.x + d.x * 0.6, cz = pos.z + d.z * 0.6, cy = seabedY(cx, cz) + 0.05;
    A.emit += Math.min(speed * dt * 16, 30);
    while (A.emit >= 1) {
      A.emit -= 1;
      this._emitSediment(cx, cy, cz,
        -d.x * (0.2 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.7, 0.15 + Math.random() * 0.7,
        -d.z * (0.2 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.7,
        0.5, 0.6 + Math.random() * 1.2, 2 + Math.random() * 2.6);
    }
    if (speed > 0.4 && s2 < S2.impact && t - A.lastRipple > 0.85) {
      A.lastRipple = t;
      this.ripple = { x: cx, z: cz, age: 0, amp: 0.3 + 0.5 * travel };
      this.dPulses[0] = { pos: this.uImpact, vel: 0, amp: 0.8 + 2.6 * travel * travel, w: 0.003, grow: 0.004 };
    }
  }

  // 장면 03·05 용: 두 사건이 일어나는 지점과 네 개의 단계 관문
  _initStage() {
    const at = (x) => this._uRawAtX(x) / this.uS;
    this.duel = { uE: at(46), uD: at(42.6) };
    this.duel.pE = this.pointAtU(this.duel.uE, new THREE.Vector3());
    this.duel.pD = this.pointAtU(this.duel.uD, new THREE.Vector3());

    this.gates = [50, 55.5, 61, 66.5].map((x) => {
      const u = this._uRawAtX(x);
      const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.03, 8, 96), mat);
      mesh.position.copy(this.curve.getPointAt(u));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.curve.getTangentAt(u));
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    });
    this._cGate = [new THREE.Color(COL.fiber), new THREE.Color(COL.cu2)];
  }

  _updateStage(t) {
    const P = this.params;
    // 장면 03: 가까운 두 지점에서 진동 → 전기 사건이 되풀이된다
    if (P.duel > 0.5 && t > this._nextDuel) {
      this._nextDuel = t + 3.1;
      this._queue.push({ t, kind: 'das', u: this.duel.uD });
      this._queue.push({ t: t + 0.5, kind: 'elec', u: this.duel.uE });
    }
    // 장면 05: 지나간 관문은 구리색으로 켜진 채 남는다
    const on = clamp01(P.gates);
    this.gates.forEach((g, i) => {
      g.visible = on > 0.002;
      if (!g.visible) return;
      const d = g.position.distanceTo(this.camera.position);
      // 카메라가 관문을 통과하는 순간에는 고리가 화면을 덮으므로 가까울수록 어둡게 한다
      const fade = Math.exp(-d * d * FOG * FOG) * on * THREE.MathUtils.smoothstep(d, 1.6, 7);
      const lit = clamp01(P.gate - i);
      const flash = Math.max(0, 1 - Math.abs(P.gate - i - 0.5) * 2.2);
      g.material.color.copy(this._cGate[0]).multiplyScalar(0.34 * (1 - lit) * fade);
      g.material.color.r += this._cGate[1].r * (lit * 1.5 + flash * 2.6) * fade;
      g.material.color.g += this._cGate[1].g * (lit * 1.5 + flash * 2.6) * fade;
      g.material.color.b += this._cGate[1].b * (lit * 1.5 + flash * 2.6) * fade;
      g.scale.setScalar(1 + flash * 0.12);
    });
  }

  // 3D 위치가 화면의 어느 픽셀에 있는지 (구리색 원형 전환의 중심을 충격 지점에 맞추는 데 쓴다)
  screenOf(v) {
    this._v.copy(v).project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * window.innerWidth, y: (-this._v.y * 0.5 + 0.5) * window.innerHeight };
  }

  _initPost() {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.small ? 0 : 4 });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(this.dpr);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.95, 0.8, 0.16);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  _initCamera() {
    // 히어로 스크롤(progress 0→1) 동안 넓은 전경에서 케이블 바로 위까지 내려간다
    // (케이블은 z 방향으로 굽이치므로 카메라는 항상 케이블에서 2.5 이상 떨어진 쪽에 둔다)
    //
    // 전체 여정 j = progress + fly2 + s2 (0..3). 키프레임은 j 가 1/3 늘 때마다 하나씩이다.
    this.camPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-13.5, 4.3, 10.5),   // j=0    장면 01 시작
      new THREE.Vector3(-7.0, 2.7, 7.6),
      new THREE.Vector3(-1.5, 1.8, 5.8),
      new THREE.Vector3(4.5, 1.4, 5.2),      // j=1    장면 01 끝
      new THREE.Vector3(10.0, 2.3, 7.6),
      new THREE.Vector3(15.0, 3.1, 10.0),
      new THREE.Vector3(19.0, 3.2, 11.5),    // j=2    장면 02 시작: 닻이 다가오는 것을 지켜본다
      new THREE.Vector3(22.5, 2.3, 9.2),     //        충격 직후 가장 가까이
      new THREE.Vector3(25.0, 3.6, 12.5),    //        물러나 멈춘 케이블을 본다
      new THREE.Vector3(30.0, 2.2, 10.0),    // j=3    장면 02 끝: 케이블을 따라 다시 나아간다
    ]);
    this.tgtPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(6, 0.6, -1.4),
      new THREE.Vector3(10, 0.5, -0.6),
      new THREE.Vector3(16, 0.5, 0.6),
      new THREE.Vector3(24, 0.6, 0.4),
      new THREE.Vector3(27, 0.6, 1.2),
      new THREE.Vector3(29, 0.6, 1.8),
      new THREE.Vector3(30, 0.5, 1.6),
      new THREE.Vector3(30.5, 0.6, 1.6),
      new THREE.Vector3(31, 0.6, 1.2),
      new THREE.Vector3(44, 0.6, 0.5),
    ]);
  }

  /* 사건: 가까운 곳에서 진동과 전기 이상이 잇따라 일어나는 상황 */

  fireEvent(o = {}) {
    // 사건 위치: 장면 01 은 스크롤에 따라 앞으로, 리그 시점에서는 카메라가 바라보는 곳 근처
    const base = this.rig.mix > 0.5
      ? this._uRawAtX(this.rig.x + this.rig.ahead * 0.8) / this.uS
      : THREE.MathUtils.lerp(0.552, 0.668, this.params.progress);
    const u0 = o.u ?? base + (Math.random() - 0.5) * 0.024;
    const du = o.du ?? (Math.random() < 0.5 ? -1 : 1) * (0.012 + Math.random() * 0.016);
    const lead = o.lead ?? 0.3 + Math.random() * 0.45;
    this._queue.push({ t: this.time, kind: 'das', u: u0 + du });
    this._queue.push({ t: this.time + lead, kind: 'elec', u: u0 });
    this._nextAuto = this.time + 6 + Math.random() * 2.5;
  }

  _startDas(u) {
    const p = this.dPulses;
    p[0] = { pos: u, vel: 0, amp: 6.0, w: 0.004, grow: 0.006 };
    p[1] = { pos: u, vel: -0.018, amp: 3.2, w: 0.0032, grow: 0.0015 };
    p[2] = { pos: u, vel: 0.018, amp: 3.2, w: 0.0032, grow: 0.0015 };
    const c = this.pointAtU(u, this._v);
    this.ripple = { x: c.x, z: c.z, age: 0, amp: 1 };
    this.lightFb.position.set(c.x, c.y + 0.9, c.z);
  }

  _startElec(u) {
    const p = this.ePulses;
    p[0] = { pos: u, vel: -0.105, amp: 6.5, w: 0.006 };
    p[1] = { pos: u, vel: 0.105, amp: 6.5, w: 0.006 };
    p[2] = { pos: u, vel: -0.07, amp: 2.4, w: 0.0035 };
    p[3] = { pos: u, vel: 0.07, amp: 2.4, w: 0.0035 };
  }

  /* 프레임 */

  _update(dt) {
    const t = (this.time += dt);
    const P = this.params;

    this._queue.sort((a, b) => a.t - b.t);
    while (this._queue.length && this._queue[0].t <= t) {
      const ev = this._queue.shift();
      if (ev.kind === 'das') this._startDas(ev.u); else this._startElec(ev.u);
    }
    const prog = clamp01(P.progress), fly = clamp01(P.fly2), s2 = clamp01(P.s2);
    // 장면 01 에서만 무작위 사건을 낸다. 장면 02 는 닻이 사건을 만든다.
    if (!this.reduced && P.auto > 0.5 && (fly < 0.02 || P.autoRig > 0.5) && t > this._nextAuto) this.fireEvent();
    this._updateStage(t);

    // 장면 02: 닻 이동 → 충격(앞으로 넘을 때 한 번) → 정전 → 재통전
    this._updateAnchor(dt, fly, s2);
    if (fly > 0.5 && this._prevS2 < S2.impact && s2 >= S2.impact) this._impact();
    this._prevS2 = s2;
    let power = 1, edge = -1;
    if (s2 >= S2.impact && s2 < S2.relight1) {
      power = 0.03;
      const since = t - this._impactTime;
      if (s2 < S2.relight0) {
        if (since >= 0 && since < 1.2) power += (0.5 + 0.5 * Math.sin(since * 70)) * Math.exp(-since * 4.5) * 0.9;   // 꺼지며 깜빡임
      } else {
        // 왼쪽 단자에서부터 다시 켜지는 전면
        edge = lerp(0.52, 0.98, (s2 - S2.relight0) / (S2.relight1 - S2.relight0));
        this.ePulses[0] = { pos: edge, vel: 0, amp: 2.6, w: 0.004 };
      }
    }
    this.matCu.uniforms.uPower.value = power;
    this.matCu.uniforms.uEdge.value = edge;
    this._updateSediment(dt);
    this._shake *= Math.exp(-dt * 3.4);

    const gainNow = this.matCu.uniforms.uGain.value;

    // 전기 진행파
    const uE = this.matCu.uniforms.uP.value;
    this.ePulses.forEach((p, i) => {
      if (p.amp > 0.002) {
        p.pos += p.vel * dt;
        p.amp *= Math.exp(-dt * 0.42);
        if (p.pos < -0.02 || p.pos > 1 / this.uS + 0.02) p.amp = 0;
      } else p.amp = 0;
      uE[i].set(p.pos, p.w, p.amp, 0);
    });
    const sb = this.matSeabed.uniforms;
    [sb.uPulseA.value, sb.uPulseB.value].forEach((u4, i) => {
      const p = this.ePulses[i];
      const c = this.pointAtU(p.pos, this._v);
      u4.set(c.x, c.y - 0.4, c.z, Math.min(p.amp, 3) * 0.42);
      this.lightCu[i].position.set(c.x, c.y + 0.7, c.z);
      this.lightCu[i].intensity = p.amp * 9 * gainNow;
    });

    // 광섬유 진동
    const uD = this.matFb.uniforms.uP.value;
    this.dPulses.forEach((p, i) => {
      if (p.amp > 0.002) {
        p.pos += p.vel * dt;
        p.w += p.grow * dt;
        p.amp *= Math.exp(-dt * 0.62);
      } else p.amp = 0;
      uD[i].set(p.pos, p.w, p.amp, 0);
    });
    this.ripple.age += dt;
    sb.uRipple.value.set(this.ripple.x, this.ripple.z, this.ripple.age, this.ripple.amp);
    this.lightFb.intensity = 34 * Math.exp(-this.ripple.age * 1.1) * this.ripple.amp * gainNow;

    sb.uTime.value = t;
    sb.uSweep.value = -70 + ((t * 9) % 230);
    this.matCu.uniforms.uTime.value = t;
    this.matFb.uniforms.uTime.value = t;
    this.matSnow.uniforms.uTime.value = t;
    // 빛줄기는 첫 장면 쪽(x<24)에만 둔다. 카메라가 그 안으로 들어가면 화면을 하얗게 덮으므로 멀어질수록 끈다.
    const rayFade = 1 - THREE.MathUtils.smoothstep(this.camera.position.x, 24, 40);
    this.rays.forEach((r) => {
      r.material.uniforms.uTime.value = t;
      r.material.uniforms.uGain.value = r.userData.gain * rayFade;
      r.visible = rayFade > 0.002;
    });
    // 카메라가 케이블에 다가갈수록(progress↑), 다음 장면으로 넘어갈수록(dim↑) 빛을 줄인다
    const gain = lerp(lerp(1, 0.55, prog), 0.95, fly) * (1 - 0.45 * P.dim);
    this.matCu.uniforms.uGain.value = gain;
    this.matFb.uniforms.uGain.value = gain;
    this.bloom.strength = lerp(lerp(0.95, 0.7, prog), 0.9, fly) + this._shake * 0.9;
    this.renderer.toneMappingExposure = 1.15 * (1 - 0.45 * P.dim);

    // 카메라
    const j = (prog + fly + s2) / 3;
    this.camPath.getPoint(j, this._pos);
    this.tgtPath.getPoint(j, this._tgt);
    // 장면 03 이후: 케이블 기준 리그로 넘어간다
    const R = this.rig;
    if (R.mix > 0.0005) {
      const m = clamp01(R.mix);
      const cz = cableZ(R.x), ax = R.x + R.ahead, az = cableZ(ax);
      this._rp.set(R.x, seabedY(R.x, cz) + 0.46 + R.h, cz + R.dist);
      this._rt.set(ax, seabedY(ax, az) + 0.46 + R.lift, az + R.tz);
      this._pos.lerp(this._rp, m);
      this._tgt.lerp(this._rt, m);
    }
    const k = 1 - P.intro;
    this._pos.x -= 5 * k; this._pos.y += 3.6 * k; this._pos.z += 7 * k;
    if (this._shake > 0.003) {
      this._pos.x += (Math.sin(t * 61) + Math.sin(t * 37.7)) * 0.08 * this._shake;
      this._pos.y += Math.sin(t * 53.3) * 0.12 * this._shake;
    }

    this.pointerS.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));
    const calm = this.reduced ? 0 : 1;
    this._pos.x += (Math.sin(t * 0.31) * 0.1 + this.pointerS.x * 0.7) * calm;
    this._pos.y += (Math.sin(t * 0.47) * 0.06 - this.pointerS.y * 0.32) * calm;

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._tgt);
    this.camera.rotateZ((Math.sin(t * 0.23) * 0.006 - this.pointerS.x * 0.012) * calm);
    this.dome.position.copy(this._pos);
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this._sized) return;          // 창이 숨겨져 크기가 0 인 동안은 그리지 않는다
    if (this.params.live < 0.5) return; // 불투명한 화면이 캔버스를 완전히 덮은 동안은 쉰다
    this._update(dt);
    this.composer.render();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this._sized = w > 0 && h > 0;
    if (!this._sized) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // 세로 화면에서는 케이블이 잘리지 않게 화각을 넓힌다
    this.camera.fov = w / h < 0.8 ? 58 : w / h < 1.25 ? 46 : 36;
    this.camera.updateProjectionMatrix();
  }

  start() { this.renderer.setAnimationLoop(this._tick); }
  stop() { this.renderer.setAnimationLoop(null); }
}
