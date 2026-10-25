// Real-time 3D PC assembly. Units are centimetres, modelled to real part sizes.
// Each .rig3d canvas reads its scroll progress from window.PC_PROGRESS[n] (set by main.js).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// Ambient occlusion that ignores glass and other see-through surfaces, so it shades the parts inside
class GlassAwareGTAOPass extends GTAOPass {
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse((o) => {
      if (o.isMesh && (o.material.transparent || o.userData.noAO)) o.visible = false;
    });
  }
}

const C = window.CONTENT;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Scroll timeline (fractions of the pinned scroll). main.js uses the same step ends.
const T = {
  panelOff: [0.02, 0.09],
  cpu: [0.1, 0.17],
  lever: [0.17, 0.185],
  paste: [0.185, 0.195],
  pump: [0.19, 0.24],
  ram: [0.28, 0.38],
  ssd: [0.45, 0.53],
  screw: [0.53, 0.56],
  gpu: [0.62, 0.72],
  gpuCable: [0.72, 0.76],
  panelOn: [0.78, 0.85],
  power: [0.86, 0.93],
};

// ---------- helpers ----------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (p, [a, b]) => clamp01((p - a) / (b - a));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function std(color, metalness = 0, roughness = 0.5, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function mesh(geo, mat, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Identical boxes (fins, chokes, slots, screws...) share one geometry
const boxCache = new Map();
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent, r = 0) {
  // Nothing real has perfectly sharp edges: give every chunky box a small bevel to catch highlights
  const thin = Math.min(w, h, d);
  if (r === 0 && thin >= 0.25) r = Math.min(0.06, thin * 0.15);
  const key = `${w}|${h}|${d}|${r}`;
  let geo = boxCache.get(key);
  if (!geo) {
    geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    boxCache.set(key, geo);
  }
  const m = mesh(geo, mat, parent);
  m.position.set(x, y, z);
  return m;
}

// Cylinder lying along z (most board parts face the viewer)
function cylZ(r, h, mat, x, y, z, parent, segs = 24) {
  const m = mesh(new THREE.CylinderGeometry(r, r, h, segs), mat, parent);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

function plane(w, h, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Mark a texture to also be used as a bump map (applied to every material using it as `map`)
const bumpy = (t, scale) => ((t.userData.bump = scale), t);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

// Deterministic random so generated details look the same on every load
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// ---------- textures ----------
const PX = 25; // pixels per cm on the motherboard texture
const HOLES = [[0.6, 1.0], [23.0, 1.0], [0.6, 15], [23.0, 15], [0.6, 29.5], [23.0, 29.5], [11.5, 1.0], [11.5, 29.5], [16.5, 15]];

function boardTexture(label) {
  return bumpy(canvasTex(24.4 * PX, 30.5 * PX, (g, w, h) => {
    g.fillStyle = "#141519";
    g.fillRect(0, 0, w, h);
    const r = rng(7);
    g.lineWidth = 1.2;
    for (let i = 0; i < 520; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.018 + r() * 0.035})`;
      let x = r() * w, y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      const horiz = r() < 0.5, len = 15 + r() * 160;
      horiz ? (x += len) : (y += len);
      g.lineTo(x, y);
      const k = 6 + r() * 26;
      g.lineTo(x + k, y + k);
      g.stroke();
    }
    for (let i = 0; i < 900; i++) {
      // tiny SMD components
      g.fillStyle = r() < 0.5 ? "rgba(190,170,120,.35)" : "rgba(30,30,34,.9)";
      g.fillRect(r() * w, r() * h, 3 + r() * 4, 2 + r() * 2);
    }
    g.fillStyle = "rgba(255,255,255,0.03)";
    g.beginPath();
    g.moveTo(w * 0.55, h * 0.55);
    g.lineTo(w, h * 0.35);
    g.lineTo(w, h * 0.72);
    g.lineTo(w * 0.62, h * 0.86);
    g.fill();
    HOLES.forEach(([cx, cy]) => {
      g.fillStyle = "#b9bcc4";
      g.beginPath();
      g.arc(cx * PX, cy * PX, 0.5 * PX, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = "rgba(230,230,236,0.6)";
    g.font = `700 ${0.9 * PX}px "Space Grotesk", sans-serif`;
    g.fillText(label, 14.2 * PX, 24.4 * PX);
    g.font = `500 ${0.32 * PX}px Inter, sans-serif`;
    [["M.2_1", 4.3, 15.7], ["PCIEX16_1", 2.2, 18.6], ["DDR5_A1  A2  B1  B2", 15.0, 1.3], ["CPU_FAN", 12.0, 0.7], ["SATA6G_1-4", 21.0, 20.4], ["ATX_24P", 21.5, 8.2], ["M.2_2", 4.3, 21.8], ["F_PANEL", 17.5, 29.9], ["USB3_E", 9.5, 29.9]].forEach(([t, x, y]) => g.fillText(t, x * PX, y * PX));
    g.strokeStyle = "rgba(230,230,236,0.22)";
    g.lineWidth = 1.5;
    g.strokeRect(4.0 * PX, 15.9 * PX, 8.6 * PX, 2.6 * PX);
    g.strokeRect(6.8 * PX, 3.5 * PX, 6.0 * PX, 6.6 * PX);
  }), 0.25);
}

function textTex(lines, { w = 512, h = 128, bg = null, fg = "#fff", size = 54, weight = 700, font = '"Space Grotesk", sans-serif' } = {}) {
  return canvasTex(w, h, (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    lines.forEach((l, i) => {
      const s = i === 0 ? size : size * 0.6;
      g.font = `${i === 0 ? weight : 500} ${s}px ${font}`;
      g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 0.95);
    });
  });
}

const finTex = (rep = [1, 1]) =>
  bumpy(canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = "#202228";
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = x % 8 ? "#646873" : "#3a3d45";
      g.fillRect(x, 0, 2, h);
    }
  }, rep), 1.2);

// Brushed-aluminium streaks, used as a roughness map on metal
const brushedTex = () =>
  canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#c8c8c8";
    g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 900; i++) {
      const v = 170 + Math.floor(r() * 85);
      g.fillStyle = `rgba(${v},${v},${v},0.16)`;
      g.fillRect(0, r() * h, w, 1);
    }
  }, [6, 6]);

// Two-digit debug code display ("A0" = booted OK on Intel boards)
const qcodeTex = () =>
  canvasTex(128, 80, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ff3b1f";
    g.font = '700 62px "JetBrains Mono", monospace';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("A0", w / 2, h / 2 + 4);
  });

const meshTex = (light) =>
  bumpy(canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = light ? "#dcdce2" : "#18181d";
    g.fillRect(0, 0, w, h);
    g.fillStyle = light ? "#8d8d96" : "#030304";
    for (let y = 0; y < h; y += 8)
      for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) {
        g.beginPath();
        g.arc(x + 2, y + 4, 2.6, 0, Math.PI * 2);
        g.fill();
      }
  }, [14, 7]), 1.5);

const weaveTex = (base, hi, rep) =>
  bumpy(canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = hi;
    g.lineWidth = 3;
    for (let i = -w; i < w * 2; i += 8) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + h, h);
      g.stroke();
      g.globalAlpha = 0.5;
      g.beginPath();
      g.moveTo(i + h, 0);
      g.lineTo(i, h);
      g.stroke();
      g.globalAlpha = 1;
    }
  }, rep), 1.6);

function ihsTex(cpuName) {
  const ultra = /ultra/i.test(cpuName);
  const model = (cpuName.match(/(\d{3,5}K[\w ]*)$/i) || [""])[0].trim();
  return canvasTex(512, 420, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "#e6e8ec");
    grd.addColorStop(0.5, "#bfc2c8");
    grd.addColorStop(1, "#dcdfe4");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a3c42";
    g.font = "600 64px Inter, sans-serif";
    g.fillText("intel", 48, 120);
    g.font = "700 44px Inter, sans-serif";
    g.fillText(ultra ? "CORE ULTRA 7" : "CORE i7", 48, 196);
    g.font = "500 38px Inter, sans-serif";
    g.fillText(model, 48, 254);
    g.font = "400 22px Inter, sans-serif";
    g.fillText("SRN3X  3.40GHZ", 48, 326);
    g.fillText("X411G371   ◆", 48, 360);
  });
}

function pumpScreenTex(on, accent) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#040406";
    g.fillRect(0, 0, w, h);
    if (!on) return;
    const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 128);
    grd.addColorStop(0, "rgba(255,255,255,.08)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.lineCap = "round";
    g.lineWidth = 12;
    g.strokeStyle = "rgba(255,255,255,.12)";
    g.beginPath();
    g.arc(w / 2, h / 2, 100, Math.PI * 0.75, Math.PI * 2.25);
    g.stroke();
    g.strokeStyle = accent;
    g.beginPath();
    g.arc(w / 2, h / 2, 100, Math.PI * 0.75, Math.PI * 1.55);
    g.stroke();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '700 76px "Space Grotesk", sans-serif';
    g.fillText("32°", w / 2, h / 2 - 8);
    g.font = "500 20px Inter, sans-serif";
    g.fillStyle = "rgba(255,255,255,.7)";
    g.fillText("CPU TEMP", w / 2, h / 2 + 46);
    g.fillText("1840 RPM", w / 2, h / 2 + 72);
  });
}

function ramTex(light) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = light ? "#e4e4ea" : "#202227";
    g.fillRect(0, 0, w, h);
    g.fillStyle = light ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.05)";
    g.beginPath();
    g.moveTo(w * 0.35, 0);
    g.lineTo(w * 0.62, 0);
    g.lineTo(w * 0.48, h);
    g.lineTo(w * 0.21, h);
    g.fill();
    g.fillStyle = light ? "#2b2b31" : "#e8e8ee";
    g.font = '700 64px "Space Grotesk", sans-serif';
    g.fillText("DDR5", 70, 120);
    g.font = "500 30px Inter, sans-serif";
    g.fillStyle = light ? "#6a6a74" : "#9a9aa4";
    g.fillText("16GB  ·  2 × 16GB KIT", 70, 180);
  });
}

function backplateTex(brand) {
  return canvasTex(1024, 410, (g, w, h) => {
    g.fillStyle = "#16171b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#050506";
    for (let i = 0; i < 26; i++) g.fillRect(w * 0.62 + i * 13, h * 0.2, 6, h * 0.6);
    g.fillStyle = "#c9cbd2";
    g.font = '700 54px "Space Grotesk", sans-serif';
    g.fillText(brand, 70, h / 2 + 18);
  });
}

function rainbowTex(accent) {
  const hsl = new THREE.Color(accent).getHSL({});
  return canvasTex(8, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const c = new THREE.Color().setHSL((hsl.h + 0.12 * Math.sin((y / h) * Math.PI * 2) + 1) % 1, 0.85, 0.6);
      g.fillStyle = `#${c.getHexString()}`;
      g.fillRect(0, y, w, 1);
    }
  }, [1, 1]);
}

function bgTex(accent) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.42, h * 0.38, 20, w * 0.45, h * 0.45, w * 0.75);
    const a = new THREE.Color(accent).lerp(new THREE.Color(0x2a2733), 0.82);
    grd.addColorStop(0, `#${a.getHexString()}`);
    grd.addColorStop(0.55, "#131218");
    grd.addColorStop(1, "#060508");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

