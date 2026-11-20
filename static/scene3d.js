// 3D-сцена парной для шапки страницы бань и саун.
// Всё строится из простых фигур и процедурных текстур: никаких внешних моделей и файлов,
// поэтому нет вопросов с лицензиями и страница грузится быстро.
// Варианты: classic (финская сауна), wood (баня на дровах), pool (сауна с бассейном), hammam (хаммам).

import * as THREE from './vendor/three.module.min.js';

const rnd = mulberry32(7);
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- процедурные текстуры ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

function woodTex(base, { planks = 8, vertical = true, dark = 0.55, repeat = [1, 1] } = {}) {
  return canvasTex(512, 512, (g, w, h) => {
    const col = new THREE.Color(base);
    const size = vertical ? w / planks : h / planks;
    for (let i = 0; i < planks; i++) {
      const c = col.clone().offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08);
      g.fillStyle = `#${c.getHexString()}`;
      if (vertical) g.fillRect(i * size, 0, size, h);
      else g.fillRect(0, i * size, w, size);
      // волокна дерева
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(60,30,10,${0.04 + rnd() * 0.08})`;
        g.lineWidth = 0.6 + rnd() * 1.4;
        g.beginPath();
        const off = rnd() * size;
        const amp = 1 + rnd() * 4;
        const freq = 0.01 + rnd() * 0.03;
        for (let s = 0; s <= (vertical ? h : w); s += 8) {
          const a = off + Math.sin(s * freq + k) * amp;
          if (vertical) g.lineTo(i * size + a, s);
          else g.lineTo(s, i * size + a);
        }
        g.stroke();
      }
      // сучок
      if (rnd() < 0.35) {
        const kx = vertical ? i * size + size * (0.3 + rnd() * 0.4) : rnd() * w;
        const ky = vertical ? rnd() * h : i * size + size * (0.3 + rnd() * 0.4);
        const rg = g.createRadialGradient(kx, ky, 1, kx, ky, 9);
        rg.addColorStop(0, 'rgba(70,35,12,0.7)');
        rg.addColorStop(1, 'rgba(70,35,12,0)');
        g.fillStyle = rg;
        g.beginPath();
        g.ellipse(kx, ky, vertical ? 5 : 10, vertical ? 10 : 5, 0, 0, Math.PI * 2);
        g.fill();
      }
      // щель между досками
      g.fillStyle = `rgba(25,12,4,${dark})`;
      if (vertical) g.fillRect(i * size, 0, 2, h);
      else g.fillRect(0, i * size, w, 2);
    }
  }, repeat);
}

function tileTex(base, grout, n = 8, repeat = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = grout;
    g.fillRect(0, 0, w, h);
    const s = w / n;
    const col = new THREE.Color(base);
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++) {
        const c = col.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
        g.fillStyle = `#${c.getHexString()}`;
        g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
  }, repeat);
}

function marbleTex(repeat = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e9e4dc';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(120,110,100,${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.5 + rnd() * 2;
      g.beginPath();
      let x = rnd() * w, y = 0;
      g.moveTo(x, y);
      while (y < h) {
        x += (rnd() - 0.5) * 30;
        y += 10 + rnd() * 20;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(160,150,140,0.5)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
      g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
    }
  }, repeat);
}

function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,0.9)');
  rg.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- сборка сцены ----------
const W = 8; // ширина помещения
const D = 6; // глубина
const H = 3.4; // высота

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function buildRoom(variant) {
  const g = new THREE.Group();
  const hammam = variant === 'hammam';
  const wood = variant === 'wood';

  const wallMat = hammam
    ? new THREE.MeshStandardMaterial({ map: marbleTex([2, 1]), roughness: 0.35, metalness: 0 })
    : new THREE.MeshStandardMaterial({ map: woodTex(wood ? '#8a5a32' : '#c9935a', { planks: wood ? 6 : 10, vertical: !wood, repeat: [3, 1] }), roughness: 0.75 });
  const floorMat = hammam
    ? new THREE.MeshStandardMaterial({ map: marbleTex([3, 2]), roughness: 0.25 })
    : new THREE.MeshStandardMaterial({ map: woodTex('#7a4f2c', { planks: 10, vertical: false, repeat: [2, 2] }), roughness: 0.8 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: hammam ? '#d8d2c8' : '#5a3a20', roughness: 0.9 });

  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  back.position.set(0, H / 2, -D / 2);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-W / 2, H / 2, 0);
  const right = left.clone();
  right.rotation.y = -Math.PI / 2;
  right.position.x = W / 2;
  // пол; для зала с бассейном — с проёмом под чашу (x ±1.8, z от -0.15 до 1.65)
  const floor = new THREE.Group();
  const zMin = -D / 2, zMax = D / 2 + 4;
  const pieces = variant === 'pool'
    ? [[-W / 2, -1.8, zMin, zMax], [1.8, W / 2, zMin, zMax], [-1.8, 1.8, zMin, -0.15], [-1.8, 1.8, 1.65, zMax]]
    : [[-W / 2, W / 2, zMin, zMax]];
  for (const [x0, x1, z0, z1] of pieces) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorMat);
    f.rotation.x = -Math.PI / 2;
    f.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    floor.add(f);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D + 4), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, 2);
  g.add(back, left, right, floor, ceil);

  if (wood) {
    // бревенчатые стены: горизонтальные брёвна поверх досок
    const logMat = new THREE.MeshStandardMaterial({ map: woodTex('#9a6538', { planks: 4, vertical: false, repeat: [4, 1] }), roughness: 0.8 });
    for (let y = 0.15; y < H; y += 0.3) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, W, 14), logMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(0, y, -D / 2 + 0.1);
      g.add(log);
    }
  }
  return g;
}

