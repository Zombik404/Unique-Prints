/* Unique prints — photo studio: upload, crop, size, quality, optional back side, 3D preview, add to cart */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-icon]").forEach((el) => { el.outerHTML = UP.ICONS[el.getAttribute("data-icon")]; });

  const MAX_BYTES = 20 * 1024 * 1024;
  const MIN_LONG = 1920, MIN_SHORT = 1080; // minimum photo size in pixels (either orientation)
  const TYPES = ["image/jpeg", "image/png", "image/webp"];
  const cat = await UP.catalogue();
  const sizes = cat.sizes;
  const BACK_PERCENT = typeof cat.backPercent === "number" ? cat.backPercent : 50; // back side costs this % of the format price
  const params = new URLSearchParams(location.search);

  const newSide = () => ({ file: null, url: null, iw: 0, ih: 0, zoom: 1, cx: 0.5, cy: 0.5, uploaded: null, img: null });
  const typeOf = (id) => ((sizes.find((s) => s.id === id) || {}).type === "mug" ? "mug" : "plate");
  const hasMug = sizes.some((s) => s.type === "mug");
  const S = {
    size: sizes.find((s) => s.id === params.get("size")) ? params.get("size") : "A4",
    orientation: null, qty: 1, frameW: 0, frameH: 0, lastPlate: "A4", plateOrientation: null,
    sides: { front: newSide(), back: newSide() }, active: "front", backOn: false,
  };
  const side = (k) => S.sides[k || S.active];

  // 3D preview: the plate or the mug, swapped when the product changes
  let p3 = null;
  function ensure3d() {
    const want = typeOf(S.size);
    const mod = want === "mug" ? window.UPMug3D : window.UPPlate3D;
    if (!mod || (p3 && p3.kind === want)) return;
    let stage = $("p3-stage");
    if (p3) { const fresh = stage.cloneNode(false); stage.replaceWith(fresh); stage = fresh; } // drops the old model and its listeners
    p3 = mod.create(stage);
    p3.kind = want;
    const hint = $("p3-hint"), flip = $("p3-flip");
    hint.setAttribute("data-i18n", want === "mug" ? "cr.3dHintMug" : "cr.3dHint"); hint.textContent = UP.t(hint.getAttribute("data-i18n"));
    flip.setAttribute("data-i18n", want === "mug" ? "cr.3dTurn" : "cr.3dFlip"); flip.textContent = UP.t(flip.getAttribute("data-i18n"));
  }
  $("p3-flip").addEventListener("click", () => p3 && p3.flip());
  $("p3-reset").addEventListener("click", () => p3 && p3.reset());

  const sizeById = (id) => sizes.find((s) => s.id === id);
  const cents = (n) => Math.round(n * 100);
  const backCents = (id) => Math.round(cents(sizeById(id).price) * BACK_PERCENT / 100);
  const unitCents = (id) => cents(sizeById(id).price) + (S.backOn ? backCents(id) : 0);
  function printDims(sizeId, orientation) {
    const s = sizeById(sizeId);
    let w = s.w, h = s.h;
    const portrait = h >= w;
    if ((orientation === "landscape" && portrait) || (orientation === "portrait" && !portrait)) { const x = w; w = h; h = x; }
    return { w, h };
  }
  function defaultOrientation(sizeId) {
    if (typeOf(sizeId) === "mug") return "landscape"; // the picture wraps around the mug
    const f = side("front");
    if (sizeId === "CR80") return f.iw >= f.ih ? "landscape" : "portrait";
    return f.iw > f.ih ? "landscape" : "portrait";
  }

  // ---------- file handling ----------
  function showError(boxId, text) { const e = $(boxId); e.textContent = text; e.hidden = false; }
  function loadFile(file, which) {
    const errBox = which === "front" && !side("front").url ? "pick-error" : "side-error";
    $("pick-error").hidden = true; $("side-error").hidden = true;
    if (!file) return;
    if (!TYPES.includes(file.type)) return showError(errBox, UP.t("err.type"));
    if (file.size > MAX_BYTES) return showError(errBox, UP.t("err.big"));
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth, h = im.naturalHeight;
      if (Math.max(w, h) < MIN_LONG || Math.min(w, h) < MIN_SHORT) {
        URL.revokeObjectURL(url);
        showError(errBox, UP.t("err.small", { w, h }));
        if (errBox === "pick-error") $("pick").scrollIntoView({ block: "center" });
        return;
      }
      const sd = side(which);
      if (sd.url) URL.revokeObjectURL(sd.url);
      Object.assign(sd, { file, url, iw: w, ih: h, zoom: 1, cx: 0.5, cy: 0.5, uploaded: null, img: im });
      $("add-error").hidden = true;
      if (which === "front" && !S.orientation) S.orientation = defaultOrientation(S.size);
      S.active = which;
      $("pick").hidden = true; $("studio").hidden = false;
      layout();
      if (p3 && which === "back") p3.showBack();
      if (p3 && which === "front") p3.showFront();
    };
    im.onerror = () => { URL.revokeObjectURL(url); showError(errBox, UP.t("err.read")); };
    im.src = url;
  }
  $("file").addEventListener("change", (e) => { loadFile(e.target.files[0], "front"); e.target.value = ""; });
  $("file2").addEventListener("change", (e) => { loadFile(e.target.files[0], S.active); e.target.value = ""; });
  $("file-back").addEventListener("change", (e) => { loadFile(e.target.files[0], "back"); e.target.value = ""; });
  [[$("dropzone"), "front"], [$("back-drop"), "back"]].forEach(([dz, which]) => {
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0], which));
  });

  // ---------- crop geometry (per side) ----------
  function geometry(sd, frameW, frameH) {
    const base = Math.max(frameW / sd.iw, frameH / sd.ih);
    const scale = base * sd.zoom;
    const cw = frameW / scale, ch = frameH / scale; // crop in image px
    let left = sd.cx * sd.iw - cw / 2, top = sd.cy * sd.ih - ch / 2;
    left = Math.min(Math.max(0, left), sd.iw - cw);
    top = Math.min(Math.max(0, top), sd.ih - ch);
    return { scale, cw, ch, left, top };
  }
  function cropFor(sd, sizeId, orientation) {
    const d = printDims(sizeId, orientation);
    const fw = 1000, fh = 1000 * d.h / d.w;
    const g = geometry(sd, fw, fh);
    return { x: g.left / sd.iw, y: g.top / sd.ih, w: g.cw / sd.iw, h: g.ch / sd.ih, pxW: g.cw, pxH: g.ch, mmW: d.w, mmH: d.h };
  }
  function dpiFor(sd, sizeId, orientation) {
    const c = cropFor(sd, sizeId, orientation);
    return Math.round(c.pxW / (c.mmW / 25.4));
  }
  function qualityOf(dpi) { return dpi >= 240 ? "great" : dpi >= 150 ? "good" : "low"; }

  function layout() {
    if (!side("front").url) return;
    // tabs and the back-side upload area
    $("side-tabs").hidden = !S.backOn;
    $("side-tabs").querySelectorAll("[data-side]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-side") === S.active));
    const sd = side();
    const empty = !sd.url;
    $("frame").hidden = empty; $("back-drop").hidden = !empty; $("crop-tools").hidden = empty;
    const d = printDims(S.size, S.orientation);
    const mug = typeOf(S.size) === "mug";
    $("product-block").hidden = !hasMug;
    $("product").querySelectorAll("[data-p]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-p") === (mug ? "mug" : "plate")));
    $("orient-block").hidden = mug; $("back-block").hidden = mug;
    ensure3d();
    if (p3) {
      p3.size(d.w, d.h, S.size + " · " + d.w + " × " + d.h + " mm · 0,5 mm");
      $("p3-dims").textContent = mug ? UP.t("mug.name") + " · " + UP.t("mug.area", { w: d.w, h: d.h }) : S.size + " · " + d.w + " × " + d.h + " mm";
    }
    if (!empty) {
      $("photo").src = sd.url;
      $("zoom").value = sd.zoom;
      $("photo-info").textContent = (S.backOn ? UP.t(S.active === "front" ? "cr.front" : "cr.back") + " · " : "") + sd.file.name + " · " + UP.t("cr.photoInfo", { w: sd.iw, h: sd.ih });
      const wrap = $("crop-wrap");
      const maxW = wrap.clientWidth - 48, maxH = Math.min(520, Math.max(300, window.innerHeight * 0.62));
      const r = d.w / d.h;
      const fw = Math.min(maxW, maxH * r), fh = fw / r;
      S.frameW = Math.round(fw); S.frameH = Math.round(fh);
      $("frame").style.width = S.frameW + "px"; $("frame").style.height = S.frameH + "px";
    }
    draw();
    renderPanel();
  }
  function draw() {
    const sd = side();
    if (sd.url) {
      const g = geometry(sd, S.frameW, S.frameH);
      sd.cx = (g.left + g.cw / 2) / sd.iw; sd.cy = (g.top + g.ch / 2) / sd.ih; // keep the clamped centre
      const img = $("photo");
      img.style.width = sd.iw + "px"; img.style.height = sd.ih + "px";
      img.style.transform = "translate(" + (-g.left * g.scale) + "px," + (-g.top * g.scale) + "px) scale(" + g.scale + ")";
    }
    update3d();
  }
  function update3d() {
    if (!p3) return;
    const f = side("front"), b = side("back");
    if (f.url) p3.image(f.url, cropFor(f, S.size, S.orientation));
    if (S.backOn && b.url) p3.backImage(b.url, cropFor(b, S.size, S.orientation)); else p3.backImage(null);
  }

  // drag the photo inside the frame
  const frame = $("frame");
  let drag = null;
  frame.addEventListener("pointerdown", (e) => {
    const sd = side();
    drag = { x: e.clientX, y: e.clientY, cx: sd.cx, cy: sd.cy };
    frame.setPointerCapture(e.pointerId); frame.classList.add("dragging");
  });
  frame.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const sd = side();
    const g = geometry(sd, S.frameW, S.frameH);
    sd.cx = drag.cx - (e.clientX - drag.x) / g.scale / sd.iw;
    sd.cy = drag.cy - (e.clientY - drag.y) / g.scale / sd.ih;
    draw();
  });
  const endDrag = () => { if (drag) { drag = null; frame.classList.remove("dragging"); renderPanel(); } };
  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);
  frame.addEventListener("wheel", (e) => {
    e.preventDefault();
    const sd = side();
    sd.zoom = Math.min(4, Math.max(1, sd.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
    $("zoom").value = sd.zoom; draw(); renderPanel();
  }, { passive: false });
  $("zoom").addEventListener("input", (e) => { side().zoom = Number(e.target.value); draw(); renderPanel(); });
  window.addEventListener("resize", () => layout());

  // side tabs
  $("side-tabs").querySelectorAll("[data-side]").forEach((b) => b.addEventListener("click", () => {
    S.active = b.getAttribute("data-side");
    $("side-error").hidden = true;
    layout();
    if (p3) S.active === "back" ? p3.showBack() : p3.showFront();
  }));

  // second side on/off
  $("back-on").addEventListener("change", (e) => {
    S.backOn = e.target.checked;
    $("add-error").hidden = true; $("side-error").hidden = true;
    if (S.backOn) { S.active = "back"; if (p3) p3.showBack(); }
    else { S.active = "front"; if (p3) p3.showFront(); }
    layout();
  });

  // ---------- side panel ----------
  function renderPanel() {
    const f = side("front");
    if (!f.url) return;
    const prod = typeOf(S.size);
    $("sizes").innerHTML = sizes.filter((s) => typeOf(s.id) === prod).map((s) => {
      const isMug = prod === "mug";
      const q = qualityOf(dpiFor(f, s.id, isMug ? "landscape" : S.orientation));
      return '<button type="button" class="size-opt' + (isMug ? " size-mug" : "") + (s.id === S.size ? " active" : "") + '" data-size="' + s.id + '">' +
        '<span class="id">' + (isMug ? UP.t("mug.short") : s.id) + '</span><span><span class="dims">' + (isMug ? UP.t("mug.area", { w: s.w, h: s.h }) : s.w + " × " + s.h + " mm") + "</span> " +
        '<span class="badge q-' + q + '" style="margin-left:.35rem">' + UP.t("q." + q) + "</span></span>" +
        '<span class="text-primary">' + UP.formatEUR(s.price) + "</span></button>";
    }).join("");
    $("sizes").querySelectorAll("[data-size]").forEach((b) => b.addEventListener("click", () => {
      S.size = b.getAttribute("data-size");
      layout();
      history.replaceState(null, "", "?size=" + S.size);
    }));
    $("orient").querySelectorAll("[data-o]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-o") === S.orientation));
    $("back-price").textContent = UP.t("cr.backPrice", { price: UP.formatEUR(backCents(S.size) / 100) });

    const qLine = (sd, label) => {
      const dpi = dpiFor(sd, S.size, S.orientation), q = qualityOf(dpi);
      return '<div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">' + (label ? '<span class="small" style="min-width:6.5rem">' + label + "</span>" : "") +
        '<span class="badge q-' + q + '">' + UP.t("q." + q) + '</span> <span class="muted small">' + UP.t("cr.dpi", { dpi }) + "</span></div>";
    };
    const b = side("back");
    const qhtml = S.backOn ? qLine(f, UP.t("cr.front")) + (b.url ? qLine(b, UP.t("cr.back")) : "") : qLine(f);
    const anyLow = qualityOf(dpiFor(f, S.size, S.orientation)) === "low" || (S.backOn && b.url && qualityOf(dpiFor(b, S.size, S.orientation)) === "low");
    $("quality").innerHTML = '<div class="stack" style="gap:.45rem">' + qhtml + "</div>" + (anyLow ? '<p class="alert" style="margin-top:.75rem">' + UP.t("q.lowHint") + "</p>" : "");

    $("price").textContent = UP.formatEUR(unitCents(S.size) * S.qty / 100);
    $("price-note").textContent = S.backOn
      ? UP.t("cr.priceBreak", { front: UP.formatEUR(sizeById(S.size).price), back: UP.formatEUR(backCents(S.size) / 100) }) + (S.qty > 1 ? " · × " + S.qty : "")
      : "";
  }
  $("orient").querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => { S.orientation = b.getAttribute("data-o"); layout(); }));
  // product: aluminium plate or mug
  $("product").querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => {
    const want = b.getAttribute("data-p");
    if (want === typeOf(S.size)) return;
    if (want === "mug") {
      S.lastPlate = S.size; S.plateOrientation = S.orientation;
      S.size = (sizes.find((s) => typeOf(s.id) === "mug") || {}).id;
      S.orientation = "landscape";
      S.backOn = false; $("back-on").checked = false; S.active = "front";
    } else {
      S.size = S.lastPlate || "A4";
      S.orientation = S.plateOrientation || defaultOrientation(S.size);
    }
    $("add-error").hidden = true; $("side-error").hidden = true;
    history.replaceState(null, "", "?size=" + S.size);
    layout();
  }));
  const setQty = (n) => { S.qty = Math.min(50, Math.max(1, Math.round(Number(n) || 1))); $("qty").value = S.qty; renderPanel(); };
  $("qminus").addEventListener("click", () => setQty(S.qty - 1));
  $("qplus").addEventListener("click", () => setQty(S.qty + 1));
  $("qty").addEventListener("change", (e) => setQty(e.target.value));
  document.addEventListener("up:lang", () => layout());

  // ---------- thumbnail of a chosen crop ----------
  function makeThumb(sd, crop) {
    const maxSide = 420;
    const r = crop.mmW / crop.mmH;
    const w = r >= 1 ? maxSide : Math.round(maxSide * r), h = r >= 1 ? Math.round(maxSide / r) : maxSide;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sd.img, crop.x * sd.iw, crop.y * sd.ih, crop.w * sd.iw, crop.h * sd.ih, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.82);
  }

  // ---------- upload originals ----------
  function upload(sd, label) {
    const fileKey = sd.file.name + ":" + sd.file.size + ":" + sd.file.lastModified;
    if (sd.uploaded && sd.uploaded.fileKey === fileKey) return Promise.resolve(sd.uploaded);
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("photo", sd.file, sd.file.name);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", UP.API + "?action=upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) $("add").innerHTML = '<span class="spinner"></span> ' + (label ? label + " · " : "") + UP.t("cr.adding") + " " + Math.round((e.loaded / e.total) * 100) + "%";
      };
      xhr.onload = () => {
        let d = null; try { d = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status === 200 && d && d.id) { sd.uploaded = { fileKey, id: d.id, token: d.token }; resolve(sd.uploaded); }
        else reject(new Error((d && d.error) || "upload"));
      };
      xhr.onerror = () => reject(new Error("upload"));
      xhr.send(fd);
    });
  }

  $("add").addEventListener("click", async () => {
    const btn = $("add"), err = $("add-error");
    err.hidden = true;
    const f = side("front"), b = side("back");
    if (S.backOn && !b.url) {
      err.textContent = UP.t("cr.backMissing"); err.hidden = false;
      S.active = "back"; layout(); if (p3) p3.showBack();
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> ' + UP.t("cr.adding");
    try {
      const two = S.backOn && !!b.url;
      const upF = await upload(f, two ? UP.t("cr.front") : "");
      const upB = two ? await upload(b, UP.t("cr.back")) : null;
      const cf = cropFor(f, S.size, S.orientation);
      const round = (c) => ({ x: +c.x.toFixed(5), y: +c.y.toFixed(5), w: +c.w.toFixed(5), h: +c.h.toFixed(5) });
      const item = {
        key: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
        photoId: upF.id, photoToken: upF.token, fileName: f.file.name,
        size: S.size, orientation: S.orientation, qty: S.qty,
        crop: round(cf), imgW: f.iw, imgH: f.ih, dpi: dpiFor(f, S.size, S.orientation),
        thumb: makeThumb(f, cf),
      };
      if (two) {
        const cb = cropFor(b, S.size, S.orientation);
        item.back = { photoId: upB.id, photoToken: upB.token, fileName: b.file.name, crop: round(cb), dpi: dpiFor(b, S.size, S.orientation), thumb: makeThumb(b, cb) };
      }
      const cart = UP.getCart(); cart.push(item); UP.saveCart(cart);
      UP.toast(UP.ICONS.check.replace("<svg", '<svg width="18" height="18" style="color:var(--primary)"') + "<span>" + UP.t("cr.added") + '</span><a class="btn btn-sm btn-primary" href="cart.html">' + UP.t("cr.viewCart") + "</a>", 5000);
    } catch (e) {
      const k = e && e.message;
      err.textContent = k && k !== "upload" && UP.t(k) !== k ? UP.t(k) : UP.t("err.upload");
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span data-i18n="cr.add">' + UP.t("cr.add") + "</span>";
    }
  });
});