const fadeTex = () =>
  canvasTex(256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, "#fff");
    grd.addColorStop(0.45, "#888");
    grd.addColorStop(1, "#000");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });

// ---------- studio environment ----------
// A dark room with glowing softboxes, captured as the reflection map: gives metal and glass
// the long clean highlights you see in product photography
function studioEnv(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({ color: 0x0a0a0d, side: THREE.BackSide })));
  const softbox = (w, h, color, power, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  softbox(42, 42, 0xffffff, 6, V(0, 46, 4));
  softbox(12, 54, 0xfff1e4, 5, V(40, 6, 30));
  softbox(12, 54, 0xdde5ff, 3.5, V(-44, 6, 14));
  softbox(64, 5, 0xffffff, 2.5, V(0, 8, -46));
  softbox(30, 4, 0xffffff, 2, V(0, -20, 40));
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}

// Subtle vignette + film grain, applied last
const FilmShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.03 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= 1.0 - uVig * smoothstep(0.35, 0.9, distance(vUv, vec2(0.5)));
      c.rgb += (hash(vUv * 1024.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

// ---------- shared geometry ----------
const bladeCache = new Map();
function bladeGeo(rIn, rOut, thick) {
  const key = `${rIn}|${rOut}|${thick}`;
  if (bladeCache.has(key)) return bladeCache.get(key);
  const p = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const s = new THREE.Shape();
  const rMid = (rIn + rOut) / 2;
  s.moveTo(...p(rIn, -0.32));
  s.quadraticCurveTo(...p(rMid, -0.22), ...p(rOut, -0.05));
  s.quadraticCurveTo(...p(rOut * 1.03, 0.32), ...p(rOut * 0.97, 0.62));
  s.quadraticCurveTo(...p(rMid, 0.42), ...p(rIn, 0.3));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.3, bevelSize: thick * 0.3, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -thick / 2);
  bladeCache.set(key, g);
  return g;
}

// ---------- components ----------
function makeFan(size, M, { frame = true, ring = true, blades = M.fanBlade, count = 7, hub = M.fanHub, rim = false } = {}) {
  const g = new THREE.Group();
  const depth = size * 0.21, r = size * 0.45;
  if (frame) {
    const sh = rrShape(size, size, size * 0.1);
    const hole = new THREE.Path();
    hole.absarc(0, 0, r, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, curveSegments: 40 });
    geo.translate(0, 0, -depth / 2);
    mesh(geo, M.fanFrame, g);
    // Rubber corner pads + motor struts on the back
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sy]) => box(size * 0.16, size * 0.16, depth + 0.1, M.fanPad, sx * size * 0.42, sy * size * 0.42, 0, g, 0.15));
    for (let i = 0; i < 3; i++) {
      const strut = box(r, size * 0.025, size * 0.03, M.fanFrame, 0, 0, -depth / 2 + 0.1, g);
      strut.geometry = strut.geometry.clone().translate(r * 0.5, 0, 0); // own copy: box geometries are shared
      strut.rotation.z = (i / 3) * Math.PI * 2 + 0.5;
    }
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sy]) => cylZ(size * 0.018, 0.12, M.silver, sx * size * 0.42, sy * size * 0.42, depth / 2 + 0.11, g, 10));
  }
  const rotor = new THREE.Group();
  g.add(rotor);
  cylZ(r * 0.34, depth * 0.72, hub, 0, 0, 0, rotor, 32);
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(r * 0.24, 32), M.fanSticker);
  sticker.position.z = depth * 0.37;
  rotor.add(sticker);
  const bg = bladeGeo(+(r * 0.3).toFixed(2), +(r * 0.97).toFixed(2), +(size * 0.012).toFixed(3));
  for (let i = 0; i < count; i++) {
    const pv = new THREE.Group();
    pv.rotation.z = (i / count) * Math.PI * 2;
    const b = mesh(bg, blades, pv);
    b.rotation.x = 0.42;
    rotor.add(pv);
  }
  if (rim) {
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, size * 0.018, 8, 64), blades);
    ring2.castShadow = true;
    rotor.add(ring2);
  }
  if (ring) {
    [-1, 1].forEach((s) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.995, size * 0.014, 8, 72), M.glow);
      t.position.z = s * depth * 0.42;
      g.add(t);
    });
  }
  g.userData.rotor = rotor;
  return g;
}

// Bundle of individually sleeved wires following `pts`; `up` sets which way the rows stack
function sleeved(pts, M, { cols = 8, rows = 1, gap = 0.42, r = 0.17, up = V(0, 0, 1), combs = [0.5], connector = true, mat = M.sleeve }) {
  const g = new THREE.Group();
  const base = new THREE.CatmullRomCurve3(pts);
  const N = 28;
  const frames = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = base.getPointAt(t), tan = base.getTangentAt(t);
    let side = V().crossVectors(tan, up);
    if (side.lengthSq() < 1e-4) side = V().crossVectors(tan, V(1, 0, 0));
    side.normalize();
    const u = V().crossVectors(side, tan).normalize();
    frames.push({ p, tan, side, u });
  }
  for (let c = 0; c < cols; c++)
    for (let rr = 0; rr < rows; rr++) {
      const oc = (c - (cols - 1) / 2) * gap, or = (rr - (rows - 1) / 2) * gap;
      const strand = frames.map((f) => f.p.clone().addScaledVector(f.side, oc).addScaledVector(f.u, or));
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strand), 48, r, 6), mat, g);
    }
  const housing = (t, len, m) => {
    const f = frames[Math.round(t * N)];
    const b = box(cols * gap + 0.25, rows * gap + 0.25, len, m, 0, 0, 0, g, 0.08);
    b.position.copy(f.p);
    b.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side, f.u, f.tan));
    return b;
  };
  combs.forEach((t) => housing(t, 0.35, M.comb));
  if (connector) housing(0, 1.0, M.plastic);
  return g;
}