function buildBenches(variant) {
  const g = new THREE.Group();
  if (variant === 'hammam') {
    // центральный тёплый камень (гёбек-ташы) и мраморные лежаки вдоль стены
    const marble = new THREE.MeshStandardMaterial({ map: marbleTex([1, 1]), roughness: 0.3 });
    const navel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.55, 8), marble);
    navel.position.set(0, 0.275, 0.2);
    g.add(navel, box(W - 1, 0.5, 0.8, marble, 0, 0.25, -D / 2 + 0.4));
    return g;
  }
  const slat = new THREE.MeshStandardMaterial({ map: woodTex('#e0b07a', { planks: 3, vertical: false }), roughness: 0.6 });
  const leg = new THREE.MeshStandardMaterial({ color: '#8c5a30', roughness: 0.8 });
  const tiers = [
    { y: 0.55, z: -D / 2 + 1.55, d: 0.7 },
    { y: 1.1, z: -D / 2 + 0.75, d: 0.75 },
  ];
  for (const t of tiers) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const s = box(W - 0.6, 0.05, t.d / n - 0.03, slat, 0, t.y, t.z - t.d / 2 + (i + 0.5) * (t.d / n));
      g.add(s);
    }
    // ступень-подступенок
    g.add(box(W - 0.6, t.y - 0.05, 0.05, slat, 0, (t.y - 0.05) / 2, t.z + t.d / 2 - 0.02));
    for (const x of [-W / 2 + 0.6, 0, W / 2 - 0.6]) g.add(box(0.08, t.y, 0.08, leg, x, t.y / 2, t.z));
  }
  // спинка верхнего полка
  for (let i = 0; i < 3; i++) g.add(box(W - 0.6, 0.06, 0.04, slat, 0, 1.5 + i * 0.18, -D / 2 + 0.12));
  return g;
}

function buildStove(variant) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.45, metalness: 0.8 });
  const glows = [];
  if (variant === 'hammam') return { group: g, glows };

  const body = box(0.9, 0.9, 0.7, metal, 0, 0.45, 0);
  g.add(body);
  if (variant === 'wood') {
    // дверца топки с огнём
    const fireMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a' });
    const fire = box(0.42, 0.28, 0.02, fireMat, 0, 0.32, 0.36);
    glows.push(fireMat);
    g.add(fire, box(0.5, 0.36, 0.02, metal, 0, 0.32, 0.355));
    fire.position.z = 0.37;
  }
  // сетка-каменка
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.44, 0.55, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#3a3a3d', metalness: 0.9, roughness: 0.4, wireframe: true }));
  cage.position.y = 1.18;
  g.add(cage);
  // камни: нижние раскалены
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.4;
    const y = 0.95 + rnd() * 0.55;
    const hot = y < 1.2 && rnd() < 0.6;
    const mat = new THREE.MeshStandardMaterial({
      color: hot ? '#5a3020' : new THREE.Color().setHSL(0.07, 0.08, 0.25 + rnd() * 0.15),
      roughness: 0.9,
      flatShading: true,
      emissive: hot ? new THREE.Color('#ff4d0a') : new THREE.Color(0),
      emissiveIntensity: hot ? 0.6 + rnd() * 0.8 : 0,
    });
    if (hot) glows.push(mat);
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + rnd() * 0.05, 0), mat);
    s.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    s.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(s);
  }
  return { group: g, glows };
}

