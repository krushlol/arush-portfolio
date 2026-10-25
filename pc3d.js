// Real-time 3D PC assembly. Units are centimetres, modelled to real part sizes.
// Each .rig3d canvas reads its scroll progress from window.PC_PROGRESS[n] (set by main.js).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const C = window.CONTENT;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- helpers ----------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const smooth = (t) => t * t * (3 - 2 * t);

function std(color, metalness = 0, roughness = 0.5, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0, parent, r = 0) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

function cyl(r, h, mat, parent, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.castShadow = m.receiveShadow = true;
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

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Deterministic random so the board traces look the same every load
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// ---------- textures ----------
const PX = 25; // pixels per cm on the motherboard texture

function boardTexture(label) {
  return canvasTex(24.4 * PX, 30.5 * PX, (g, w, h) => {
    g.fillStyle = "#15161b";
    g.fillRect(0, 0, w, h);
    const r = rng(7);
    g.lineWidth = 1.3;
    for (let i = 0; i < 340; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.02 + r() * 0.035})`;
      let x = r() * w, y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      const horiz = r() < 0.5, len = 20 + r() * 140;
      horiz ? (x += len) : (y += len);
      g.lineTo(x, y);
      const k = 8 + r() * 30;
      g.lineTo(x + k, y + k);
      g.stroke();
    }
    // Armor-style graphic
    g.fillStyle = "rgba(255,255,255,0.035)";
    g.beginPath();
    g.moveTo(w * 0.55, h * 0.55);
    g.lineTo(w, h * 0.35);
    g.lineTo(w, h * 0.7);
    g.lineTo(w * 0.62, h * 0.85);
    g.fill();
    // Mounting holes
    [[0.6, 1.0], [23.0, 1.0], [0.6, 15], [23.0, 15], [0.6, 29.5], [23.0, 29.5]].forEach(([cx, cy]) => {
      g.fillStyle = "#b9bcc4";
      g.beginPath();
      g.arc(cx * PX, cy * PX, 0.45 * PX, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#0b0b0e";
      g.beginPath();
      g.arc(cx * PX, cy * PX, 0.2 * PX, 0, Math.PI * 2);
      g.fill();
    });
    // Silkscreen
    g.fillStyle = "rgba(230,230,236,0.6)";
    g.font = `700 ${0.9 * PX}px "Space Grotesk", sans-serif`;
    g.fillText(label, 14.5 * PX, 24.2 * PX);
    g.font = `500 ${0.35 * PX}px Inter, sans-serif`;
    g.fillText("M.2_1", 4.5 * PX, 15.6 * PX);
    g.fillText("PCIEX16_1", 2.2 * PX, 18.4 * PX);
    g.fillText("DDR5_A2   DDR5_B2", 15.2 * PX, 1.3 * PX);
    g.strokeStyle = "rgba(230,230,236,0.25)";
    g.lineWidth = 1.5;
    g.strokeRect(4.2 * PX, 16 * PX, 8.6 * PX, 2.6 * PX);
  });
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
      const s = i === 0 ? size : size * 0.62;
      g.font = `${i === 0 ? weight : 500} ${s}px ${font}`;
      g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 0.95);
    });
  });
}

function finTex() {
  const t = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = "#22242a";
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = x % 8 ? "#5a5e68" : "#3a3d45";
      g.fillRect(x, 0, 2, h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function ihsTex(cpuName) {
  const brand = /ultra/i.test(cpuName) ? ["intel", "CORE ULTRA 7", cpuName.replace(/^.*?(\d{3}K.*)$/i, "$1")] : ["intel", "CORE i7", cpuName.replace(/^.*?(\d{5}K.*)$/i, "$1")];
  return canvasTex(512, 420, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "#e4e6ea");
    grd.addColorStop(0.5, "#c3c6cc");
    grd.addColorStop(1, "#dadde2");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3d3f45";
    g.textAlign = "left";
    g.font = '600 64px Inter, sans-serif';
    g.fillText(brand[0], 48, 120);
    g.font = '700 46px Inter, sans-serif';
    g.fillText(brand[1], 48, 200);
    g.font = '500 38px Inter, sans-serif';
    g.fillText(brand[2], 48, 260);
    g.font = '400 24px Inter, sans-serif';
    g.fillText("SRN3X  3.40GHZ", 48, 330);
    g.fillText("X411G371  ◆", 48, 365);
  });
}

function pumpScreenTex(on, accent) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#050507";
    g.fillRect(0, 0, w, h);
    if (!on) return;
    g.strokeStyle = accent;
    g.lineWidth = 12;
    g.beginPath();
    g.arc(w / 2, h / 2, 100, Math.PI * 0.75, Math.PI * 2.05);
    g.stroke();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '700 74px "Space Grotesk", sans-serif';
    g.fillText("32°", w / 2, h / 2 - 6);
    g.font = '500 22px Inter, sans-serif';
    g.fillStyle = "rgba(255,255,255,.7)";
    g.fillText("CPU TEMP", w / 2, h / 2 + 52);
  });
}

// ---------- components ----------
function makeFan(size, M, { frame = true, ring = true, blades = M.fanBlade, count = 7 } = {}) {
  const g = new THREE.Group();
  const depth = size * 0.21, r = size * 0.45;
  if (frame) {
    const sh = rrShape(size, size, size * 0.1);
    const hole = new THREE.Path();
    hole.absarc(0, 0, r, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 40 });
    geo.translate(0, 0, -depth / 2);
    const f = new THREE.Mesh(geo, M.fanFrame);
    f.castShadow = f.receiveShadow = true;
    g.add(f);
  }
  const rotor = new THREE.Group();
  g.add(rotor);
  const hub = cyl(r * 0.36, depth * 0.75, M.fanHub, rotor);
  hub.rotation.x = Math.PI / 2;
  const bladeGeo = new THREE.BoxGeometry(r * 0.68, r * 0.36, size * 0.012);
  bladeGeo.translate(r * 0.34 + r * 0.28, 0, 0);
  for (let i = 0; i < count; i++) {
    const p = new THREE.Group();
    p.rotation.z = (i / count) * Math.PI * 2;
    const b = new THREE.Mesh(bladeGeo, blades);
    b.rotation.x = 0.55;
    b.castShadow = true;
    p.add(b);
    rotor.add(p);
  }
  if (ring) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, size * 0.016, 8, 64), M.glow);
    g.add(t);
    const t2 = t.clone();
    t2.position.z = depth * 0.45;
    g.add(t2);
  }
  g.userData.rotor = rotor;
  return g;
}

function makeMotherboard(M, label) {
  const g = new THREE.Group();
  const board = box(24.4, 30.5, 0.18, new THREE.MeshStandardMaterial({ map: boardTexture(label), roughness: 0.62, metalness: 0.25 }), 0, 0, 0.09, g);
  board.receiveShadow = true;
  const Z = 0.18; // board top surface
  // Rear I/O shroud + VRM heatsinks
  box(3.6, 14, 3.4, M.gunmetal, -10.3, 8, Z + 1.7, g, 0.3);
  const ioLogo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 9), new THREE.MeshStandardMaterial({ map: textTex([label.split(" ")[0]], { w: 128, h: 440, size: 40 }), transparent: true, roughness: 0.4 }));
  ioLogo.position.set(-10.3, 8, Z + 3.42);
  g.add(ioLogo);
  const vrm = box(9.5, 2.6, 2.4, M.gunmetal, -3.5, 13.4, Z + 1.2, g, 0.25);
  const fins = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.2), new THREE.MeshStandardMaterial({ map: finTex(), metalness: 0.7, roughness: 0.35 }));
  fins.position.set(-3.5, 13.4, Z + 2.41);
  g.add(fins);
  box(2.4, 9, 2.4, M.gunmetal, -7.3, 4.5, Z + 1.2, g, 0.25);
  // Capacitors / chokes around the socket
  for (let i = 0; i < 7; i++) {
    const c = cyl(0.3, 0.9, M.silver, g, 16);
    c.rotation.x = Math.PI / 2;
    c.position.set(-6.6 + i * 1.1, 11.6, Z + 0.45);
  }
  // CPU socket (LGA1700 ILM)
  const socket = new THREE.Group();
  socket.position.set(-3, 6.5, Z);
  g.add(socket);
  const ilm = new THREE.Shape();
  ilm.copy(rrShape(5.6, 6.6, 0.3));
  const win = new THREE.Path();
  win.moveTo(-2.15, -2.5);
  win.lineTo(2.15, -2.5);
  win.lineTo(2.15, 2.5);
  win.lineTo(-2.15, 2.5);
  win.closePath();
  ilm.holes.push(win);
  const ilmMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ilm, { depth: 0.25, bevelEnabled: false }), M.silver);
  ilmMesh.castShadow = ilmMesh.receiveShadow = true;
  socket.add(ilmMesh);
  box(4.3, 5.0, 0.08, M.gold, 0, 0, 0.05, socket); // pins
  const lever = new THREE.Group();
  lever.position.set(3.0, -3.1, 0.3);
  const arm = cyl(0.09, 6.4, M.silver, lever, 8);
  arm.position.y = 3.2;
  socket.add(lever);
  // DIMM slots (4) to the right of the socket
  const dimmX = [3.4, 4.3, 5.2, 6.1];
  dimmX.forEach((x) => {
    box(0.6, 13.8, 0.75, M.slot, x, 6.5, Z + 0.37, g);
    box(0.6, 0.6, 1.0, M.slot, x, 13.6, Z + 0.5, g);
    box(0.6, 0.6, 1.0, M.slot, x, -0.6, Z + 0.5, g);
  });
  // 24-pin
  box(1.1, 5.4, 1.3, M.plastic, 11.4, 4.5, Z + 0.65, g);
  // M.2 slot + standoff
  box(0.6, 2.2, 0.55, M.plastic, -8.2, -1.5, Z + 0.27, g);
  const standoff = cyl(0.25, 0.4, M.gold, g, 12);
  standoff.rotation.x = Math.PI / 2;
  standoff.position.set(0, -1.5, Z + 0.2);
  // PCIe x16 (reinforced) + other slots
  box(8.9, 0.75, 1.1, M.silver, -6.2, -4.3, Z + 0.55, g);
  box(8.9, 0.75, 1.1, M.slot, -6.2, -10.3, Z + 0.55, g);
  box(3.0, 0.75, 1.1, M.slot, -9.2, -13.0, Z + 0.55, g);
  // Chipset heatsink
  box(7, 7, 0.9, M.gunmetal, 6.5, -9.5, Z + 0.45, g, 0.2);
  const chipLogo = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshStandardMaterial({ map: textTex([label], { w: 512, h: 170, size: 54 }), transparent: true }));
  chipLogo.position.set(6.5, -9.5, Z + 0.91);
  g.add(chipLogo);
  // CMOS battery
  const bat = cyl(1.0, 0.3, M.silver, g, 32);
  bat.rotation.x = Math.PI / 2;
  bat.position.set(1.5, -7.4, Z + 0.15);

  g.userData = { socket, lever, dimmX, Z };
  return g;
}

function makeCPU(M, name) {
  const g = new THREE.Group();
  box(4.5, 3.75, 0.12, M.substrate, 0, 0, 0.06, g);
  const ihs = box(3.4, 3.0, 0.32, new THREE.MeshStandardMaterial({ map: ihsTex(name), metalness: 0.9, roughness: 0.22 }), 0, 0, 0.28, g, 0.06);
  ihs.material.color.set(0xffffff);
  g.rotation.z = Math.PI / 2; // LGA1700 sits portrait on the board
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

function makeRAM(M) {
  const g = new THREE.Group(); // length along y, height along z, thickness along x
  box(0.12, 13.3, 3.1, M.pcb, 0, 0, 1.55, g);
  box(0.75, 13.3, 3.2, M.ramSpreader, 0, 0, 1.75, g, 0.08);
  box(0.78, 12.6, 0.3, M.silver, 0, 0, 2.6, g);
  const bar = box(0.8, 13.0, 0.5, M.glowBar, 0, 0, 3.55, g, 0.1);
  bar.castShadow = false;
  box(0.1, 12.8, 0.4, M.gold, 0, 0, -0.1, g);
  return g;
}

function makeSSD(M, label) {
  const g = new THREE.Group(); // length along x starting at 0 (connector end)
  box(8.0, 2.2, 0.08, M.pcbGreen, 4, 0, 0.04, g);
  box(1.1, 1.4, 0.13, M.plastic, 1.3, 0, 0.14, g);
  box(1.6, 1.6, 0.13, M.plastic, 3.3, 0, 0.14, g);
  box(1.6, 1.6, 0.13, M.plastic, 5.3, 0, 0.14, g);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.9), new THREE.MeshStandardMaterial({ map: textTex(["NVMe " + label, "PCIe 4.0 SSD"], { w: 512, h: 170, bg: "#1b1c22", size: 50 }), roughness: 0.5 }));
  sticker.position.set(4.3, 0, 0.215);
  g.add(sticker);
  box(0.5, 2.0, 0.06, M.gold, 0.25, 0, 0.04, g);
  return g;
}

function makeGPU(M, name, accent) {
  const g = new THREE.Group(); // length x (30), height y (12), thickness z (0..5), fans face +z
  const L = 30, H = 12;
  box(L, H, 0.3, M.backplate, 0, 0, 0.15, g, 0.1);
  box(L - 1, H - 1, 2.3, M.finBlock, 0, 0, 1.5, g);
  const sh = rrShape(L, H, 1);
  [-9.6, 0, 9.6].forEach((x) => {
    const hole = new THREE.Path();
    hole.absarc(x, 0, 4.5, 0, Math.PI * 2, true);
    sh.holes.push(hole);
  });
  const shroud = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, curveSegments: 40 }), M.shroud);
  shroud.position.z = 3.9;
  shroud.castShadow = shroud.receiveShadow = true;
  g.add(shroud);
  box(L - 0.6, H - 0.6, 1.4, M.shroudInner, 0, 0, 3.3, g);
  const fans = [-9.6, 0, 9.6].map((x) => {
    const f = makeFan(9.2, M, { frame: false, ring: false, blades: M.gpuBlade, count: 11 });
    f.position.set(x, 0, 4.1);
    g.add(f);
    return f;
  });
  // Accent light strip + logo on the top edge
  const strip = box(L - 6, 0.25, 0.6, M.glowBar, 1, H / 2 + 0.05, 4.4, g);
  strip.castShadow = false;
  const brand = name.replace(/^(NVIDIA|AMD)\s*/i, "").toUpperCase();
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshStandardMaterial({ map: textTex([brand], { w: 1024, h: 160, size: 92 }), transparent: true, emissive: 0xffffff, emissiveIntensity: 0 }));
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(-4, H / 2 + 0.01, 2.2);
  g.add(logo);
  const faceLogo = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.3), new THREE.MeshStandardMaterial({ map: textTex([brand], { w: 1024, h: 150, size: 92 }), transparent: true }));
  faceLogo.position.set(9, -H / 2 + 0.9, 4.96);
  g.add(faceLogo);
  // I/O bracket, PCIe fingers, power connector
  box(0.12, H + 0.6, 2.0, M.silver, -L / 2 - 0.1, 0.2, 1.0, g);
  box(8.5, 0.9, 0.12, M.gold, -7, -H / 2 - 0.4, 1.0, g);
  box(2.2, 0.7, 1.2, M.plastic, 7, H / 2 + 0.35, 1.6, g);
  g.userData = { fans, logo, accent };
  return g;
}

function makePump(M, accent) {
  const g = new THREE.Group(); // axis along z
  const body = cyl(3.4, 2.4, M.pumpBody, g, 48);
  body.rotation.x = Math.PI / 2;
  body.position.z = 1.2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.12, 12, 64), M.glow);
  rim.position.z = 2.4;
  g.add(rim);
  const off = pumpScreenTex(false, accent), on = pumpScreenTex(true, accent);
  const screen = new THREE.Mesh(new THREE.CircleGeometry(3.0, 64), new THREE.MeshBasicMaterial({ map: off, toneMapped: false }));
  screen.position.z = 2.42;
  g.add(screen);
  box(2.4, 2.0, 1.6, M.pumpBody, 0, 3.6, 1.4, g, 0.3); // tube port block on top
  g.userData = { screen, off, on };
  return g;
}

// ---------- case shells ----------
function makeCase(M, kind) {
  const g = new THREE.Group();
  const dims = kind === "hs420" ? { x: 22, y: 46, z: 14, tray: -6 } : { x: 21, y: 47, z: 11, tray: -9 };
  const { x: X, y: Y, z: Z } = dims;
  const t = 1.4;
  // Frame pillars + rails
  [-X + t / 2, X - t / 2].forEach((x) =>
    [-Z + t / 2, Z - t / 2].forEach((z) => box(t, Y, t, M.frame, x, Y / 2, z, g, 0.25))
  );
  box(2 * X, t * 1.3, 2 * Z, M.frame, 0, Y - (t * 1.3) / 2, 0, g, 0.35); // top
  box(2 * X, t, 2 * Z, M.frame, 0, t / 2, 0, g, 0.25); // bottom
  // Feet
  [[-X + 3, -Z + 3], [X - 3, -Z + 3], [-X + 3, Z - 3], [X - 3, Z - 3]].forEach(([x, z]) => {
    const f = cyl(1.2, 0.8, M.plastic, g, 24);
    f.position.set(x, -0.4, z);
  });
  // Back panel (solid), motherboard tray and rear wall
  box(2 * X - 2 * t, Y - 2 * t, 0.3, M.frameDark, 0, Y / 2, -Z + 0.3, g);
  box(2 * X - 2 * t, Y - 2 * t, 0.3, M.frameDark, 0, Y / 2, dims.tray, g);
  box(0.3, Y - 2 * t, 2 * Z - 2 * t, M.frameDark, -X + t, Y / 2, 0, g);
  // Rear exhaust fan
  const rear = makeFan(12, M);
  rear.rotation.y = -Math.PI / 2;
  rear.position.set(-X + t + 1.5, Y - 13, (dims.tray + Z) / 2);
  g.add(rear);

  const fans = [rear];
  if (kind === "hs420") {
    // Handle loop on the top rear corner (HAVN signature)
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 12, 32, Math.PI), M.frame);
    handle.position.set(-X + 4, Y, -Z + 3);
    handle.castShadow = true;
    g.add(handle);
    // Three angled intake fans in the floor
    [-13, 0, 13].forEach((x) => {
      const f = makeFan(12, M);
      f.rotation.x = -Math.PI / 2 + 0.28;
      f.position.set(x, 3.2, 4.5);
      g.add(f);
      fans.push(f);
    });
    // Glass shelf over the floor fans
    box(2 * X - 2 * t, 0.2, 10, M.glassShelf, 0, 6.1, 9, g);
  } else {
    // PSU shroud + PSU vents
    const shroud = box(2 * X - 2 * t - 3.5, 9.5, 2 * Z - 2 * t + 0.6 - (dims.tray + Z), M.frame, -1.75, t + 4.75, (dims.tray + Z) / 2 + 0.1, g, 0.3);
    const shroudLabel = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), new THREE.MeshStandardMaterial({ map: textTex([C.pcBuilds.find((b) => b.caseModel === "midtower")?.base.find((p) => p.type === "Case")?.name.replace(/[\[\]]/g, "") || "CASE"], { w: 1024, h: 140, size: 70, fg: "#8a8a94" }), transparent: true }));
    shroudLabel.position.set(4, t + 4.75, shroud.position.z + (2 * Z - 2 * t + 0.6 - (dims.tray + Z)) / 2 + 0.01);
    g.add(shroudLabel);
    // Three front intake fans
    [9.5, 21.5, 33.5].forEach((y) => {
      const f = makeFan(12, M);
      f.rotation.y = -Math.PI / 2;
      f.position.set(X - t - 1.5, y, 0);
      g.add(f);
      fans.push(f);
    });
  }

  // Glass: front panel and removable side panel
  const glassFront = box(0.4, Y - 2 * t, 2 * Z - 2 * t, M.glass, X - 0.4, Y / 2, 0, g);
  glassFront.castShadow = false;
  const side = new THREE.Group();
  const glassSide = box(2 * X - 0.4, Y - 0.4, 0.4, M.glass, 0, Y / 2, 0, side);
  glassSide.castShadow = false;
  side.position.z = Z - 0.2;
  g.add(side);

  // 360mm AIO radiator under the top panel
  const rad = new THREE.Group();
  const radY = Y - t * 1.3 - 1.4;
  box(39.5, 2.7, 12.2, M.gunmetal, 0, 0, 0, rad, 0.2);
  const finsBottom = new THREE.Mesh(new THREE.PlaneGeometry(36, 11.2), new THREE.MeshStandardMaterial({ map: finTex(), metalness: 0.7, roughness: 0.4 }));
  finsBottom.material.map.repeat.set(10, 1);
  finsBottom.rotation.x = Math.PI / 2;
  finsBottom.position.y = -1.36;
  rad.add(finsBottom);
  rad.position.set(-0.3, radY, (dims.tray + Z) / 2 + 0.5);
  g.add(rad);
  [-12.4, 0, 12.4].forEach((x) => {
    const f = makeFan(12, M);
    f.rotation.x = Math.PI / 2;
    f.position.set(x - 0.3, radY - 1.35 - 1.3, rad.position.z);
    g.add(f);
    fans.push(f);
  });

  g.userData = { dims, side, fans, radPort: new THREE.Vector3(18.5, radY - 0.4, rad.position.z + 4.5) };
  return g;
}

// ---------- one assembly scene ----------
function buildScene(canvas, build, n) {
  const accent = new THREE.Color(build.accent);
  const light = build.caseColor && new THREE.Color(build.caseColor).getHSL({}).l > 0.5;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = innerWidth >= 768;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const M = {
    frame: std(build.caseColor || 0x121216, 0.55, light ? 0.45 : 0.38),
    frameDark: std(light ? 0xd6d6dc : 0x0d0d10, 0.4, 0.6),
    gunmetal: std(0x2a2c32, 0.8, 0.32),
    silver: std(0xc8cbd2, 1, 0.25),
    gold: std(0xd8aa45, 1, 0.3),
    plastic: std(0x0f0f12, 0, 0.55),
    slot: std(0x3a3c44, 0, 0.5),
    pcb: std(0x16301f, 0.2, 0.55),
    pcbGreen: std(0x1c3d2b, 0.2, 0.5),
    substrate: std(0x24452e, 0.2, 0.5),
    ramSpreader: std(0x23252b, 0.85, 0.3),
    backplate: std(0x1a1b20, 0.8, 0.35),
    finBlock: new THREE.MeshStandardMaterial({ map: finTex(), metalness: 0.7, roughness: 0.4 }),
    shroud: std(build.caseModel === "hs420" ? 0x2d2f35 : 0x1d1d22, 0.75, 0.32),
    shroudInner: std(0x0b0b0d, 0.2, 0.7),
    gpuBlade: std(0x18181c, 0.1, 0.5),
    fanFrame: std(light ? 0xf2f2f5 : 0x18181c, 0.1, 0.5),
    fanHub: std(light ? 0xf5f5f8 : 0x202024, 0.1, 0.45),
    fanBlade: std(0xe6e7ec, 0, 0.4, { transparent: true, opacity: 0.88 }),
    pumpBody: std(0x18181c, 0.6, 0.35),
    glow: std(0xffffff, 0, 0.4, { emissive: accent, emissiveIntensity: 0 }),
    glowBar: std(0xdedee6, 0, 0.35, { emissive: accent, emissiveIntensity: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.07, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
    glassShelf: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
  };

  const root = new THREE.Group();
  scene.add(root);
  const pc = makeCase(M, build.caseModel);
  root.add(pc);
  const { dims, side, fans, radPort } = pc.userData;

  // Motherboard placement: rear I/O flush to the rear wall, top just under the radiator
  const mb = makeMotherboard(M, build.caseModel === "hs420" ? "Z790 AORUS" : "Z890 TUF");
  const boardTop = dims.y - 1.4 * 1.3 - 6.4;
  mb.position.set(-dims.x + 1.6 + 12.2, boardTop - 15.25, dims.tray + 0.2);
  root.add(mb);
  const B = mb.position, bz = B.z + mb.userData.Z;
  const sock = new THREE.Vector3(B.x - 3, B.y + 6.5, bz);

  // Cables: CPU 8-pin and 24-pin disappearing into the tray
  const cable = (pts, r = 0.45) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 10), M.plastic);
    m.castShadow = true;
    root.add(m);
    return m;
  };
  cable([new THREE.Vector3(B.x - 10.5, B.y + 14.8, bz + 0.6), new THREE.Vector3(B.x - 10.8, B.y + 15.6, bz + 1.4), new THREE.Vector3(B.x - 11.5, B.y + 16.2, bz - 0.5)], 0.35);
  cable([new THREE.Vector3(B.x + 11.9, B.y + 4.5, bz + 0.7), new THREE.Vector3(B.x + 13.6, B.y + 4.5, bz + 1.3), new THREE.Vector3(B.x + 14.8, B.y + 3.5, dims.tray - 0.2)], 0.7);

  // ----- parts that get installed -----
  const parts = {};
  const install = Object.fromEntries(build.install.map((p) => [p.key, p]));

  const cpu = makeCPU(M, install.cpu?.name || "");
  root.add(cpu);
  parts.cpu = { obj: cpu, to: { p: sock.clone().setZ(bz + 0.05), r: new THREE.Euler() }, from: { p: sock.clone().add(new THREE.Vector3(2, 16, 14)), r: new THREE.Euler(0.9, 0.4, 1.2) } };

  const pump = makePump(M, build.accent);
  root.add(pump);
  const pumpTo = { p: sock.clone().setZ(bz + 0.75), r: new THREE.Euler() };
  const pumpFrom = { p: sock.clone().add(new THREE.Vector3(10.5, -4, 10)), r: new THREE.Euler(0.5, -0.9, 0.4) };
  let tubes = [];
  const updateTubes = () => {
    tubes.forEach((t) => (root.remove(t), t.geometry.dispose()));
    tubes = [-0.7, 0.7].map((dy) => {
      const port = new THREE.Vector3(dy, 4.4, 1.4).applyMatrix4(pump.matrixWorld);
      const end = radPort.clone().add(new THREE.Vector3(0, 0, dy * 1.4));
      return cable([port, port.clone().add(new THREE.Vector3(dy, 3.5, 3)), end.clone().add(new THREE.Vector3(-8, -3, 1.5)), end], 0.55);
    });
  };

  const sticks = [1, 3].map((i) => {
    const s = makeRAM(M);
    root.add(s);
    const to = new THREE.Vector3(B.x + mb.userData.dimmX[i], B.y + 6.5, bz + 0.35);
    return { obj: s, to: { p: to, r: new THREE.Euler() }, from: { p: to.clone().add(new THREE.Vector3(1, 6, 20)), r: new THREE.Euler(-0.5, 0.3, 0.2) } };
  });

  const ssdPivot = new THREE.Group();
  const ssd = makeSSD(M, install.ssd?.short || "1TB");
  ssdPivot.add(ssd);
  root.add(ssdPivot);
  const ssdAt = new THREE.Vector3(B.x - 8.0, B.y - 1.5, bz + 0.3);
  parts.ssd = { obj: ssdPivot, to: { p: ssdAt, r: new THREE.Euler(0, 0, 0) }, mid: { p: ssdAt, r: new THREE.Euler(0, -0.42, 0) }, from: { p: ssdAt.clone().add(new THREE.Vector3(6, 5, 18)), r: new THREE.Euler(0.3, -0.42, 0.5) } };

  const gpu = makeGPU(M, install.gpu?.name || "", build.accent);
  root.add(gpu);
  let gpuTo;
  if (build.caseModel === "hs420") {
    // Vertical mount: card faces the glass, centred below the CPU
    gpuTo = { p: new THREE.Vector3(-2.5, B.y - 9.5, dims.tray + 4.5), r: new THREE.Euler() };
    box(1.2, 14, 6, M.frame, -18.6, B.y - 9.5, dims.tray + 3.5, root, 0.2); // vertical bracket
  } else {
    // Classic horizontal: card hangs from the PCIe x16 slot, fans facing down
    gpuTo = { p: new THREE.Vector3(B.x + 1.2, B.y - 4.3 - 0.6, bz + 1.1 + 6), r: new THREE.Euler(Math.PI / 2, 0, 0) };
  }
  parts.gpu = { obj: gpu, to: gpuTo, from: { p: gpuTo.p.clone().add(new THREE.Vector3(10, -6, 34)), r: new THREE.Euler(gpuTo.r.x + 0.35, -0.7, 0.15) } };
  const gpuCable = cable(
    build.caseModel === "hs420"
      ? [new THREE.Vector3(4.5, gpuTo.p.y + 6.6, gpuTo.p.z + 1.6), new THREE.Vector3(4.5, gpuTo.p.y + 8.5, gpuTo.p.z), new THREE.Vector3(6, gpuTo.p.y + 8, dims.tray - 0.2)]
      : [new THREE.Vector3(gpuTo.p.x + 7, gpuTo.p.y - 1.6, gpuTo.p.z + 6.4), new THREE.Vector3(gpuTo.p.x + 9, gpuTo.p.y + 1, gpuTo.p.z + 6), new THREE.Vector3(gpuTo.p.x + 12, gpuTo.p.y + 2, dims.tray - 0.2)],
    0.55
  );

  // Floor for soft contact shadows
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.8;
  floor.receiveShadow = true;
  root.add(floor);

  // Lighting
  scene.add(new THREE.HemisphereLight(0xc8ccff, 0x101016, 0.5));
  const key = new THREE.DirectionalLight(0xfff3e6, 2.2);
  key.position.set(40, 80, 60);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -45, right: 45, top: 60, bottom: -10, near: 10, far: 220 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 1.2);
  rim.position.set(-60, 40, -50);
  scene.add(rim);
  const inner = [new THREE.PointLight(accent, 0, 60, 1.6), new THREE.PointLight(accent, 0, 60, 1.6)];
  inner[0].position.set(0, dims.y - 10, 2);
  inner[1].position.set(0, 8, 4);
  inner.forEach((l) => scene.add(l));
  const work = new THREE.PointLight(0xffffff, 0, 70, 1.4); // build light while the glass is off
  work.position.set(10, 30, 30);
  scene.add(work);

  // Camera shots: [progress, target, direction, distance]
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 600);
  const center = new THREE.Vector3(0, dims.y / 2, 0);
  const D = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const ramC = new THREE.Vector3(B.x + 4.8, B.y + 6.5, bz);
  const ssdC = ssdAt.clone().add(new THREE.Vector3(4, 0, 0));
  const gpuC = gpuTo.p.clone().add(build.caseModel === "hs420" ? new THREE.Vector3(0, 0, 2) : new THREE.Vector3(0, -2.5, 3));
  const shots = [
    [0.0, center, D(0.55, 0.32, 1), 118],
    [0.08, center, D(0.35, 0.3, 1), 108],
    [0.13, sock, D(0.3, 0.35, 1), 40],
    [0.23, sock, D(0.15, 0.3, 1), 44],
    [0.29, ramC, D(-0.35, 0.3, 1), 40],
    [0.38, ramC, D(-0.25, 0.25, 1), 42],
    [0.44, ssdC, D(0.2, 0.45, 1), 30],
    [0.55, ssdC, D(0.05, 0.4, 1), 32],
    [0.61, gpuC, D(0.4, 0.2, 1), 62],
    [0.75, gpuC, D(0.25, 0.25, 1), 64],
    [0.86, center, D(0.45, 0.25, 1), 112],
    [1.0, center, D(0.85, 0.2, 1), 106],
  ];
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3(), tmpDir = new THREE.Vector3();
  function placeCamera(p, mx, my) {
    let i = 0;
    while (i < shots.length - 2 && p > shots[i + 1][0]) i++;
    const [p0, t0, d0, r0] = shots[i], [p1, t1, d1, r1] = shots[i + 1];
    const k = easeInOut(seg(p, p0, p1));
    camTarget.lerpVectors(t0, t1, k);
    tmpDir.lerpVectors(d0, d1, k).normalize();
    tmpDir.x += mx * 0.08;
    tmpDir.y += my * 0.05;
    camPos.copy(camTarget).addScaledVector(tmpDir.normalize(), r0 + (r1 - r0) * k);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function pose(obj, A, Bp, t) {
    obj.position.lerpVectors(A.p, Bp.p, t);
    qa.setFromEuler(A.r);
    qb.setFromEuler(Bp.r);
    obj.quaternion.slerpQuaternions(qa, qb, t);
  }
  const setVisible = (obj, v) => (obj.visible = v);

  // ----- per-frame state from scroll progress -----
  let lastPump = -1;
  let power = 0;
  function apply(p) {
    // Glass side panel slides off, then back on before power-up
    const off = easeInOut(seg(p, 0.02, 0.09)) * (1 - easeInOut(seg(p, 0.78, 0.85)));
    side.position.set(off * 55, off * 4, dims.z - 0.2 + off * 12);
    side.visible = off < 0.98;
    work.intensity = off * 900;

    // CPU into the socket, then the retention arm closes
    const tc = easeOut(seg(p, 0.1, 0.17));
    setVisible(cpu, tc > 0);
    pose(cpu, parts.cpu.from, parts.cpu.to, tc);
    mb.userData.lever.rotation.y = -1.3 * (1 - easeInOut(seg(p, 0.17, 0.19)));

    // AIO pump lifts from its parked spot onto the CPU
    const tp = easeInOut(seg(p, 0.19, 0.24));
    if (tp !== lastPump) {
      pose(pump, pumpFrom, pumpTo, tp);
      pump.updateMatrixWorld();
      updateTubes();
      lastPump = tp;
    }

    // RAM: two sticks, staggered, pushed straight down into A2/B2
    sticks.forEach((s, i) => {
      const t = seg(p, 0.28 + i * 0.04, 0.35 + i * 0.03);
      setVisible(s.obj, t > 0);
      const dropIn = { p: s.to.p.clone().add(new THREE.Vector3(0, 0, 3)), r: s.to.r };
      if (t < 0.75) pose(s.obj, s.from, dropIn, easeOut(t / 0.75));
      else pose(s.obj, dropIn, s.to, easeInOut((t - 0.75) / 0.25));
    });

    // M.2 SSD: slides into the connector at an angle, then gets pressed flat
    const ts = seg(p, 0.45, 0.56);
    setVisible(ssdPivot, ts > 0);
    if (ts < 0.65) pose(ssdPivot, parts.ssd.from, parts.ssd.mid, easeOut(ts / 0.65));
    else pose(ssdPivot, parts.ssd.mid, parts.ssd.to, easeInOut((ts - 0.65) / 0.35));

    // GPU
    const tg = easeOut(seg(p, 0.62, 0.74));
    setVisible(gpu, tg > 0);
    pose(gpu, parts.gpu.from, parts.gpu.to, tg);
    gpuCable.visible = p > 0.745;

    // Power on
    power = easeInOut(seg(p, 0.86, 0.93));
    M.glow.emissiveIntensity = power * 2.4;
    M.glowBar.emissiveIntensity = power * 2.0;
    gpu.userData.logo.material.emissiveIntensity = power * 0.8;
    inner.forEach((l) => (l.intensity = power * 260));
    const scr = pump.userData.screen.material;
    const want = power > 0.4 ? pump.userData.on : pump.userData.off;
    if (scr.map !== want) {
      scr.map = want;
      scr.needsUpdate = true;
    }
    scr.color.setScalar(0.3 + power * 0.9);
  }

  // ----- render loop -----
  let visible = false, raf = 0, last = performance.now(), mx = 0, my = 0, smx = 0, smy = 0, spin = 0;
  const allFans = [...fans, ...gpu.userData.fans];
  function frame() {
    raf = 0;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = reduce ? 1 : window.PC_PROGRESS?.[n] ?? 0;
    apply(p);
    spin += dt * (power * 26);
    allFans.forEach((f, i) => (f.userData.rotor.rotation.z = spin * (i % 2 ? 1 : 1.07)));
    smx += (mx - smx) * 0.05;
    smy += (my - smy) * 0.05;
    placeCamera(p, smx, smy);
    renderer.render(scene, camera);
    if (visible && !reduce) raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  const wrap = canvas.parentElement;
  const resize = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole case in frame on narrow screens
    camera.fov = w / h < 0.9 ? 40 : 28;
    camera.updateProjectionMatrix();
    kick();
  };
  new ResizeObserver(resize).observe(wrap);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  }).observe(wrap);
  wrap.addEventListener("pointermove", (e) => {
    const r = wrap.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    my = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  wrap.addEventListener("pointerleave", () => (mx = my = 0));
  resize();
  wrap.classList.add("ready");
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
  // Wait for fonts so the canvas-drawn labels use Space Grotesk / Inter
  document.fonts.ready.then(() =>
    document.querySelectorAll(".rig3d").forEach((canvas) => {
      const n = +canvas.dataset.build;
      buildScene(canvas, C.pcBuilds[n], n);
    })
  );
} else {
  document.querySelectorAll(".rig-wrap").forEach((w) => w.classList.add("no-webgl"));
}