function makeMotherboard(M, label) {
  const g = new THREE.Group();
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTexture(label), roughness: 0.6, metalness: 0.25 });
  box(24.4, 30.5, 0.18, boardMat, 0, 0, 0.09, g);
  const Z = 0.18;
  // Screws in the mounting holes
  HOLES.forEach(([cx, cy]) => {
    const x = cx - 12.2, y = 15.25 - cy;
    cylZ(0.38, 0.22, M.silver, x, y, Z + 0.11, g, 20);
    box(0.5, 0.07, 0.05, M.plastic, x, y, Z + 0.23, g);
    box(0.07, 0.5, 0.05, M.plastic, x, y, Z + 0.23, g);
  });
  // Rear I/O shroud with RGB edge
  box(3.6, 14, 3.4, M.gunmetal, -10.3, 8, Z + 1.7, g, 0.35);
  const io = plane(9, 2.6, new THREE.MeshStandardMaterial({ map: textTex([label.split(" ")[0]], { w: 440, h: 128, size: 40 }), transparent: true, roughness: 0.4 }), -10.3, 8.5, Z + 3.42, g);
  io.rotation.z = Math.PI / 2;
  box(0.14, 12.6, 0.14, M.glow, -8.45, 8, Z + 3.3, g);
  // VRM: chokes and caps under finned heatsinks
  for (let i = 0; i < 9; i++) box(0.72, 0.72, 0.6, M.choke, -7.6 + i * 0.95, 11.2, Z + 0.3, g, 0.06);
  for (let i = 0; i < 6; i++) box(0.72, 0.72, 0.6, M.choke, -8.15, 3.2 + i * 0.95, Z + 0.3, g, 0.06);
  for (let i = 0; i < 6; i++) cylZ(0.26, 0.8, M.cap, -6.9 + i * 0.75, 10.1, Z + 0.4, g, 14);
  box(9.5, 2.6, 2.4, M.gunmetal, -3.5, 13.4, Z + 1.2, g, 0.25);
  for (let i = 0; i < 12; i++) box(0.3, 2.6, 0.9, M.gunmetal, -8.0 + i * 0.82, 13.4, Z + 2.85, g);
  box(2.4, 9, 2.4, M.gunmetal, -7.3, 6.0, Z + 1.2, g, 0.25);
  for (let i = 0; i < 10; i++) box(2.4, 0.3, 0.9, M.gunmetal, -7.3, 2.0 + i * 0.9, Z + 2.85, g);
  // CPU socket (LGA1700 ILM) with lever
  const socket = new THREE.Group();
  socket.position.set(-3, 6.5, Z);
  g.add(socket);
  const ilm = rrShape(5.6, 6.6, 0.3);
  const win = new THREE.Path();
  win.moveTo(-2.15, -2.5);
  win.lineTo(2.15, -2.5);
  win.lineTo(2.15, 2.5);
  win.lineTo(-2.15, 2.5);
  win.closePath();
  ilm.holes.push(win);
  mesh(new THREE.ExtrudeGeometry(ilm, { depth: 0.25, bevelEnabled: false }), M.silver, socket);
  box(4.3, 5.0, 0.08, M.gold, 0, 0, 0.05, socket);
  [[-2.4, 3.0], [2.4, 3.0], [-2.4, -3.0], [2.4, -3.0]].forEach(([x, y]) => cylZ(0.25, 0.35, M.silver, x, y, 0.3, socket, 12));
  const lever = new THREE.Group();
  lever.position.set(3.05, -3.2, 0.35);
  const arm = mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.6, 8), M.silver, lever);
  arm.position.y = 3.3;
  box(0.5, 0.25, 0.25, M.silver, 0.2, 0, 0, lever);
  socket.add(lever);
  // DIMM slots with latches (animated as the RAM clicks in)
  const dimmX = [3.4, 4.3, 5.2, 6.1];
  const latches = dimmX.map((x) => {
    box(0.6, 13.8, 0.75, M.slot, x, 6.5, Z + 0.37, g);
    box(0.6, 0.6, 1.0, M.slot, x, -0.6, Z + 0.5, g);
    const pivot = new THREE.Group();
    pivot.position.set(x, 13.4, Z + 0.2);
    box(0.62, 0.7, 1.25, M.latch, 0, 0.35, 0.62, pivot, 0.08);
    g.add(pivot);
    return pivot;
  });
  // ATX 24-pin, fan headers, SATA, front-panel + USB headers, debug LEDs
  box(1.1, 5.4, 1.3, M.plastic, 11.4, 4.5, Z + 0.65, g);
  [[-0.2, 14.6], [8.6, 14.6], [11.6, -3]].forEach(([x, y]) => box(1.1, 0.55, 0.7, M.header, x, y, Z + 0.35, g));
  for (let i = 0; i < 4; i++) box(1.0, 0.9, 1.5, M.plastic, 11.5, -6.2 - i * 1.15, Z + 0.75, g, 0.05);
  box(2.6, 0.55, 0.6, M.plastic, 5.6, -14.6, Z + 0.3, g);
  box(2.4, 0.4, 0.06, M.gold, 5.6, -14.6, Z + 0.62, g);
  box(2.0, 0.9, 0.9, M.usbBlue, -2.3, -14.4, Z + 0.45, g);
  [0, 1, 2, 3].forEach((i) => box(0.25, 0.4, 0.12, M.led, 10.8, 9.2 + i * 0.6, Z + 0.06, g));
  [[11.6, -1.2], [-11.2, -14.6], [2.2, 14.6]].forEach(([x, y]) => box(1.0, 0.45, 0.6, M.header, x, y, Z + 0.3, g));
  box(1.6, 1.1, 0.25, M.plastic, 9.6, 12.4, Z + 0.13, g);
  const qcode = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xffffff, emissiveMap: qcodeTex(), emissiveIntensity: 0, roughness: 0.3 });
  plane(1.36, 0.85, qcode, 9.6, 12.4, Z + 0.26, g);
  // M.2 slot + standoff
  box(0.6, 2.2, 0.55, M.plastic, -8.2, -1.5, Z + 0.27, g);
  cylZ(0.25, 0.4, M.gold, 0, -1.5, Z + 0.2, g, 12);
  // PCIe x16 (reinforced, with latch) + other slots, M.2_2 heatsink, chipset
  box(8.9, 0.75, 1.1, M.silver, -6.2, -4.3, Z + 0.55, g, 0.06);
  box(0.6, 1.1, 1.2, M.latch, -1.45, -4.3, Z + 0.6, g, 0.08);
  box(8.9, 0.75, 1.1, M.slot, -6.2, -10.3, Z + 0.55, g);
  box(3.0, 0.75, 1.1, M.slot, -9.2, -13.0, Z + 0.55, g);
  box(8.4, 2.5, 0.65, M.gunmetal, -4.0, -7.3, Z + 0.33, g, 0.15);
  plane(5, 1.1, new THREE.MeshStandardMaterial({ map: textTex(["M.2 SHIELD"], { w: 512, h: 112, size: 52, fg: "#9a9ca6" }), transparent: true }), -4.5, -7.3, Z + 0.66, g);
  box(7, 7, 0.9, M.gunmetal, 6.5, -9.5, Z + 0.45, g, 0.25);
  plane(6, 2, new THREE.MeshStandardMaterial({ map: textTex([label], { w: 512, h: 170, size: 54 }), transparent: true }), 6.5, -9.5, Z + 0.91, g);
  // Audio: shielded codec + gold caps
  box(3.0, 2.2, 0.3, M.gunmetal, -9.6, -10.5, Z + 0.15, g, 0.1);
  for (let i = 0; i < 4; i++) cylZ(0.32, 0.9, M.audioCap, -10.6 + i * 0.75, -12.7, Z + 0.45, g, 16);
  // CMOS battery
  cylZ(1.0, 0.3, M.silver, 1.5, -12.2, Z + 0.15, g, 32);

  g.userData = { lever, dimmX, latches, qcode, Z };
  return g;
}

