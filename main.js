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
  $("#hero-tag").textContent = C.heroTag;
  $("#hero-name").innerHTML = lines(C.heroName);
  $("#hero-intro").textContent = C.intro;
  $("#hero-stats").innerHTML = C.heroStats.map((s) => `<div><dt>${esc(s.v)}</dt><dd>${esc(s.k)}</dd></div>`).join("");
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

  // ---------- Hero: rotating role word ----------
  const roleEl = $("#role-word");
  const ROLE_COLORS = ["var(--n-purple)", "var(--n-cyan)", "var(--n-pink)"];
  let roleI = 0;
  const showRole = () => {
    roleEl.textContent = C.roles[roleI % C.roles.length];
    roleEl.style.setProperty("--neon", ROLE_COLORS[roleI % ROLE_COLORS.length]);
    if (!reduce) gsap.fromTo(roleEl, { opacity: 0, yPercent: 60, filter: "blur(6px)" }, { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 0.55, ease: "back.out(1.6)" });
    roleI++;
  };
  showRole();
  if (!reduce) setInterval(showRole, 2200);

  // ---------- Hero: floating cards of real work ----------
  const rig = C.pcBuilds[0], mom = C.pcBuilds[1], site = C.webDesign[0];
  const part = (b, k, f = "name") => b?.install.find((p) => p.key === k)?.[f] || "";
  const plays = (C.about.facts.find((f) => f.k === "Plays")?.v || "").split("·").map((x) => x.trim()).filter(Boolean);
  const eq = Array.from({ length: 16 }, (_, i) => `<i style="animation-duration:${(0.45 + ((i * 37) % 9) / 14).toFixed(2)}s;animation-delay:-${((i * 53) % 10) / 10}s"></i>`).join("");
  const HERO = [
    {
      key: "web", href: "#web", neon: "var(--n-cyan)", w: 320,
      float: [-30, -150, 60, 10, -22, -3],
      html: `<div class="hc-head"><span>Web · Live</span><i class="live"></i></div>
        <div class="hc-browser"><div class="bar"><i></i><i></i><i></i><span>${esc(site?.link.replace(/^https?:\/\//, ""))}</span></div>${site?.image ? `<img src="${esc(site.image)}" alt="${esc(site.title)}">` : ""}</div>
        <strong>${esc(site?.title)}</strong>`,
    },
    {
      key: "rig", href: "#builds", neon: "var(--n-purple)", w: 270,
      float: [200, 0, 140, -8, -26, 2],
      html: `<div class="hc-head"><span>PC Build 01</span><i class="live"></i></div>
        <strong>${esc(rig?.name)}</strong>
        <ul class="hc-specs"><li><b>CPU</b>${esc(part(rig, "cpu"))}</li><li><b>GPU</b>${esc(part(rig, "gpu"))}</li><li><b>RAM</b>${esc(part(rig, "ram"))}</li></ul>
        <svg class="spark" viewBox="0 0 200 44" preserveAspectRatio="none"><path class="spark-fill" d="M0 44 L0 30 C20 26 30 32 45 24 S70 10 90 18 S120 34 140 20 S175 8 200 14 L200 44 Z"/><path class="spark-line" d="M0 30 C20 26 30 32 45 24 S70 10 90 18 S120 34 140 20 S175 8 200 14"/></svg>
        <span class="hc-foot">${esc(rig?.base.find((p) => p.type === "Case")?.name)}</span>`,
    },
    {
      key: "drums", href: "#drums", neon: "var(--n-pink)", w: 250,
      float: [-180, 130, 90, 12, 18, 3],
      html: `<div class="hc-head"><span>Drums</span><i class="live"></i></div>
        <div class="hc-video">${d.poster ? `<img src="${esc(d.poster)}" alt="">` : ""}<span class="hc-play"></span></div>
        <div class="eq">${eq}</div>
        <strong>${esc(d.videoTitle || "Drumming")}</strong>`,
    },
    {
      key: "mom", href: "#builds", neon: "var(--n-red)", w: 220,
      float: [270, -210, -80, 14, -30, 5],
      html: `<div class="hc-head"><span>PC Build 02</span></div>
        <strong>${esc(mom?.name)}</strong>
        <p class="hc-sub">${esc(part(mom, "gpu", "short"))} · ${esc(part(mom, "cpu", "short"))}</p>`,
    },
    {
      key: "sports", href: "#about", neon: "var(--n-green)", w: 230,
      float: [70, 230, -30, -14, 12, -5],
      html: `<div class="hc-head"><span>Off the desk</span></div>
        <div class="chips">${plays.map((x) => `<span>${esc(x)}</span>`).join("")}</div>`,
    },
  ];
  // Settled bento: left column (web, drums), right column (rig, mom, sports)
  const COLS = [["web", "drums"], ["rig", "mom", "sports"]];
  const stage = $("#stage");
  const cards = HERO.map((c, i) => {
    const el = document.createElement("a");
    el.className = "hcard";
    el.href = c.href;
    el.style.setProperty("--neon", c.neon);
    el.style.width = c.w + "px";
    el.innerHTML = c.html;
    stage.appendChild(el);
    return { ...c, el, i, settle: [0, 0] };
  });
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));

  const GAP = 18;
  let bentoW = 600;
  function measureSettle() {
    const colW = COLS.map((col) => Math.max(...col.map((k) => byKey[k].w)));
    bentoW = colW[0] + colW[1] + GAP;
    const shift = (colW[0] - colW[1]) / 2; // centre the two columns as a whole
    COLS.forEach((col, ci) => {
      const hs = col.map((k) => byKey[k].el.offsetHeight);
      const total = hs.reduce((a, b) => a + b, 0) + GAP * (col.length - 1);
      let y = -total / 2;
      const x = (ci === 0 ? -(colW[0] / 2 + GAP / 2) : colW[1] / 2 + GAP / 2) + shift;
      col.forEach((k, j) => {
        byKey[k].settle = [x, y + hs[j] / 2];
        y += hs[j] + GAP;
      });
    });
  }
  measureSettle();
  addEventListener("resize", measureSettle);

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  function layout() {
    const w = innerWidth, h = innerHeight;
    if (isMobile()) return { offX: 0, offY: h * 0.24, scale: Math.min(0.55, w / 700), settleScale: Math.min(0.62, (w - 28) / bentoW) };
    return { offX: w * (w < 1100 ? 0.2 : 0.2), offY: 20, scale: Math.min(1, w / 1450), settleScale: Math.min(0.92, w / 1500) };
  }

  const heroCopy = $("#hero-copy"), settleCopy = $("#settle-copy"), cue = $("#scroll-cue"), progress = $("#progress"), grid = $("#grid-plane");
  let p = reduce ? 1 : 0;
  let t = 0, mx = 0, my = 0, smx = 0, smy = 0;
  let last = performance.now();
  addEventListener("pointermove", (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  });

  function render() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduce) t += dt;
    smx += (mx - smx) * 0.06;
    smy += (my - smy) * 0.06;

    const L = layout();
    const free = 1 - ease(clamp01(p / 0.75)); // 1 = floating, 0 = settled
    for (const c of cards) {
      const k = ease(clamp01(p * 1.25 - c.i * 0.05));
      const [fx, fy, fz, frx, fry, frz] = c.float;
      const bob = Math.sin(t * 0.9 + c.i * 1.7) * 10 * free;
      const x = lerp(fx, c.settle[0], k), y = lerp(fy, c.settle[1], k) + bob, z = lerp(fz, 0, k);
      const rx = lerp(frx, 0, k) + Math.sin(t * 0.6 + c.i) * 2 * free;
      const ry = lerp(fry, 0, k) + Math.cos(t * 0.5 + c.i) * 3 * free;
      const rz = lerp(frz, 0, k);
      c.el.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) translate(-50%,-50%)`;
    }
    const sc = lerp(L.scale, L.settleScale, 1 - free);
    stage.style.transform = `translate3d(${L.offX}px,${L.offY}px,0) scale(${sc}) rotateY(${smx * 8 * free}deg) rotateX(${-smy * 5 * free}deg)`;

    const h = ease(clamp01(p / 0.22));
    heroCopy.style.opacity = 1 - h;
    heroCopy.style.translate = `0 ${-h * 40}px`;
    heroCopy.style.pointerEvents = h > 0.5 ? "none" : "";
    cue.style.opacity = 1 - h;
    const c = ease(clamp01((p - 0.6) / 0.4));
    settleCopy.style.opacity = c;
    settleCopy.style.translate = `0 ${(1 - c) * 30}px`;
    grid.style.setProperty("--shift", `${p * 240}px`);

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
      end: () => "+=" + innerHeight * (isMobile() ? 1.4 : 1.8),
      pin: true,
      scrub: true,
      onUpdate: (s) => (p = s.progress),
    });

    gsap.from("#hero-copy .w", { yPercent: 110, duration: 1.1, stagger: 0.08, ease: "power4.out", delay: 0.1 });
    gsap.from("#hero-copy .eyebrow, #hero-copy .hero-role, #hero-intro, #hero-copy .hero-ctas, #hero-stats", { opacity: 0, y: 20, duration: 0.9, stagger: 0.1, delay: 0.45 });
    gsap.from(".hcard", { opacity: 0, duration: 1.2, stagger: 0.08, ease: "power3.out", delay: 0.3 });

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
