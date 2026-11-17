/* Unique prints — 3D preview of the 11 oz ceramic mug with the customer's picture (pure CSS 3D, no libraries).
   The picture wraps around the mug from one side of the handle to the other. */
(function () {
  // real mug in millimetres
  const R = 41;          // outer radius (82 mm across)
  const HB = 95;         // height
  const WALL = 3.5;      // wall thickness, seen at the rim
  const FLOOR = 9;       // inside bottom sits this far above the base
  const N = 120;         // facets around the body (shaded smoothly, so they don't show as ribs)
  const OV = 1;          // each facet overlaps its neighbours by this many px, so no seams show
  const HANDLE = { up: 31, out: 27, width: 11, thick: 7.5, seg: 24 };
  const C = 2 * Math.PI * R;
  const LIGHT = -38;     // light comes from the front left (degrees around the mug)
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function create(stage) {
    stage.innerHTML = '<div class="m3-shadow"></div><div class="m3-mug"></div>';
    const mug = stage.querySelector(".m3-mug"), shadow = stage.querySelector(".m3-shadow");
    const st = { rx: -16, ry: -72, base: -72, vx: 0, vy: 0, idle: !reduceMotion, t0: performance.now(), anim: null,
      k: 1, printW: 230, printH: 90, url: null, crop: null, strips: [], inner: [], handle: [], handleAt: 180 };

    // ---------- build ----------
    function size(mmW, mmH) {
      const pw = mmW || st.printW, ph = mmH || st.printH;
      const room = Math.max(220, Math.min(stage.clientWidth * 0.62, stage.clientHeight * 0.95));
      const k = room / (2 * R + HANDLE.out + 40); // px per mm, leaves space for the handle when it points sideways
      if (st.built && pw === st.printW && ph === st.printH && Math.abs(k - st.k) < 1e-6) return; // nothing changed
      st.printW = pw; st.printH = ph; st.k = k; st.built = true;
      const px = (mm) => mm * k;
      const step = 360 / N, sw = C / N; // facet angle and width (mm)
      const printDeg = Math.min(359, (st.printW / C) * 360);
      st.handleAt = 180; // handle sits in the gap opposite the middle of the picture
      const top = (HB - st.printH) / 2;
      let html = "";
      st.strips = []; st.inner = []; st.handle = [];
      for (let i = 0; i < N; i++) {
        const a = i * step - 180 + step / 2;          // centre angle of the facet, picture is centred at 0
        const s0 = ((a - step / 2 + printDeg / 2) / 360) * C, s1 = s0 + sw; // arc position along the picture (mm)
        const p0 = Math.max(0, s0), p1 = Math.min(st.printW, s1);
        // the picture runs into the overlap on the sides where it continues on the next facet
        const extL = p0 > s0 ? 0 : OV, extR = p1 < s1 ? 0 : OV;
        const pr = p1 > p0 ? '<div class="m3-print" data-p0="' + p0 + '" data-ext="' + extL + '" style="left:' + (OV + px(p0 - s0) - extL) + "px;width:" + (px(p1 - p0) + extL + extR) + "px;top:" + px(top) + "px;height:" + px(st.printH) + 'px"></div>' : "";
        html += '<div class="m3-face m3-strip" style="width:' + (px(sw) + 2 * OV) + "px;height:" + px(HB) + "px;margin-left:" + -(px(sw) / 2 + OV) + "px;margin-top:" + -px(HB) / 2 + "px;transform:rotateY(" + a + "deg) translateZ(" + px(R) + 'px)">' +
          pr + '<div class="m3-shade"></div><div class="m3-spec"></div></div>';
        st.strips.push(a);
      }
      // inside wall: only the far half faces the viewer, seen over the rim
      const ri = R - WALL, swi = (2 * Math.PI * ri) / N, hi = HB - FLOOR;
      for (let i = 0; i < N; i++) {
        const a = i * step;
        html += '<div class="m3-face m3-inner" style="width:' + (px(swi) + 2 * OV) + "px;height:" + px(hi) + "px;margin-left:" + -(px(swi) / 2 + OV) + "px;margin-top:" + -px(HB) / 2 + "px;transform:rotateY(" + a + "deg) translateZ(" + px(ri) + 'px) rotateY(180deg)"><div class="m3-shade"></div></div>';
        st.inner.push(a);
      }
      // inside bottom and the rim (both face up)
      html += '<div class="m3-disc m3-floor" style="width:' + px(2 * ri) + "px;height:" + px(2 * ri) + "px;margin:" + -px(ri) + "px 0 0 " + -px(ri) + "px;transform:translateY(" + px(HB / 2 - FLOOR) + 'px) rotateX(90deg)"></div>';
      html += '<div class="m3-disc m3-rim" style="width:' + px(2 * R) + "px;height:" + px(2 * R) + "px;margin:" + -px(R) + "px 0 0 " + -px(R) + "px;border-width:" + px(WALL) + "px;transform:translateY(" + -px(HB / 2) + 'px) rotateX(90deg)"></div>';
      // handle: a rounded "D" built from short box segments
      html += '<div class="m3-handle" style="transform:rotateY(' + st.handleAt + "deg) translateZ(" + px(R - 2.5) + 'px)">';
      const M = HANDLE.seg, pts = [];
      for (let j = 0; j <= M; j++) {
        const t = -Math.PI / 2 + (Math.PI * j) / M;
        // slightly squared ellipse so the grip is straighter in the middle
        const c = Math.cos(t), s = Math.sin(t);
        pts.push({ z: HANDLE.out * Math.sign(c) * Math.pow(Math.abs(c), 0.75), y: HANDLE.up * s });
      }
      for (let j = 0; j < M; j++) {
        const a = pts[j], b = pts[j + 1];
        const zm = (a.z + b.z) / 2, ym = (a.y + b.y) / 2, dz = b.z - a.z, dy = b.y - a.y;
        const L = Math.hypot(dz, dy), phi = (Math.atan2(dz, dy) * 180) / Math.PI;
        const W = HANDLE.width, T = HANDLE.thick, h = px(L) + px(T) * 0.5 + 2; // long enough to close the wedge gaps on the outer curve
        const face = (w, tf, kind) => '<div class="m3-face m3-hface m3-h' + kind + '" style="width:' + px(w) + "px;height:" + h + "px;margin-left:" + -px(w) / 2 + "px;margin-top:" + -h / 2 + "px;transform:" + tf + '"><div class="m3-shade"></div></div>';
        html += '<div class="m3-hseg" style="transform:translateY(' + px(ym) + "px) translateZ(" + px(zm) + "px) rotateX(" + phi + 'deg)">' +
          face(W, "translateZ(" + px(T / 2) + "px)", "out") +
          face(W, "translateZ(" + -px(T / 2) + "px) rotateY(180deg)", "in") +
          face(T, "translateX(" + -px(W / 2) + "px) rotateY(-90deg)", "l") +
          face(T, "translateX(" + px(W / 2) + "px) rotateY(90deg)", "r") +
          "</div>";
      }
      html += "</div>";
      mug.innerHTML = html;
      st.stripEls = [...mug.querySelectorAll(".m3-strip")];
      st.innerEls = [...mug.querySelectorAll(".m3-inner")];
      st.hEls = [...mug.querySelectorAll(".m3-hface")];
      shadow.style.width = px(2 * R + 30) + "px";
      shadow.style.top = "calc(50% + " + (px(HB / 2) + 4) + "px)";
      paint();
      render();
    }

    // ---------- picture ----------
    function paint() {
      if (!st.url || !st.crop) return;
      const k = st.k, Pw = st.printW * k, Ph = st.printH * k;
      const fullW = Pw / st.crop.w, fullH = Ph / st.crop.h;
      const ox = st.crop.x * fullW, oy = st.crop.y * fullH;
      mug.querySelectorAll(".m3-print").forEach((el) => {
        const p0 = Number(el.dataset.p0) * k - Number(el.dataset.ext);
        el.style.backgroundImage = "url('" + st.url + "')";
        el.style.backgroundSize = fullW + "px " + fullH + "px";
        el.style.backgroundPosition = -(ox + p0) + "px " + -oy + "px";
      });
    }
    function image(url, crop) { if (!url || !crop) return; st.url = url; st.crop = crop; paint(); }

    // ---------- light and shadow ----------
    const rad = (d) => (d * Math.PI) / 180;
    function render() {
      mug.style.transform = "rotateX(" + st.rx + "deg) rotateY(" + st.ry + "deg)";
      const lit = (yaw) => Math.cos(rad(yaw - LIGHT));
      const half = 180 / N;
      // each facet gets a gradient from the tone at its left edge to the tone at its right edge,
      // so neighbouring facets meet with the same tone and the body reads as one smooth curve
      const shadeA = (yaw) => 0.5 * Math.pow(1 - Math.max(0, lit(yaw)), 1.3) + 0.04;
      const specA = (yaw) => Math.pow(Math.max(0, Math.cos(rad(yaw + 14))), 40) * 0.2;
      const grad = (rgb, a, b) => "linear-gradient(90deg,rgba(" + rgb + "," + a.toFixed(3) + "),rgba(" + rgb + "," + b.toFixed(3) + "))";
      const set = (el, v) => { if (el.__bg !== v) { el.style.backgroundImage = v; el.__bg = v; } };
      if (st.stripEls) st.stripEls.forEach((el, i) => {
        const yaw = st.strips[i] + st.ry;
        if (Math.cos(rad(yaw)) < -0.3) return; // facing away, hidden anyway
        const n = el.children.length;
        set(el.children[n - 2], grad("27,24,19", shadeA(yaw - half), shadeA(yaw + half)));
        set(el.children[n - 1], grad("255,255,255", specA(yaw - half), specA(yaw + half)));
      });
      const innerA = (yaw) => 0.18 + 0.32 * (1 - Math.max(0, lit(yaw)));
      if (st.innerEls) st.innerEls.forEach((el, i) => {
        const yaw = st.inner[i] + 180 + st.ry;
        if (Math.cos(rad(yaw)) < -0.3) return;
        set(el.firstChild, grad("27,24,19", innerA(yaw + half), innerA(yaw - half))); // turned around: left edge is the later angle
      });
      if (st.hEls) {
        const hy = st.handleAt + st.ry;
        st.hEls.forEach((el) => {
          const cls = el.classList;
          const yaw = cls.contains("m3-hl") ? hy - 90 : cls.contains("m3-hr") ? hy + 90 : cls.contains("m3-hin") ? hy + 180 : hy;
          el.firstChild.style.opacity = (0.06 + 0.42 * (1 - Math.max(0, lit(yaw)))).toFixed(3);
        });
      }
    }

    // ---------- motion ----------
    const clampX = (v) => Math.max(-42, Math.min(14, v));
    function loop(now) {
      if (!stage.isConnected) return; // the studio switched to another product
      if (st.anim) {
        const k = Math.min(1, (now - st.anim.t0) / st.anim.dur), e = 1 - Math.pow(1 - k, 3);
        st.rx = st.anim.fx + (st.anim.tx - st.anim.fx) * e; st.ry = st.anim.fy + (st.anim.ty - st.anim.fy) * e;
        if (k >= 1) st.anim = null;
      } else if (!drag && (Math.abs(st.vx) > 0.02 || Math.abs(st.vy) > 0.02)) {
        st.ry += st.vy; st.rx = clampX(st.rx + st.vx); st.vx *= 0.93; st.vy *= 0.93;
      } else if (st.idle && !drag) {
        st.ry = st.base + Math.sin((now - st.t0) / 1900) * 28;
      }
      render();
      requestAnimationFrame(loop);
    }
    function tween(tx, ty, dur) { st.idle = false; st.anim = { fx: st.rx, fy: st.ry, tx: clampX(tx), ty, t0: performance.now(), dur: dur || 700 }; }

    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault(); // no text selection or dragging of selected text while turning the mug
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
      stage.focus({ preventScroll: true });
      st.idle = false; st.anim = null;
      drag = { lx: e.clientX, ly: e.clientY };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      stage.classList.add("grabbing");
    });
    stage.addEventListener("dragstart", (e) => e.preventDefault());
    stage.addEventListener("selectstart", (e) => e.preventDefault());
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      st.ry += dx * 0.55; st.rx = clampX(st.rx - dy * 0.35);
      st.vy = dx * 0.55; st.vx = -dy * 0.35;
      drag.lx = e.clientX; drag.ly = e.clientY;
    });
    const end = () => { drag = null; stage.classList.remove("grabbing"); };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener("lostpointercapture", end);
    stage.addEventListener("keydown", (e) => {
      const stp = 15;
      if (e.key === "ArrowLeft") tween(st.rx, st.ry - stp, 250);
      else if (e.key === "ArrowRight") tween(st.rx, st.ry + stp, 250);
      else if (e.key === "ArrowUp") tween(st.rx + stp, st.ry, 250);
      else if (e.key === "ArrowDown") tween(st.rx - stp, st.ry, 250);
      else return;
      e.preventDefault();
    });
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (stage.isConnected) size(); }, 120); });

    size();
    requestAnimationFrame(loop);

    const homeY = () => Math.round((st.ry - st.base) / 360) * 360 + st.base;
    return {
      kind: "mug",
      size,
      image,
      backImage() {},
      showFront() { tween(-16, homeY(), 800); },
      showBack() { tween(-16, homeY() + 180, 800); },
      flip() { tween(st.rx, st.ry + 180, 900); },
      reset() {
        const base = homeY(); tween(-16, base, 700);
        setTimeout(() => { if (!reduceMotion && !drag && !st.anim) { st.base = base; st.idle = true; st.t0 = performance.now(); } }, 720);
      },
    };
  }

  window.UPMug3D = { create };
})();