function makeCPU(M, name) {
  const g = new THREE.Group();
  box(4.5, 3.75, 0.12, M.substrate, 0, 0, 0.06, g);
  for (let i = 0; i < 10; i++) box(0.12, 0.2, 0.06, M.gold, -2.05 + (i % 2) * 4.1, -1.5 + Math.floor(i / 2) * 0.75, 0.15, g);
  box(3.4, 3.0, 0.32, new THREE.MeshStandardMaterial({ map: ihsTex(name), metalness: 0.9, roughness: 0.22 }), 0, 0, 0.28, g, 0.06);
  g.rotation.z = Math.PI / 2; // LGA1700 sits portrait on the board
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

function makeRAM(M, light) {
  const g = new THREE.Group(); // length along y, height along z, thickness along x
  box(0.12, 13.3, 3.1, M.pcb, 0, 0, 1.55, g);
  const face = new THREE.MeshStandardMaterial({ map: ramTex(light), metalness: 0.75, roughness: 0.32 });
  face.map.center.set(0.5, 0.5);
  face.map.rotation = Math.PI / 2;
  const spreader = mesh(new THREE.BoxGeometry(0.78, 13.3, 3.2), [face, face, M.ramSpreader, M.ramSpreader, M.ramSpreader, M.ramSpreader], g);
  spreader.position.z = 1.75;
  box(0.8, 13.0, 0.55, M.diffuser, 0, 0, 3.6, g, 0.12).castShadow = false;
  box(0.1, 12.8, 0.4, M.gold, 0, 0, -0.1, g);
  return g;
}

function makeSSD(M, label) {
  const g = new THREE.Group(); // length along x starting at 0 (connector end)
  box(8.0, 2.2, 0.08, M.pcbGreen, 4, 0, 0.04, g);
  box(1.1, 1.4, 0.13, M.plastic, 1.3, 0, 0.14, g);
  box(1.6, 1.6, 0.13, M.plastic, 3.3, 0, 0.14, g);
  box(1.6, 1.6, 0.13, M.plastic, 5.3, 0, 0.14, g);
  plane(5.6, 1.9, new THREE.MeshStandardMaterial({ map: textTex(["NVMe " + label, "PCIe 4.0 · M.2 2280"], { w: 512, h: 170, bg: "#18191e", size: 50 }), roughness: 0.5 }), 4.3, 0, 0.215, g);
  box(0.5, 2.0, 0.06, M.gold, 0.25, 0, 0.04, g);
  return g;
}

function makeScrew(M) {
  const g = new THREE.Group();
  cylZ(0.32, 0.14, M.silver, 0, 0, 0.07, g, 20);
  cylZ(0.12, 0.5, M.silver, 0, 0, -0.25, g, 10);
  box(0.4, 0.06, 0.04, M.plastic, 0, 0, 0.15, g);
  box(0.06, 0.4, 0.04, M.plastic, 0, 0, 0.15, g);
  return g;
}

function makeGPU(M, name) {
  const g = new THREE.Group(); // length x (30), height y (12), thickness z (0..5), fans face +z
  const L = 30, H = 12;
  const brand = name.replace(/^(NVIDIA|AMD)\s*/i, "").toUpperCase();
  const bp = new THREE.MeshStandardMaterial({ map: backplateTex(brand), metalness: 0.75, roughness: 0.35 });
  box(L, H, 0.3, bp, 0, 0, 0.15, g, 0.1).rotation.y = Math.PI; // logo faces outward (-z)
  box(L - 1, H - 1, 2.3, M.finBlock, 0, 0, 1.5, g);
  [[-13, 4.6], [-13, -4.6], [-3, 4.6], [-3, -4.6], [6, 3.2], [6, -3.2], [13, 4.6], [13, -4.6]].forEach(([x, y]) => cylZ(0.24, 0.12, M.silver, x, y, -0.04, g, 12));
  // Copper heatpipes running the length of the card, visible along the top edge
  for (let i = 0; i < 4; i++) {
    const hp = mesh(new THREE.CylinderGeometry(0.28, 0.28, L - 3, 12), M.copper, g);
    hp.rotation.z = Math.PI / 2;
    hp.position.set(0, H / 2 - 0.55, 0.9 + i * 0.75);
    const bend = mesh(new THREE.TorusGeometry(0.9, 0.28, 8, 16, Math.PI), M.copper, g);
    bend.position.set(L / 2 - 1.5, H / 2 - 1.45, 0.9 + i * 0.75);
    bend.rotation.z = -Math.PI / 2;
  }
  const sh = rrShape(L, H, 1);
  [-9.6, 0, 9.6].forEach((x) => {
    const hole = new THREE.Path();
    hole.absarc(x, 0, 4.5, 0, Math.PI * 2, true);
    sh.holes.push(hole);
  });
  const shroud = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, curveSegments: 48 }), M.shroud, g);
  shroud.position.z = 3.9;
  [-4.8, 4.8].forEach((x) => (box(0.45, H - 1.4, 0.3, M.trim, x, 0, 5.0, g, 0.1).rotation.z = 0.32));
  box(L - 0.6, H - 0.6, 1.4, M.shroudInner, 0, 0, 3.3, g);
  const fans = [-9.6, 0, 9.6].map((x) => {
    const f = makeFan(9.2, M, { frame: false, ring: false, blades: M.gpuBlade, count: 11, hub: M.gpuHub, rim: true });
    f.position.set(x, 0, 4.1);
    g.add(f);
    return f;
  });
  box(L - 6, 0.25, 0.6, M.glowBar, 1, H / 2 + 0.05, 4.4, g).castShadow = false;
  const logo = plane(14, 2.2, new THREE.MeshStandardMaterial({ map: textTex([brand], { w: 1024, h: 160, size: 92 }), transparent: true, emissive: 0xffffff, emissiveIntensity: 0 }), -4, H / 2 + 0.01, 2.2, g);
  logo.rotation.x = -Math.PI / 2;
  plane(9, 1.3, new THREE.MeshStandardMaterial({ map: textTex([brand], { w: 1024, h: 150, size: 92 }), transparent: true }), 9, -H / 2 + 0.9, 4.96, g);
  // I/O bracket, PCIe fingers, 16-pin power connector
  box(0.12, H + 0.6, 2.0, M.silver, -L / 2 - 0.1, 0.2, 1.0, g);
  box(8.5, 0.9, 0.12, M.gold, -7, -H / 2 - 0.4, 1.0, g);
  box(2.2, 0.7, 1.2, M.plastic, 7, H / 2 + 0.35, 1.6, g);
  g.userData = { fans, logo, power: V(7, H / 2 + 0.7, 1.6) };
  return g;
}

function makePump(M, accent) {
  const g = new THREE.Group(); // axis along z
  cylZ(3.4, 2.4, M.pumpBody, 0, 0, 1.2, g, 64);
  cylZ(3.55, 0.3, M.trim, 0, 0, 0.15, g, 64);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.12, 12, 72), M.glow);
  rim.position.z = 2.4;
  g.add(rim);
  const off = pumpScreenTex(false, accent), on = pumpScreenTex(true, accent);
  const screen = new THREE.Mesh(new THREE.CircleGeometry(3.0, 64), new THREE.MeshBasicMaterial({ map: off, toneMapped: false }));
  screen.position.z = 2.42;
  g.add(screen);
  box(2.6, 2.0, 1.6, M.pumpBody, 0, 3.6, 1.4, g, 0.3); // tube port block on top
  [-0.7, 0.7].forEach((x) => (mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.9, 20), M.trim, g).position.set(x, 4.7, 1.4)));
  g.userData = { screen, off, on };
  return g;
}