function buildBucket() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTex('#b77b45', { planks: 12 }), roughness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.9, roughness: 0.3 });
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.32, 20, 1, true), wood);
  bucket.material.side = THREE.DoubleSide;
  bucket.position.y = 0.16;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), wood);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.01;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshStandardMaterial({ color: '#7fb6c9', roughness: 0.1, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.26;
  g.add(bucket, bottom, water);
  for (const y of [0.06, 0.26]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(y < 0.1 ? 0.185 : 0.215, 0.012, 6, 28), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  // ковш
  const ladle = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), wood);
  cup.rotation.x = Math.PI;
  const handle = box(0.03, 0.03, 0.5, wood, 0, 0, 0.27);
  ladle.add(cup, handle);
  ladle.position.set(0, 0.36, 0.05);
  ladle.rotation.x = -0.6;
  g.add(ladle);
  return g;
}

function buildLamp(variant) {
  const g = new THREE.Group();
  const glowMat = new THREE.MeshBasicMaterial({ color: variant === 'hammam' ? '#fff3d6' : '#ffc77a' });
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#7a4a24', roughness: 0.7 });
  g.add(box(0.5, 0.3, 0.08, glowMat, 0, 0, 0));
  for (let i = -2; i <= 2; i++) g.add(box(0.04, 0.34, 0.12, shadeMat, i * 0.11, 0, 0.02));
  return { group: g, glowMat };
}

function buildPool() {
  const g = new THREE.Group();
  const tiles = new THREE.MeshStandardMaterial({ map: tileTex('#2b8fb8', '#d9eef5', 10, [3, 1]), roughness: 0.3 });
  const pw = 3.6, pd = 1.8, depth = 0.9, z = 0.75;
  // бортики
  const rim = new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.4 });
  g.add(box(pw + 0.3, 0.08, 0.15, rim, 0, 0.04, z - pd / 2), box(0.15, 0.08, pd, rim, -pw / 2, 0.04, z), box(0.15, 0.08, pd, rim, pw / 2, 0.04, z));
  // чаша
  const inner = new THREE.Mesh(new THREE.BoxGeometry(pw, depth, pd), tiles);
  inner.material.side = THREE.BackSide;
  inner.position.set(0, -depth / 2 + 0.001, z);
  g.add(inner);
  // вода с переливами
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 p = vUv * vec2(9.0, 5.0);
        float w = sin(p.x * 1.7 + uTime * 1.3) * sin(p.y * 2.3 - uTime * 1.1) + sin((p.x + p.y) * 1.3 + uTime * 0.7);
        float c = smoothstep(0.9, 1.6, w);
        vec3 col = mix(vec3(0.05, 0.42, 0.58), vec3(0.55, 0.9, 1.0), c * 0.8);
        gl_FragColor = vec4(col, 0.78);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.08, z);
  g.add(water);
  // лестница
  const steel = new THREE.MeshStandardMaterial({ color: '#cfd6dc', metalness: 1, roughness: 0.2 });
  for (const x of [1.35, 1.75]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 8, 20, Math.PI), steel);
    rail.position.set(x, 0.0, z - pd / 2 + 0.12);
    rail.rotation.y = Math.PI / 2;
    g.add(rail);
  }
  return { group: g, waterMat };
}

function buildSteam(count, area) {
  const tex = softSprite();
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = area.x + (rnd() - 0.5) * area.w;
    pos[i * 3 + 1] = area.y + rnd() * area.h;
    pos[i * 3 + 2] = area.z + (rnd() - 0.5) * area.d;
    seed[i] = rnd();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: tex, size: 1.1, transparent: true, opacity: 0.16, depthWrite: false, color: '#fff4e6', sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.userData = { seed, area };
  return pts;
}

function updateSteam(pts, dt, t) {
  const p = pts.geometry.attributes.position;
  const { seed, area } = pts.userData;
  for (let i = 0; i < seed.length; i++) {
    let y = p.getY(i) + dt * (0.18 + seed[i] * 0.25);
    let x = p.getX(i) + Math.sin(t * 0.6 + seed[i] * 10) * dt * 0.08;
    if (y > area.y + area.h) {
      y = area.y;
      x = area.x + (seed[i] - 0.5) * area.w;
    }
    p.setXY(i, x, y);
  }
  p.needsUpdate = true;
}

