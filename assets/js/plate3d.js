/* Unique prints — 3D preview of the aluminium plate with the customer's photo (pure CSS 3D, no libraries) */
(function () {
  const RADIUS_MM = 3;      // rounded corners of the plate
  const EDGE_PX = 4;        // 0.5 mm is thinner than a pixel at screen scale, so the edge is drawn a little thicker
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function create(stage) {
    stage.innerHTML =
      '<div class="p3-shadow"></div>' +
      '<div class="p3-plate">' +
        '<div class="p3-face p3-front"><div class="p3-photo"></div><div class="p3-glare"></div></div>' +
        '<div class="p3-face p3-back"><div class="p3-backphoto" hidden></div><div class="p3-glare p3-backglare" hidden></div><div class="p3-mount"></div><div class="p3-stamp"><span class="brand-mark"><span>Unique</span><span>prints</span></span><small></small></div></div>' +
        '<div class="p3-face p3-edge p3-right"></div><div class="p3-face p3-edge p3-left"></div>' +
        '<div class="p3-face p3-edge p3-top"></div><div class="p3-face p3-edge p3-bottom"></div>' +
      "</div>";
    const q = (s) => stage.querySelector(s);
    const el = { plate: q(".p3-plate"), front: q(".p3-front"), back: q(".p3-back"), photo: q(".p3-photo"), glare: q(".p3-glare"),
      shadow: q(".p3-shadow"), stamp: q(".p3-stamp small"), stampBox: q(".p3-stamp"), mount: q(".p3-mount"), backphoto: q(".p3-backphoto"), backglare: q(".p3-backglare"),
      right: q(".p3-right"), left: q(".p3-left"), top: q(".p3-top"), bottom: q(".p3-bottom") };

    const st = { base: -24, rx: -8, ry: -24, vx: 0, vy: 0, W: 0, H: 0, idle: !reduceMotion, t0: performance.now(), anim: null, dims: null };

    function size(mmW, mmH, label) {
      st.dims = { mmW, mmH, label };
      // fit by the diagonal, so no corner leaves the stage whichever way the plate is turned
      const room = Math.max(200, Math.min(stage.clientWidth, stage.clientHeight)) * 0.8;
      const s = room / Math.hypot(mmW, mmH);
      const W = Math.round(mmW * s), H = Math.round(mmH * s), T = EDGE_PX, r = Math.max(2, Math.round(RADIUS_MM * s));
      st.W = W; st.H = H;
      el.plate.style.width = W + "px"; el.plate.style.height = H + "px";
      el.plate.style.marginLeft = -W / 2 + "px"; el.plate.style.marginTop = -H / 2 + "px";
      el.front.style.cssText = "width:" + W + "px;height:" + H + "px;border-radius:" + r + "px;transform:translateZ(" + T / 2 + "px)";
      el.back.style.cssText = "width:" + W + "px;height:" + H + "px;border-radius:" + r + "px;transform:rotateY(180deg) translateZ(" + T / 2 + "px)";
      el.right.style.cssText = "width:" + T + "px;height:" + (H - 2 * r) + "px;left:" + (W - T) / 2 + "px;top:" + r + "px;transform:rotateY(90deg) translateZ(" + W / 2 + "px)";
      el.left.style.cssText = "width:" + T + "px;height:" + (H - 2 * r) + "px;left:" + (W - T) / 2 + "px;top:" + r + "px;transform:rotateY(-90deg) translateZ(" + W / 2 + "px)";
      el.top.style.cssText = "width:" + (W - 2 * r) + "px;height:" + T + "px;left:" + r + "px;top:" + (H - T) / 2 + "px;transform:rotateX(90deg) translateZ(" + H / 2 + "px)";
      el.bottom.style.cssText = "width:" + (W - 2 * r) + "px;height:" + T + "px;left:" + r + "px;top:" + (H - T) / 2 + "px;transform:rotateX(-90deg) translateZ(" + H / 2 + "px)";
      el.stamp.textContent = label;
      el.mount.hidden = backIsPhoto || (mmW < 90 && mmH < 90); // no wall bracket on the pocket-size card or a printed back
      render();
    }

    function paint(target, url, crop) {
      target.style.backgroundImage = "url('" + url + "')";
      target.style.backgroundSize = (100 / crop.w) + "% " + (100 / crop.h) + "%";
      const px = crop.w < 0.9999 ? (crop.x / (1 - crop.w)) * 100 : 0;
      const py = crop.h < 0.9999 ? (crop.y / (1 - crop.h)) * 100 : 0;
      target.style.backgroundPosition = px + "% " + py + "%";
    }
    function image(url, crop) { if (url && crop) paint(el.photo, url, crop); }
    let backIsPhoto = false;
    function backImage(url, crop) {
      backIsPhoto = !!(url && crop);
      el.backphoto.hidden = !backIsPhoto; el.backglare.hidden = !backIsPhoto;
      el.stampBox.hidden = backIsPhoto;
      el.mount.hidden = backIsPhoto || (st.dims && st.dims.mmW < 90 && st.dims.mmH < 90);
      if (backIsPhoto) paint(el.backphoto, url, crop);
    }

    function render() {
      el.plate.style.transform = "rotateX(" + st.rx + "deg) rotateY(" + st.ry + "deg)";
      const ry = ((st.ry % 360) + 360) % 360, rad = (ry * Math.PI) / 180, cosY = Math.cos(rad), cosX = Math.cos((st.rx * Math.PI) / 180);
      // light comes from the upper left: the photo dims as it turns away, a soft glare slides across the metal
      const facing = cosY * cosX; // > 0: front faces the viewer, < 0: back does
      el.photo.style.filter = "brightness(" + (0.78 + 0.22 * Math.max(0, facing)).toFixed(3) + ")";
      el.glare.style.backgroundPosition = (50 - Math.sin(rad) * 70 + st.rx * 0.6).toFixed(1) + "% 0";
      el.back.style.filter = "brightness(" + (0.8 + 0.2 * Math.max(0, -facing)).toFixed(3) + ")";
      el.backglare.style.backgroundPosition = (50 + Math.sin(rad) * 70 + st.rx * 0.6).toFixed(1) + "% 0";
      const spread = Math.abs(cosY) * Math.abs(cosX) * 0.75 + 0.25;
      el.shadow.style.width = Math.round(st.W * 0.85 * spread + 30) + "px";
      el.shadow.style.top = "calc(50% + " + Math.round(st.H / 2 + 26) + "px)";
    }

    function loop(now) {
      if (st.anim) {
        const k = Math.min(1, (now - st.anim.t0) / st.anim.dur), e = 1 - Math.pow(1 - k, 3);
        st.rx = st.anim.fx + (st.anim.tx - st.anim.fx) * e; st.ry = st.anim.fy + (st.anim.ty - st.anim.fy) * e;
        if (k >= 1) st.anim = null;
      } else if (!drag && (Math.abs(st.vx) > 0.02 || Math.abs(st.vy) > 0.02)) {
        st.ry += st.vy; st.rx = clampX(st.rx + st.vx); st.vx *= 0.93; st.vy *= 0.93;
      } else if (st.idle && !drag) {
        st.ry = st.base + Math.sin((now - st.t0) / 1700) * 20;
      }
      render();
      requestAnimationFrame(loop);
    }
    const clampX = (v) => v; // no limits: the plate turns freely in every direction
    const baseX = () => Math.round(st.rx / 360) * 360 - 8;
    function tween(tx, ty, dur) { st.idle = false; st.anim = { fx: st.rx, fy: st.ry, tx, ty, t0: performance.now(), dur: dur || 700 }; }

    // drag to rotate
    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // stop the browser from starting a text selection or dragging selected text instead of turning the plate
      e.preventDefault();
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
      stage.focus({ preventScroll: true }); // keep arrow keys working after a click
      st.idle = false; st.anim = null;
      drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      stage.classList.add("grabbing");
    });
    stage.addEventListener("dragstart", (e) => e.preventDefault());
    stage.addEventListener("selectstart", (e) => e.preventDefault());
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      // when the plate is tipped upside down, horizontal dragging has to turn the other way to feel natural
      const flipH = Math.cos((st.rx * Math.PI) / 180) < 0 ? -1 : 1;
      st.ry += dx * 0.55 * flipH; st.rx -= dy * 0.5;
      st.vy = dx * 0.55 * flipH; st.vx = -dy * 0.5;
      drag.lx = e.clientX; drag.ly = e.clientY;
    });
    const end = () => { drag = null; stage.classList.remove("grabbing"); };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener("lostpointercapture", end);
    stage.addEventListener("keydown", (e) => {
      const step = 15;
      if (e.key === "ArrowLeft") tween(st.rx, st.ry - step, 250);
      else if (e.key === "ArrowRight") tween(st.rx, st.ry + step, 250);
      else if (e.key === "ArrowUp") tween(clampX(st.rx + step), st.ry, 250);
      else if (e.key === "ArrowDown") tween(clampX(st.rx - step), st.ry, 250);
      else return;
      e.preventDefault();
    });
    window.addEventListener("resize", () => { if (st.dims) size(st.dims.mmW, st.dims.mmH, st.dims.label); });

    render();
    requestAnimationFrame(loop);

    return {
      size, image,
      showBack() { const k = Math.round((st.ry - 180) / 360); tween(baseX(), k * 360 + 180 - 24, 800); },
      showFront() { const k = Math.round(st.ry / 360); tween(baseX(), k * 360 - 24, 800); },
      backImage,
      flip() { tween(st.rx, Math.round(st.ry / 180) * 180 + 180, 900); },
      reset() { const base = Math.round((st.ry + 24) / 360) * 360 - 24; tween(baseX(), base, 700); setTimeout(() => { if (!reduceMotion && !drag && !st.anim) { st.base = base; st.idle = true; st.t0 = performance.now(); } }, 720); },
    };
  }

  window.UPPlate3D = { create };
})();