// ---------- case shells ----------
function makeCase(M, kind, light) {
  const g = new THREE.Group();
  const dims = kind === "hs420" ? { x: 22, y: 46, z: 14, tray: -6 } : { x: 21, y: 47, z: 11, tray: -9 };
  const { x: X, y: Y, z: Z } = dims;
  const t = 1.4;
  [-X + t / 2, X - t / 2].forEach((x) => [-Z + t / 2, Z - t / 2].forEach((z) => box(t, Y, t, M.frame, x, Y / 2, z, g, 0.3)));
  box(2 * X, t * 1.3, 2 * Z, M.frame, 0, Y - (t * 1.3) / 2, 0, g, 0.4);
  box(2 * X, t, 2 * Z, M.frame, 0, t / 2, 0, g, 0.3);
  // Perforated top panel
  const top = plane(2 * X - 5, 2 * Z - 4, new THREE.MeshStandardMaterial({ map: meshTex(light), metalness: 0.5, roughness: 0.5 }), -1, Y + 0.01, 0, g);
  top.rotation.x = -Math.PI / 2;
  // Front I/O on the top front edge: power button with LED ring, USB-C, 2x USB-A, audio
  const io = new THREE.Group();
  io.position.set(X - 2.2, Y + 0.02, 0);
  g.add(io);
  mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 32), M.trim, io).position.set(0, 0.1, Z - 4);
  const btnRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 32), M.glow);
  btnRing.rotation.x = Math.PI / 2;
  btnRing.position.set(0, 0.12, Z - 4);
  io.add(btnRing);
  [[-1, 0.9, 0.35], [-3, 1.3, 0.5], [-5, 1.3, 0.5], [-7, 0.45, 0.45]].forEach(([z, w, d]) => box(d, 0.1, w, M.plastic, 0, 0.02, Z + z - 4, io));
  // Feet with chrome rings
  [[-X + 3, -Z + 3], [X - 3, -Z + 3], [-X + 3, Z - 3], [X - 3, Z - 3]].forEach(([x, z]) => {
    mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.8, 32), M.plastic, g).position.set(x, -0.4, z);
    mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.12, 32), M.silver, g).position.set(x, -0.05, z);
  });
  // Back panel, tray and rear wall with PCIe slot covers and thumbscrews
  box(2 * X - 2 * t, Y - 2 * t, 0.3, M.frameDark, 0, Y / 2, -Z + 0.3, g);
  box(2 * X - 2 * t, Y - 2 * t, 0.3, M.frameDark, 0, Y / 2, dims.tray, g);
  box(0.3, Y - 2 * t, 2 * Z - 2 * t, M.frameDark, -X + t, Y / 2, 0, g);
  for (let i = 0; i < 7; i++) box(0.2, 1.4, 6.5, M.frame, -X + t + 0.25, Y * 0.42 - i * 2.03, (dims.tray + Z) / 2, g);
  [Y - 4, 4].forEach((y) => {
    const ts = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 16), M.silver, g);
    ts.rotation.z = Math.PI / 2;
    ts.position.set(-X - 0.3, y, Z - 1);
  });
  const rear = makeFan(12, M);
  rear.rotation.y = -Math.PI / 2;
  rear.position.set(-X + t + 1.5, Y - 13, (dims.tray + Z) / 2);
  g.add(rear);

  const fans = [rear];
  const groups = { rear: [rear], bottom: [], front: [], rad: [] };
  if (kind === "hs420") {
    // HAVN signature handle, three angled floor intakes under a glass shelf
    mesh(new THREE.TorusGeometry(1.6, 0.35, 16, 32, Math.PI), M.frame, g).position.set(-X + 4, Y, -Z + 3);
    [-13, 0, 13].forEach((x) => {
      const f = makeFan(12, M);
      f.rotation.x = -Math.PI / 2 + 0.28;
      f.position.set(x, 3.2, 4.5);
      g.add(f);
      fans.push(f);
      groups.bottom.push(f);
    });
    // Magnetic dust filter on the floor under the intakes
    const filter = plane(2 * X - 4, 2 * Z - 4, new THREE.MeshStandardMaterial({ map: meshTex(light), metalness: 0.3, roughness: 0.6 }), 0, t + 0.02, 0, g);
    filter.rotation.x = -Math.PI / 2;
    filter.material.map.repeat.set(22, 14);
    box(2 * X - 2 * t, 0.2, 10, M.glassShelf, 0, 6.1, 9, g);
    plane(5, 1.1, new THREE.MeshStandardMaterial({ map: textTex(["HAVN"], { w: 512, h: 112, size: 72, fg: "#cfcfd6" }), transparent: true }), 0, t / 2, Z + 0.01, g);
  } else {
    // PSU shroud with vents, three front intakes
    const sw = 2 * X - 2 * t - 3.5, sd = 2 * Z - 2 * t + 0.6 - (dims.tray + Z);
    const shroud = box(sw, 9.5, sd, M.frame, -1.75, t + 4.75, (dims.tray + Z) / 2 + 0.1, g, 0.3);
    const vent = plane(14, 4, new THREE.MeshStandardMaterial({ map: meshTex(light), metalness: 0.4, roughness: 0.5 }), -8, t + 4.75, shroud.position.z + sd / 2 + 0.01, g);
    vent.material.map.repeat.set(10, 3);
    const stop = plane(sw - 4, sd - 2, new THREE.MeshStandardMaterial({ map: meshTex(light), metalness: 0.4, roughness: 0.5 }), -1.75, t + 9.51, shroud.position.z, g);
    stop.rotation.x = -Math.PI / 2;
    [9.5, 21.5, 33.5].forEach((y) => {
      const f = makeFan(12, M);
      f.rotation.y = -Math.PI / 2;
      f.position.set(X - t - 1.5, y, 0);
      g.add(f);
      fans.push(f);
      groups.front.push(f);
    });
  }

  // Tempered glass with black screen-printed borders: fixed front panel, removable side panel
  box(0.4, Y - 2 * t, 2 * Z - 2 * t, M.glass, X - 0.4, Y / 2, 0, g).castShadow = false;
  const side = new THREE.Group();
  box(2 * X - 0.4, Y - 0.4, 0.4, M.glass, 0, Y / 2, 0, side).castShadow = false;
  const k = 1.3, gw = 2 * X - 0.4, gh = Y - 0.4;
  [[gw, k, 0, gh / 2 - k / 2], [gw, k, 0, -gh / 2 + k / 2], [k, gh, gw / 2 - k / 2, 0], [k, gh, -gw / 2 + k / 2, 0]].forEach(([w, h, x, y]) => box(w, h, 0.42, M.frit, x, Y / 2 + y, 0, side));
  side.position.z = Z - 0.2;
  g.add(side);

  // 360mm AIO radiator: fins, end tanks, screws, three fans
  const rad = new THREE.Group();
  const radY = Y - t * 1.3 - 1.4;
  box(34, 2.7, 12.2, new THREE.MeshStandardMaterial({ map: finTex([12, 1]), metalness: 0.6, roughness: 0.4 }), 0, 0, 0, rad);
  box(2.8, 3.0, 12.6, M.gunmetal, -18.4, 0, 0, rad, 0.3);
  box(2.8, 3.0, 12.6, M.gunmetal, 18.4, 0, 0, rad, 0.3);
  plane(2.2, 1.0, new THREE.MeshStandardMaterial({ map: textTex(["360"], { w: 256, h: 112, size: 70, fg: "#c9c9d2" }), transparent: true }), 18.4, 0, 6.31, rad);
  rad.position.set(-0.3, radY, (dims.tray + Z) / 2 + 0.5);
  g.add(rad);
  [-12.4, 0, 12.4].forEach((x) => {
    const f = makeFan(12, M);
    f.rotation.x = Math.PI / 2;
    f.position.set(x - 0.3, radY - 1.35 - 1.3, rad.position.z);
    g.add(f);
    fans.push(f);
    groups.rad.push(f);
  });

  g.userData = { dims, side, fans, groups, radY, radZ: rad.position.z, radPort: V(17.6, radY - 1.6, rad.position.z + 4.2) };
  return g;
}