// ---------- публичный API ----------
export function mountScene(canvas, { variant = 'classic', accent = '#c9935a' } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 50);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let world = null;
  let parts = {};

  function build(v) {
    if (world) {
      scene.remove(world);
      world.traverse((o) => {
        o.geometry?.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
    }
    world = new THREE.Group();
    parts = { variant: v };
    const hammam = v === 'hammam';
    scene.background = new THREE.Color(hammam ? '#2a2622' : '#1a0f08');
    scene.fog = new THREE.Fog(scene.background, 7, 16);

    world.add(buildRoom(v), buildBenches(v));

    const stove = buildStove(v);
    stove.group.position.set(W / 2 - 1.1, 0, -D / 2 + 2.1);
    world.add(stove.group);
    parts.glows = stove.glows;

    if (!hammam) {
      const bucket = buildBucket();
      bucket.position.set(W / 2 - 2.0, 0, -D / 2 + 2.3);
      world.add(bucket);
    }

    const lamp = buildLamp(v);
    lamp.group.position.set(-W / 2 + 0.05, 2.2, -0.6);
    lamp.group.rotation.y = Math.PI / 2;
    world.add(lamp.group);
    parts.lampMat = lamp.glowMat;

    if (v === 'pool') {
      const pool = buildPool();
      world.add(pool.group);
      parts.waterMat = pool.waterMat;
    }

    // свет
    const amb = new THREE.HemisphereLight(hammam ? '#fff2df' : '#ffd9a8', '#3a2010', hammam ? 0.9 : 0.55);
    const lampLight = new THREE.PointLight(hammam ? '#ffe9c4' : '#ffb766', hammam ? 10 : 9, 9, 1.6);
    lampLight.position.set(-W / 2 + 0.6, 2.2, -0.6);
    const stoveLight = new THREE.PointLight('#ff6a1f', hammam ? 0 : 7, 5, 1.8);
    stoveLight.position.set(W / 2 - 1.1, 1.3, -D / 2 + 2.5);
    const under = new THREE.PointLight(new THREE.Color(accent), 3.5, 7, 2);
    under.position.set(-1.5, 0.3, -D / 2 + 1.8);
    world.add(amb, lampLight, stoveLight, under);
    parts.stoveLight = stoveLight;
    parts.lampLight = lampLight;
    if (v === 'pool') {
      const poolLight = new THREE.PointLight('#6fd3ff', 4, 4, 2);
      poolLight.position.set(0, -0.4, 0.75);
      world.add(poolLight);
    }

    // пар
    const steam = buildSteam(hammam ? 140 : 70, hammam
      ? { x: 0, y: 0.2, z: 0, w: W - 1, h: 3, d: D - 1 }
      : { x: W / 2 - 1.1, y: 1.3, z: -D / 2 + 2.1, w: 1.2, h: 2.2, d: 1.0 });
    world.add(steam);
    parts.steam = steam;

    scene.add(world);
  }

  build(variant);

  // камера: плавный облёт и реакция на движение пальца/мыши
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const py = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    pointer.tx = (px / r.width - 0.5) * 2;
    pointer.ty = (py / r.height - 0.5) * 2;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // на узком экране отодвигаемся, чтобы помещение влезало
    camera.fov = w / h < 0.9 ? 62 : 48;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;
  function frame() {
    running = true;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    const orbit = reduce ? 0 : Math.sin(t * 0.12) * 0.35;
    const camX = Math.sin(orbit) * 5.2 + pointer.x * 0.5;
    const camZ = 3.0 + Math.cos(orbit) * 2.2;
    camera.position.set(camX, 2.05 - pointer.y * 0.2, camZ + 1.4);
    camera.lookAt(0.4, 0.75, -D / 2 + 1.6);

    if (!reduce) {
      const flick = 0.85 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 13.1) * 0.05 + (Math.random() - 0.5) * 0.06;
      if (parts.stoveLight) parts.stoveLight.intensity = (parts.variant === 'hammam' ? 0 : 7) * flick;
      for (const m of parts.glows || []) {
        if (m.emissiveIntensity !== undefined && m.emissive) m.emissiveIntensity = 0.5 + flick * 0.7;
        else if (m.color) m.color.setHSL(0.07, 1, 0.45 + flick * 0.12);
      }
      if (parts.steam) updateSteam(parts.steam, dt, t);
    }
    if (parts.waterMat) parts.waterMat.uniforms.uTime.value = t;
    renderer.render(scene, camera);
    if (visible && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
    else running = false;
  }
  function loop() {
    if (!running) {
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
  }
  loop();

  return {
    setVariant(v) {
      if (v === parts.variant) return;
      build(v);
      if (reduce) requestAnimationFrame(frame);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      renderer.dispose();
    },
  };
}
