(() => {
  const C = window.CONTENT;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => innerWidth < 768;
  const lines = (arr) => arr.map((l) => `<span class="line"><span class="w">${esc(l)}</span></span>`).join("");
  const media = (item, tint, label) =>
    `<div class="media" style="--tint:${tint}">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name || item.title)}" loading="lazy">` : esc(label)}</div>`;

  // ---------- Text ----------
  document.title = `${C.name} · Portfolio`;
  $("#brand").textContent = C.name;
  $("#footer-name").textContent = C.name;
  $("#hero-title").innerHTML = lines(C.heroLines);
  $("#hero-intro").textContent = C.intro;
  $("#settle-title").innerHTML = lines(C.settleLines);
  $("#settle-intro").textContent = C.settleIntro;

  // ---------- Sections ----------
  $("#about-body").innerHTML = `
    <p class="about-bio" data-reveal>${esc(C.about.bio)}</p>
    <dl class="facts" data-reveal>${C.about.facts.map((f) => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join("")}</dl>`;

  $("#build-list").innerHTML = C.pcBuilds
    .map(
      (b, n) => `<article class="assembly" style="--accent-rig:${b.accent}">
        <div class="rig-wrap"><canvas class="rig3d" data-build="${n}"></canvas><p class="rig-fallback">3D needs WebGL — here's the parts list instead.</p><div class="callout"><i></i><b></b><span><small></small><em></em></span></div><span class="rig-hint">Move your mouse to look around</span></div>
        <div class="parts">
          <p class="eyebrow">Build 0${n + 1}</p>
          <h3>${esc(b.name)}</h3>
          <p class="note">${esc(b.note)}</p>
          <ul>
            ${b.base.map((p) => `<li class="part-row base"><span class="pt">${esc(p.type)}</span><span class="pn">${esc(p.name)}</span><span class="ps">In case</span></li>`).join("")}
            ${b.install.map((p) => `<li class="part-row add" data-key="${p.key}"><span class="pt">${esc(p.type)}</span><span class="pn">${esc(p.name)}</span><span class="ps"><i class="check"></i></span></li>`).join("")}
          </ul>
          <div class="meter"><span class="meter-label">Scroll to build</span><span class="meter-bar"><i></i></span></div>
        </div>
      </article>`
    )
    .join("");

  $("#web-list").innerHTML = C.webDesign
    .map(
      (w) => `<article class="web-item" data-reveal>
        <div class="browser glass-card"><div class="bar"><i></i><i></i><i></i></div>${media(w, "var(--t-web)", "Add screenshot")}</div>
        <div><h3>${esc(w.title)}</h3><p class="role">${esc(w.role)}</p>
          <div class="tags">${w.tools.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
          <a class="link" href="${esc(w.link)}" target="_blank" rel="noopener">Visit site ↗</a></div>
      </article>`
    )
    .join("");

  $("#project-grid").innerHTML = C.projects
    .map(
      (p) => `<a class="project glass-card" href="${esc(p.link)}" target="_blank" rel="noopener" data-reveal>
        <div class="media" style="--tint:var(--t-proj)"></div>
        <h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p>
        <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      </a>`
    )
    .join("");

  const d = C.drumming;
  $("#drum-layout").innerHTML = `
    <div class="glass-card" data-reveal>
      <div class="media drum-video" style="--tint:var(--t-drum)">
        ${
          !d.video
            ? `<div class="play" aria-label="Add a video"></div>`
            : /\.(mp4|webm|mov)$/i.test(d.video)
            ? `<video src="${esc(d.video)}" poster="${esc(d.poster || "")}" controls playsinline preload="none"></video>`
            : `<iframe src="${esc(d.video)}" title="Drumming video" allowfullscreen loading="lazy"></iframe>`
        }
      </div>
      ${d.videoTitle ? `<p class="video-title">${esc(d.videoTitle)}</p>` : ""}
    </div>
    <div class="drum-info" data-reveal>
      <p>${esc(d.blurb)}</p>
      <ul class="kit">${d.kit.map((k, i) => `<li>${esc(k)}<span>0${i + 1}</span></li>`).join("")}</ul>
    </div>`;

  $("#contact-email").textContent = C.email;
  $("#contact-email").href = `mailto:${C.email}`;
  $("#socials").innerHTML = C.socials.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join("");

  // ---------- 3D cards ----------
  const CATS = [
    { id: "builds", label: "PC Builds", tint: "var(--t-pc)", titles: C.pcBuilds.map((b) => b.name) },
    { id: "web", label: "Web Design", tint: "var(--t-web)", titles: C.webDesign.map((w) => w.title) },
    { id: "projects", label: "Projects", tint: "var(--t-proj)", titles: C.projects.map((p) => p.title) },
    { id: "drums", label: "Drumming", tint: "var(--t-drum)", titles: d.cardTitles },
  ];
  const stage = $("#stage");
  const plane = $("#plane");
  const N = isMobile() ? 24 : 32;
  const ROWS = Math.ceil(N / CATS.length);

  const cards = Array.from({ length: N }, (_, i) => {
    const c = i % CATS.length;
    const row = Math.floor(i / CATS.length);
    const cat = CATS[c];
    const el = document.createElement("div");
    el.className = "card";
    el.style.setProperty("--tint", cat.tint);
    el.innerHTML = `<span class="card-tag">${esc(cat.label)}</span><strong>${esc(cat.titles[row % cat.titles.length])}</strong><span class="card-lines"><i></i><i></i></span>`;
    stage.appendChild(el);
    return { el, i, c, row };
  });

  const labels = CATS.map((cat, c) => {
    const a = document.createElement("a");
    a.className = "col-label";
    a.href = `#${cat.id}`;
    a.innerHTML = `<b>0${c + 1}</b>${esc(cat.label)}`;
    stage.appendChild(a);
    return a;
  });

  const COL_W = 200, ROW_STEP = 30, SPACING = 21, GRID_GAP = 84;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (A, B, t) => ({ x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), z: lerp(A.z, B.z, t), rx: lerp(A.rx, B.rx, t), s: lerp(A.s, B.s, t) });

  // Stage 0: twisted ribbon — cards stacked along x, each rotated a bit further around the x-axis
  const helix = (k, ph) => ({ x: (k.i - (N - 1) / 2) * SPACING, y: Math.sin(k.i * 0.2 + ph * 0.02) * 60, z: 0, rx: k.i * 15 + ph, s: 1.15 });
  // Stage 1: flat loose grid lying on the plane
  const grid = (k) => {
    const per = 8, gr = Math.ceil(N / per);
    return { x: ((k.i % per) - (per - 1) / 2) * GRID_GAP, y: (Math.floor(k.i / per) - (gr - 1) / 2) * GRID_GAP * 0.75, z: 0, rx: 0, s: 0.5 };
  };
  // Stage 2: sorted into one stacked column per category
  const colTop = -(ROWS - 1) * ROW_STEP / 2 + 20;
  const column = (k) => ({ x: (k.c - (CATS.length - 1) / 2) * COL_W, y: colTop + k.row * ROW_STEP, z: k.row * 0.5, rx: 0, s: 0.62 });

  function layout() {
    const w = innerWidth, h = innerHeight;
    if (isMobile()) return { offX: 0, offY: h * 0.17, scale: Math.max(0.4, w / 880) };
    return { offX: w * (w < 1024 ? 0.2 : 0.16), offY: 0, scale: Math.min(1, w / 1400) };
  }

  const heroCopy = $("#hero-copy"), settleCopy = $("#settle-copy"), cue = $("#scroll-cue"), progress = $("#progress");
  let p = reduce ? 1 : 0;
  let ph = 0;
  let last = performance.now();

  function render() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const a = ease(clamp01(p / 0.3));
    const rawB = clamp01((p - 0.3) / 0.35);
    const b = ease(rawB);
    const c = ease(clamp01((p - 0.65) / 0.35));
    if (!reduce) ph += dt * 22 * (1 - a);

    for (const k of cards) {
      let S;
      if (rawB > 0) {
        const bk = ease(clamp01(rawB * 1.4 - (k.i / N) * 0.4));
        S = mix(grid(k), column(k), bk);
        S.z += Math.sin(bk * Math.PI) * 90; // arc up while flying to its column
      } else {
        S = mix(helix(k, ph), grid(k), a);
      }
      k.el.style.transform = `translate3d(${S.x}px,${S.y}px,${S.z}px) rotateX(${S.rx}deg) scale(${S.s})`;
    }

    labels.forEach((el, i) => {
      el.style.opacity = b;
      el.style.transform = `translate3d(${(i - (CATS.length - 1) / 2) * COL_W}px,${colTop - 72 - (1 - b) * 20}px,0)`;
    });

    const L = layout();
    const tilt = a * (1 - c);
    stage.style.transform = `translate3d(${L.offX}px,${L.offY}px,0) scale(${L.scale * lerp(1, 0.92, c)}) rotateX(${55 * tilt}deg) rotateZ(${-35 * tilt}deg)`;
    plane.style.opacity = a;
    plane.style.setProperty("--c", c);
    plane.classList.toggle("settled", c > 0.5);

    const h = ease(clamp01(p / 0.14));
    heroCopy.style.opacity = 1 - h;
    heroCopy.style.translate = `0 ${-h * 40}px`;
    heroCopy.style.pointerEvents = h > 0.5 ? "none" : "";
    cue.style.opacity = 1 - h;
    settleCopy.style.opacity = c;
    settleCopy.style.translate = `0 ${(1 - c) * 30}px`;

    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
  }

  // ---------- Scroll wiring ----------
  gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  if (!reduce) {
    ScrollTrigger.create({
      trigger: "#scene-wrap",
      start: "top top",
      end: () => "+=" + innerHeight * (isMobile() ? 2.2 : 3),
      pin: true,
      scrub: true,
      onUpdate: (s) => (p = s.progress),
    });

    gsap.from("#hero-copy .w", { yPercent: 110, duration: 1.1, stagger: 0.08, ease: "power4.out", delay: 0.1 });
    gsap.from("#hero-copy .eyebrow, #hero-intro, #hero-copy .btn", { opacity: 0, y: 20, duration: 0.9, stagger: 0.1, delay: 0.5 });

    gsap.utils.toArray("[data-reveal]").forEach((el) =>
      gsap.from(el, { y: 60, opacity: 0, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } })
    );
    gsap.utils.toArray(".media img, .browser .media").forEach((el) =>
      gsap.fromTo(el, { yPercent: -4 }, { yPercent: 4, ease: "none", scrollTrigger: { trigger: el, scrub: true } })
    );

    // PC assembly: pin each build while pc3d.js renders it from PC_PROGRESS
    const STEPS = { cpu: 0.24, ram: 0.38, ssd: 0.56, gpu: 0.76 };
    const ON = 0.9;
    window.PC_PROGRESS = [];
    document.querySelectorAll(".assembly").forEach((asm, n) => {
      const build = C.pcBuilds[n];
      const label = asm.querySelector(".meter-label");
      const bar = asm.querySelector(".meter-bar i");
      const rows = [...asm.querySelectorAll(".part-row.add")];
      ScrollTrigger.create({
        trigger: asm,
        start: "top top",
        end: () => "+=" + innerHeight * 5,
        pin: true,
        scrub: true,
        onUpdate: (s) => {
          const p = s.progress;
          window.PC_PROGRESS[n] = p;
          bar.style.width = `${p * 100}%`;
          let done = 0;
          rows.forEach((r) => {
            const ok = p >= STEPS[r.dataset.key];
            r.classList.toggle("done", ok);
            if (ok) done++;
          });
          const next = build.install.find((x) => p < STEPS[x.key]);
          label.textContent =
            p >= ON ? "Powered on ✓" : p < 0.08 ? "Scroll to build" : done === build.install.length ? "Closing it up…" : `${done}/${build.install.length} · Installing ${next.type}`;
        },
      });
    });
  } else {
    window.PC_PROGRESS = C.pcBuilds.map(() => 1);
    document.querySelectorAll(".part-row.add").forEach((r) => r.classList.add("done"));
  }

  gsap.ticker.add(render);
  render();

  // Fetch the 3D builds only after the page has loaded and the browser is idle
  const load3d = () => import("./pc3d.js");
  addEventListener("load", () => ("requestIdleCallback" in window ? requestIdleCallback(load3d, { timeout: 2500 }) : setTimeout(load3d, 1200)));

  // Anchor links go through Lenis so the scroll stays smooth
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: id === "#top" ? 0 : -40, duration: 1.4 });
    else if (target === 0) scrollTo({ top: 0 });
    else target.scrollIntoView();
  });
})();