// ---------- one assembly scene ----------
function buildScene(wrap, build, n) {
  const canvas = wrap.querySelector(".rig3d");
  const asm = wrap.closest(".assembly");
  const panel = asm.querySelector(".parts");
  const callout = wrap.querySelector(".callout");
  const accent = new THREE.Color(build.accent);
  const light = new THREE.Color(build.caseColor || 0x121216).getHSL({}).l > 0.5;
  const mobile = innerWidth < 768;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = light ? 0.9 : 1.15;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = bgTex(build.accent);
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.7;

  const diffuserTex = rainbowTex(build.accent);
  const brushed = brushedTex();
  const M = {
    frame: new THREE.MeshPhysicalMaterial({ color: build.caseColor || 0x121216, metalness: light ? 0.25 : 0.6, roughness: light ? 0.5 : 0.38, roughnessMap: brushed, anisotropy: light ? 0 : 0.6, clearcoat: light ? 0.35 : 0.1, clearcoatRoughness: 0.3 }),
    frameDark: std(light ? 0xd4d4da : 0x0d0d10, 0.4, 0.6),
    frit: std(0x050506, 0.2, 0.15),
    gunmetal: std(0x2a2c32, 0.8, 0.36, { roughnessMap: brushed }),
    wire: std(0x111114, 0, 0.55),
    usbCable: std(0x1f2a44, 0.1, 0.5),
    paste: std(0x9a9ca3, 0.4, 0.55),
    silver: std(0xc8cbd2, 1, 0.24),
    trim: std(0x9a9ca4, 1, 0.32, { roughnessMap: brushed }),
    gold: std(0xd8aa45, 1, 0.3),
    copper: std(0xc7774a, 1, 0.28),
    plastic: std(0x0f0f12, 0, 0.55),
    slot: std(0x3a3c44, 0, 0.5),
    latch: std(0x4a4c55, 0, 0.45),
    header: std(0xe8e8ea, 0, 0.5),
    usbBlue: std(0x1f4fb3, 0, 0.45),
    choke: std(0x5b5e66, 0.6, 0.45),
    cap: std(0x2b2d33, 0.9, 0.3),
    audioCap: std(0xc9a24a, 0.9, 0.3),
    pcb: std(0x16301f, 0.2, 0.55),
    pcbGreen: std(0x1c3d2b, 0.2, 0.5),
    substrate: std(0x24452e, 0.2, 0.5),
    ramSpreader: new THREE.MeshPhysicalMaterial({ color: light ? 0xe6e6ec : 0x23252b, metalness: 0.85, roughness: 0.3, roughnessMap: brushed, anisotropy: 0.7 }),
    finBlock: new THREE.MeshStandardMaterial({ map: finTex([6, 3]), metalness: 0.7, roughness: 0.4 }),
    shroud: new THREE.MeshPhysicalMaterial({ color: build.caseModel === "hs420" ? 0x2d2f35 : 0x1d1d22, metalness: 0.75, roughness: 0.34, roughnessMap: brushed, anisotropy: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    shroudInner: std(0x0b0b0d, 0.2, 0.7),
    gpuBlade: std(0x18181c, 0.1, 0.45),
    gpuHub: std(0x2a2b31, 0.7, 0.3),
    fanFrame: new THREE.MeshPhysicalMaterial({ color: light ? 0xf2f2f5 : 0x18181c, metalness: 0.05, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
    fanPad: std(light ? 0xc9c9cf : 0x0a0a0c, 0, 0.8),
    fanHub: std(light ? 0xf5f5f8 : 0x202024, 0.1, 0.45),
    fanSticker: new THREE.MeshStandardMaterial({ map: textTex(["◆"], { w: 128, h: 128, size: 70, bg: light ? "#f2f2f5" : "#16161a", fg: "#888" }) }),
    // A sheen fakes the frosted, light-diffusing plastic of RGB fan blades
    fanBlade: new THREE.MeshPhysicalMaterial({ color: 0xc9cad0, roughness: 0.45, sheen: 0.3, sheenColor: 0xffffff, emissive: accent, emissiveIntensity: 0 }),
    pumpBody: new THREE.MeshPhysicalMaterial({ color: 0x18181c, metalness: 0.6, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    sleeve: new THREE.MeshStandardMaterial({ map: weaveTex(light ? "#e8e8ee" : "#151518", light ? "#ffffff" : "#2c2c33", [1, 30]), roughness: 0.75 }),
    braid: new THREE.MeshStandardMaterial({ map: weaveTex("#101013", "#3a3a44", [1, 60]), roughness: 0.6, metalness: 0.2 }),
    comb: std(light ? 0xffffff : 0x1a1a1e, 0, 0.4),
    glow: std(0x9a9aa2, 0, 0.4, { emissive: accent, emissiveIntensity: 0 }),
    glowBar: std(0xdedee6, 0, 0.35, { emissive: accent, emissiveIntensity: 0 }),
    diffuser: new THREE.MeshStandardMaterial({ color: 0xa8a8b0, roughness: 0.35, emissive: 0xffffff, emissiveMap: diffuserTex, emissiveIntensity: 0 }),
    led: std(0x333333, 0, 0.4, { emissive: 0xffffff, emissiveIntensity: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fb0ad, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.035, depthWrite: false, envMapIntensity: 0.7, specularIntensity: 0.7 }),
    glassShelf: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }),
  };

  const root = new THREE.Group();
  scene.add(root);
  const pc = makeCase(M, build.caseModel, light);
  root.add(pc);
  const { dims, side, fans, groups, radY, radZ, radPort } = pc.userData;

  // Motherboard: rear I/O flush to the rear wall, top just under the radiator
  const mb = makeMotherboard(M, build.caseModel === "hs420" ? "Z790 AORUS" : "Z890 TUF");
  const boardTop = dims.y - 1.4 * 1.3 - 6.4;
  mb.position.set(-dims.x + 1.6 + 12.2, boardTop - 15.25, dims.tray + 0.2);
  root.add(mb);
  const B = mb.position, bz = B.z + mb.userData.Z;
  const sock = V(B.x - 3, B.y + 6.5, bz);
  [B.y + 4, B.y - 8].forEach((y) => {
    const gr = mesh(new THREE.TorusGeometry(1.1, 0.35, 10, 28), M.plastic, root);
    gr.scale.set(1, 2.2, 1);
    gr.position.set(B.x + 14.6, y, dims.tray + 0.2);
  });

  // Pre-routed cables: 24-pin and 2x CPU EPS, individually sleeved with combs
  root.add(sleeved([V(B.x + 11.4, B.y + 4.5, bz + 1.8), V(B.x + 12.6, B.y + 4.5, bz + 2.8), V(B.x + 14.2, B.y + 4.2, bz + 2.2), V(B.x + 14.6, B.y + 4, dims.tray - 0.5)], M, { cols: 12, rows: 2, gap: 0.42, r: 0.19, combs: [0.45] }));
  [0, 1].forEach((i) =>
    root.add(sleeved([V(B.x - 10.0 + i * 1.9, B.y + 14.9, bz + 0.9), V(B.x - 10.0 + i * 1.9, B.y + 15.9, bz + 2.0), V(B.x - 10.6 + i * 1.9, B.y + 16.4, bz + 0.5), V(B.x - 11 + i * 1.9, B.y + 16.6, dims.tray - 0.5)], M, { cols: 4, rows: 2, gap: 0.4, r: 0.17, up: V(0, 1, 0), combs: [] }))
  );

  // Fan + ARGB wiring daisy-chained between fans and run to the board headers
  const wire = (pts, r = 0.12, mat = M.wire) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 6), mat, root);
  const header = (x, y) => V(B.x + x, B.y + y, bz + 0.7);
  const chain = (pts, to) => [0, 0.32].forEach((o) => wire([...pts.map((q) => q.clone().add(V(0, o, o))), ...to.map((q) => q.clone().add(V(o, 0, 0)))]));
  if (groups.bottom.length)
    chain(groups.bottom.map((f) => f.position.clone().add(V(4.6, -1.4, -5.2))), [V(B.x + 7, 6.6, dims.tray + 0.8), header(5.6, -14.6)]);
  if (groups.front.length)
    chain(groups.front.slice().reverse().map((f) => f.position.clone().add(V(-1.4, -5.4, -5.4))), [V(B.x + 13.5, B.y - 13, dims.tray + 0.8), header(11.6, -1.2)]);
  chain(groups.rad.map((f) => V(f.position.x + 5, radY - 3.4, radZ - 5.9)), [V(B.x + 1, B.y + 16.2, bz + 1.4), header(-0.2, 14.6)]);
  const rf = groups.rear[0].position;
  wire([V(rf.x + 1.4, rf.y + 6.2, rf.z - 3), V(rf.x + 2.4, B.y + 15.9, bz + 0.5), V(B.x - 2, B.y + 15.9, bz + 0.5), V(B.x + 7.5, B.y + 15.7, bz + 0.6), header(8.6, 14.6)]);
  // Front-panel and USB 3 cables tucked under the board into the tray
  wire([header(5.6, -14.6).add(V(0, 0, 0.2)), header(5.8, -15.8).add(V(0, 0, 0.6)), V(B.x + 7.5, B.y - 17.2, dims.tray + 0.5)], 0.22);
  wire([header(-2.3, -14.4).add(V(0, 0, 0.3)), header(-2.3, -15.8).add(V(0, 0, 0.7)), V(B.x - 1.5, B.y - 17.4, dims.tray + 0.5)], 0.38, M.usbCable);

  // ----- parts that get installed -----
  const install = Object.fromEntries(build.install.map((p) => [p.key, p]));

  const cpu = makeCPU(M, install.cpu?.name || "");
  root.add(cpu);
  const cpuTo = { p: sock.clone().setZ(bz + 0.05), r: new THREE.Euler() };
  const cpuFrom = { p: sock.clone().add(V(2, 16, 14)), r: new THREE.Euler(0.9, 0.4, 1.2) };

  const paste = mesh(new THREE.SphereGeometry(0.62, 24, 12), M.paste, root);
  paste.scale.set(1, 1, 0.3);
  paste.position.copy(sock).setZ(bz + 0.55);

  const pump = makePump(M, build.accent);
  root.add(pump);
  const pumpTo = { p: sock.clone().setZ(bz + 0.75), r: new THREE.Euler() };
  const pumpFrom = { p: sock.clone().add(V(10.5, -4, 10)), r: new THREE.Euler(0.5, -0.9, 0.4) };
  let tubes = [];
  const updateTubes = () => {
    tubes.forEach((t) => {
      root.remove(t);
      t.traverse((o) => o.geometry?.dispose());
    });
    tubes = [-0.7, 0.7].map((dx) => {
      const port = V(dx, 5.1, 1.4).applyMatrix4(pump.matrixWorld);
      const end = radPort.clone().add(V(0, 0, dx * 1.6));
      const curve = new THREE.CatmullRomCurve3([port, port.clone().add(V(dx * 0.6, 3.5, 2.5)), end.clone().add(V(-9, -3, 1.5)), end.clone().add(V(-2, -0.5, 0)), end]);
      const tg = new THREE.Group();
      mesh(new THREE.TubeGeometry(curve, 64, 0.55, 12), M.braid, tg);
      mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.0, 20), M.trim, tg).position.copy(end);
      root.add(tg);
      return tg;
    });
  };

  const sticks = [1, 3].map((i) => {
    const s = makeRAM(M, light);
    root.add(s);
    const to = V(B.x + mb.userData.dimmX[i], B.y + 6.5, bz + 0.35);
    return { obj: s, latch: mb.userData.latches[i], to: { p: to, r: new THREE.Euler() }, from: { p: to.clone().add(V(1, 6, 20)), r: new THREE.Euler(-0.5, 0.3, 0.2) } };
  });

  const ssdPivot = new THREE.Group();
  ssdPivot.add(makeSSD(M, install.ssd?.short || "1TB"));
  root.add(ssdPivot);
  const ssdAt = V(B.x - 8.0, B.y - 1.5, bz + 0.3);
  const ssd = { to: { p: ssdAt, r: new THREE.Euler() }, mid: { p: ssdAt, r: new THREE.Euler(0, -0.42, 0) }, from: { p: ssdAt.clone().add(V(6, 5, 18)), r: new THREE.Euler(0.3, -0.42, 0.5) } };
  const screw = makeScrew(M);
  root.add(screw);
  const screwAt = V(B.x, B.y - 1.5, bz + 0.5);

  const gpu = makeGPU(M, install.gpu?.name || "");
  root.add(gpu);
  let gpuTo;
  if (build.caseModel === "hs420") {
    gpuTo = { p: V(-2.5, B.y - 9.5, dims.tray + 4.5), r: new THREE.Euler() };
    box(1.2, 14, 6, M.frame, -18.6, B.y - 9.5, dims.tray + 3.5, root, 0.2); // vertical GPU bracket
    // PCIe riser ribbon from the x16 slot down behind the card
    const riser = new THREE.CatmullRomCurve3([V(B.x + 2, B.y - 4.3, bz + 1.1), V(B.x + 2, B.y - 6, bz + 2.5), V(-8, B.y - 15.5, dims.tray + 2.8)]);
    mesh(new THREE.TubeGeometry(riser, 24, 0.5, 4), M.plastic, root).scale.z = 0.4;
  } else {
    gpuTo = { p: V(B.x + 1.2, B.y - 4.3 - 0.6, bz + 1.1 + 6), r: new THREE.Euler(Math.PI / 2, 0, 0) };
  }
  const gpuFrom = { p: gpuTo.p.clone().add(V(10, -6, 34)), r: new THREE.Euler(gpuTo.r.x + 0.35, -0.7, 0.15) };
  // Anti-sag stand under the far end of a horizontal card
  let stand = null;
  if (build.caseModel !== "hs420") {
    stand = new THREE.Group();
    const top = gpuTo.p.y - 5.2, base = 1.4 * 1.0 + 9.5;
    const post = mesh(new THREE.CylinderGeometry(0.4, 0.4, top - base, 16), M.trim, stand);
    post.position.y = (top + base) / 2;
    mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 24), M.gunmetal, stand).position.y = base + 0.2;
    mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 24), M.plastic, stand).position.y = top - 0.15;
    stand.position.set(gpuTo.p.x + 11, 0, gpuTo.p.z);
    root.add(stand);
  }
  // 12V-2x6 cable from the tray grommet into the card's power connector
  gpu.position.copy(gpuTo.p);
  gpu.quaternion.setFromEuler(gpuTo.r);
  gpu.updateMatrixWorld();
  const pwr = gpu.userData.power.clone().applyMatrix4(gpu.matrixWorld);
  const pwrUp = V(0, 1, 0).transformDirection(gpu.matrixWorld);
  const gpuCable = sleeved([pwr.clone().addScaledVector(pwrUp, 0.3), pwr.clone().addScaledVector(pwrUp, 3), V(B.x + 14.6, B.y - 6, bz + 4), V(B.x + 14.6, B.y - 8, dims.tray - 0.5)], M, { cols: 6, rows: 2, gap: 0.34, r: 0.14, combs: [0.35] });
  root.add(gpuCable);

  // Studio floor: glossy disc that fades into the backdrop, plus soft contact shadows
  const floor = new THREE.Mesh(new THREE.CircleGeometry(150, 64), new THREE.MeshStandardMaterial({ color: 0x0c0b10, roughness: 0.25, metalness: 0.6, transparent: true, alphaMap: fadeTex(), envMapIntensity: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.82;
  floor.userData.noAO = true;
  root.add(floor);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: 0.55 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.8;
  shadowFloor.receiveShadow = true;
  root.add(shadowFloor);

  root.traverse((o) => {
    const m = o.material;
    if (!m || Array.isArray(m)) return;
    if (m === M.glass || m === M.glassShelf) o.userData.noAO = true;
    if (m.map?.userData.bump && !m.bumpMap) {
      m.bumpMap = m.map;
      m.bumpScale = m.map.userData.bump;
      m.needsUpdate = true;
    }
  });

  // Lighting
  if (!mobile) {
    // Big soft area light, like a softbox above and in front of the case
    RectAreaLightUniformsLib.init();
    const soft = new THREE.RectAreaLight(0xfff3e8, 4.5, 70, 34);
    soft.position.set(25, 80, 70);
    soft.lookAt(0, 20, 0);
    scene.add(soft);
  }
  scene.add(new THREE.HemisphereLight(0xc8ccff, 0x0e0e14, 0.45));
  const key = new THREE.DirectionalLight(0xfff1e2, 2.4);
  key.position.set(45, 85, 70);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -50, right: 50, top: 65, bottom: -15, near: 10, far: 240 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa9b8ff, 1.4);
  rim.position.set(-70, 45, -60);
  scene.add(rim);
  const kicker = new THREE.SpotLight(accent, 0, 220, 0.6, 0.8, 1.2);
  kicker.position.set(-60, 10, 60);
  kicker.target.position.set(0, 20, 0);
  scene.add(kicker, kicker.target);
  const inner = [V(0, dims.y - 10, 2), V(0, 8, 4), V(-12, 26, 0)].map((p) => {
    const l = new THREE.PointLight(accent, 0, 60, 1.6);
    l.position.copy(p);
    scene.add(l);
    return l;
  });
  const work = new THREE.PointLight(0xffffff, 0, 70, 1.4);
  work.position.set(10, 30, 30);
  scene.add(work);

  // Camera + post-processing (bloom so the RGB actually glows)
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 800);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (!mobile) {
    const ao = new GlassAwareGTAOPass(scene, camera, 512, 512);
    ao.updateGtaoMaterial({ radius: 2.4, distanceExponent: 1.2, thickness: 1.4, scale: 1 });
    ao.blendIntensity = 0.85;
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, light ? 1.6 : 1.05);
  // Shallow depth of field on the close-ups, like a macro lens
  const dof = mobile ? null : new BokehPass(scene, camera, { focus: 100, aperture: 0, maxblur: 0.006 });
  if (dof) composer.addPass(dof);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);

  // Camera shots: [progress, target, direction, distance]
  const center = V(0, dims.y / 2, 0);
  const D = (x, y, z) => V(x, y, z).normalize();
  const ramC = V(B.x + 4.8, B.y + 6.5, bz);
  const ssdC = ssdAt.clone().add(V(4, 0, 0));
  const gpuC = gpuTo.p.clone().add(build.caseModel === "hs420" ? V(0, 0, 2) : V(0, -2.5, 3));
  const shots = [
    [0.0, center, D(0.55, 0.3, 1), 135],
    [0.08, center, D(0.35, 0.28, 1), 118],
    [0.13, sock, D(0.3, 0.35, 1), 48],
    [0.23, sock, D(0.15, 0.3, 1), 52],
    [0.29, ramC, D(-0.35, 0.3, 1), 50],
    [0.38, ramC, D(-0.25, 0.25, 1), 52],
    [0.44, ssdC, D(0.2, 0.45, 1), 38],
    [0.56, ssdC, D(0.05, 0.4, 1), 40],
    [0.61, gpuC, D(0.4, 0.2, 1), 74],
    [0.76, gpuC, D(0.25, 0.25, 1), 76],
    [0.86, center, D(0.45, 0.22, 1), 124],
    [1.0, center, D(0.85, 0.18, 1), 116],
  ];
  const camTarget = V(), tmpDir = V();
  let distScale = 1;
  // yaw/pitch are the viewer's drag-orbit offsets on top of the scripted shot
  function placeCamera(p, yaw = 0, pitch = 0) {
    let i = 0;
    while (i < shots.length - 2 && p > shots[i + 1][0]) i++;
    const [p0, t0, d0, r0] = shots[i], [p1, t1, d1, r1] = shots[i + 1];
    const k = easeInOut(clamp01((p - p0) / (p1 - p0)));
    camTarget.lerpVectors(t0, t1, k);
    tmpDir.lerpVectors(d0, d1, k).normalize();
    const theta = Math.atan2(tmpDir.x, tmpDir.z) + yaw;
    const phi = Math.max(0.03, Math.min(1.35, Math.asin(tmpDir.y) + pitch)); // stay above the floor
    tmpDir.set(Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi));
    camera.position.copy(camTarget).addScaledVector(tmpDir, (r0 + (r1 - r0) * k) * distScale);
    camera.lookAt(camTarget);
  }

  // Floating label that follows the part being installed
  const calls = [
    { win: [T.cpu[0], T.pump[1]], at: sock.clone().add(V(0, 0, 3)), type: "CPU", name: install.cpu?.name },
    { win: T.ram, at: ramC.clone().add(V(1.5, 6, 4)), type: "Memory", name: install.ram?.name },
    { win: [T.ssd[0], T.screw[1]], at: ssdC.clone().add(V(0, 0, 0.6)), type: "Storage", name: install.ssd?.name },
    { win: [T.gpu[0], T.gpuCable[1]], at: gpuC.clone().add(build.caseModel === "hs420" ? V(8, 3, 3) : V(8, 0, 6)), type: "Graphics", name: install.gpu?.name },
  ];
  const callSmall = callout.querySelector("small"), callName = callout.querySelector("em");
  let callIdx = -1;
  const proj = V();
  function updateCallout(p, w, h) {
    const i = calls.findIndex((c) => p >= c.win[0] && p <= c.win[1] + 0.02);
    if (i !== callIdx) {
      callIdx = i;
      if (i >= 0) {
        callSmall.textContent = calls[i].type;
        callName.textContent = calls[i].name || "";
      }
    }
    if (i < 0) {
      callout.style.opacity = 0;
      return;
    }
    proj.copy(calls[i].at).project(camera);
    const x = ((proj.x + 1) / 2) * w, y = ((1 - proj.y) / 2) * h;
    callout.style.opacity = proj.z < 1 ? 1 : 0;
    callout.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
  }

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function pose(obj, A, Bp, t) {
    obj.position.lerpVectors(A.p, Bp.p, t);
    qa.setFromEuler(A.r);
    qb.setFromEuler(Bp.r);
    obj.quaternion.slerpQuaternions(qa, qb, t);
  }

  let lastPump = -1, power = 0;
  function apply(p) {
    // Side glass slides off for the build, back on before power-up
    const off = easeInOut(seg(p, T.panelOff)) * (1 - easeInOut(seg(p, T.panelOn)));
    side.position.set(off * 58, off * 4, dims.z - 0.2 + off * 12);
    side.visible = off < 0.98;
    work.intensity = off * 170;

    // CPU drops into the socket, the retention arm closes
    const tc = easeOut(seg(p, T.cpu));
    cpu.visible = tc > 0;
    pose(cpu, cpuFrom, cpuTo, tc);
    mb.userData.lever.rotation.y = -1.3 * (1 - easeInOut(seg(p, T.lever)));

    // A pea-sized dot of thermal paste goes on before the cooler
    const tpa = seg(p, T.paste);
    paste.visible = tpa > 0;
    paste.scale.set(tpa, tpa, 0.3 * tpa);

    // AIO pump moves from where it was hanging onto the CPU
    const tp = easeInOut(seg(p, T.pump));
    if (tp !== lastPump) {
      pose(pump, pumpFrom, pumpTo, tp);
      pump.updateMatrixWorld();
      updateTubes();
      lastPump = tp;
    }

    // RAM: latches open, sticks press in, latches snap shut
    sticks.forEach((s, i) => {
      const t = seg(p, [T.ram[0] + i * 0.04, T.ram[1] - (1 - i) * 0.03]);
      s.obj.visible = t > 0;
      const dropIn = { p: s.to.p.clone().add(V(0, 0, 3)), r: s.to.r };
      if (t < 0.75) pose(s.obj, s.from, dropIn, easeOut(t / 0.75));
      else pose(s.obj, dropIn, s.to, easeInOut((t - 0.75) / 0.25));
      s.latch.rotation.x = t > 0 && t < 0.92 ? -0.75 : 0;
    });

    // M.2: in at an angle, pressed flat, screw drives in
    const ts = seg(p, T.ssd);
    ssdPivot.visible = ts > 0;
    if (ts < 0.65) pose(ssdPivot, ssd.from, ssd.mid, easeOut(ts / 0.65));
    else pose(ssdPivot, ssd.mid, ssd.to, easeInOut((ts - 0.65) / 0.35));
    const tw = seg(p, T.screw);
    screw.visible = tw > 0;
    screw.position.copy(screwAt).add(V(0, 0, (1 - easeOut(tw)) * 5));
    screw.rotation.z = tw * Math.PI * 6;

    // GPU slides in, then its power cable appears
    const tg = easeOut(seg(p, T.gpu));
    gpu.visible = tg > 0;
    pose(gpu, gpuFrom, gpuTo, tg);
    gpuCable.visible = p >= T.gpuCable[0] + 0.01;
    if (stand) stand.visible = p >= T.gpu[1];

    // Power on
    power = easeInOut(seg(p, T.power));
    M.glow.emissiveIntensity = power * 3.2;
    M.glowBar.emissiveIntensity = power * 2.4;
    M.diffuser.emissiveIntensity = power * 2.2;
    M.fanBlade.emissiveIntensity = power * 0.18;
    M.led.emissiveIntensity = power * 2;
    mb.userData.qcode.emissiveIntensity = power * 2.2;
    gpu.userData.logo.material.emissiveIntensity = power * 0.9;
    inner.forEach((l) => (l.intensity = power * (light ? 35 : 70)));
    kicker.intensity = power * (light ? 400 : 1400);
    const scr = pump.userData.screen.material;
    const want = power > 0.4 ? pump.userData.on : pump.userData.off;
    if (scr.map !== want) {
      scr.map = want;
      scr.needsUpdate = true;
    }
    scr.color.setScalar(0.25 + power * 1.1);
  }

  // ----- render loop -----
  let visible = false, raf = 0, last = performance.now(), spin = 0, W = 1, H = 1;
  // Drag-to-orbit state (with a little inertia after release)
  let yaw = 0, pitch = 0, vYaw = 0, vPitch = 0, dragging = false, lastX = 0, lastY = 0, lastP = 0;
  const allFans = [...fans, ...gpu.userData.fans];
  function frame() {
    raf = 0;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = reduce ? 1 : window.PC_PROGRESS?.[n] ?? 0;
    apply(p);
    spin += dt * power * 24;
    allFans.forEach((f, i) => (f.userData.rotor.rotation.z = spin * (i % 2 ? 1 : 1.06)));
    diffuserTex.offset.y += dt * power * 0.25;
    const scrolling = Math.abs(p - lastP) > 0.0002;
    lastP = p;
    if (!dragging) {
      yaw += vYaw;
      pitch += vPitch;
      vYaw *= 0.92;
      vPitch *= 0.92;
      // Scrolling hands the camera back to the scripted close-ups (shortest way round)
      if (scrolling) {
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 0.9;
        pitch *= 0.9;
      }
    }
    pitch = Math.max(-0.6, Math.min(1.1, pitch));
    placeCamera(p, yaw, pitch);
    updateCallout(p, W, H);
    if (dof) {
      const dist = camera.position.distanceTo(camTarget);
      const close = clamp01((85 - dist) / 40);
      dof.enabled = close > 0.02;
      dof.uniforms.focus.value = dist;
      dof.uniforms.aperture.value = 0.00045 * close;
    }
    film.uniforms.uTime.value = (now / 1000) % 100;
    composer.render();
    if (visible && !reduce) raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    if (!raf && wrap.classList.contains("ready")) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  const resize = () => {
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    const narrow = W < 768;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.fov = narrow ? 34 : 28;
    distScale = W / H < 1 ? Math.min(1.75, 0.8 / (W / H)) : 1;
    // Shift the subject away from the parts panel (left on desktop, up on phones)
    const ox = narrow ? 0 : (panel.offsetWidth + 40) / 2;
    const oy = narrow ? panel.offsetHeight * 0.48 : 0;
    camera.setViewOffset(W, H, ox, oy, W, H);
    camera.updateProjectionMatrix();
    kick();
  };
  new ResizeObserver(resize).observe(wrap);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  }).observe(wrap);
  wrap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    vYaw = vPitch = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    wrap.setPointerCapture(e.pointerId);
    wrap.classList.add("dragging");
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    vYaw = (-dx / W) * Math.PI * 2; // a full-width drag = one full turn
    vPitch = (dy / H) * Math.PI * 0.8;
    yaw += vYaw;
    pitch += vPitch;
    kick();
  });
  const endDrag = () => {
    dragging = false;
    wrap.classList.remove("dragging");
  };
  wrap.addEventListener("pointerup", endDrag);
  wrap.addEventListener("pointercancel", endDrag);
  wrap.addEventListener("dblclick", () => {
    yaw = pitch = vYaw = vPitch = 0;
    kick();
  });
  resize();
  // Compile every shader in parallel (off the main thread where the browser supports it) so neither
  // the page nor the first visible frame stalls; never wait more than 2.5s for it
  apply(1);
  placeCamera(0, 0, 0);
  const done = () => {
    if (wrap.classList.contains("ready")) return;
    apply(reduce ? 1 : window.PC_PROGRESS?.[n] ?? 0);
    wrap.classList.add("ready");
    kick();
  };
  return Promise.race([renderer.compileAsync(scene, camera).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]).then(done);
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

if (hasWebGL()) {
  // Waits for fonts so the canvas-drawn labels use Space Grotesk / Inter
  const wraps = [...document.querySelectorAll(".rig-wrap")];
  const built = new Set();
  const idle = (fn) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  let queue = Promise.resolve();
  const build = (wrap) => {
    if (built.has(wrap)) return queue;
    built.add(wrap);
    const n = +wrap.querySelector(".rig3d").dataset.build;
    return (queue = queue.then(() => buildScene(wrap, C.pcBuilds[n], n)));
  };
  // Start only after the intro has played (or as soon as the visitor starts scrolling), then build
  // one scene per idle slot so the page never freezes; getting close to a scene builds it right away
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    removeEventListener("scroll", onScroll);
    const next = () => {
      const w = wraps.find((x) => !built.has(x));
      if (w) build(w).then(() => idle(next));
    };
    idle(next);
  };
  const onScroll = () => scrollY > innerHeight * 0.4 && start();
  document.fonts.ready.then(() => {
    addEventListener("scroll", onScroll, { passive: true });
    setTimeout(start, 3500);
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && build(e.target)), { rootMargin: "100% 0px" });
    wraps.forEach((w) => io.observe(w));
  });
} else {
  document.querySelectorAll(".rig-wrap").forEach((w) => w.classList.add("no-webgl"));
}
