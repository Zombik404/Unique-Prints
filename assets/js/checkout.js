/* Unique prints — checkout */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const t = UP.t, esc = UP.esc;
  const cat = await UP.catalogue();
  const sizes = cat.sizes;
  const shipping = cat.shipping || { countries: {}, defaultCarriers: ["DPD", "DHL", "UPS", "GLS"] };
  const price = (i) => UP.unitPrice(i, cat);

  if (!UP.getCart().length) { $("empty").hidden = false; UP.applyI18n(); return; }
  $("form").hidden = false;

  const state = { carrier: "", delivery: "home" };
  const DRAFT = "up.checkout";
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || "{}"); ["name", "email", "phone", "street", "city", "postal", "pickupName", "pickupAddress", "comment"].forEach((k) => { if (d[k]) $(k).value = d[k]; }); if (d.delivery) state.delivery = d.delivery; if (d.carrier) state.carrier = d.carrier; window.__draftCountry = d.country; } catch (e) {}

  function countryName(code) {
    try { return new Intl.DisplayNames([UP.lang === "uk" ? "uk" : UP.lang], { type: "region" }).of(code); } catch (e) { return code; }
  }
  function renderCountries() {
    const sel = $("country");
    const cur = sel.value || window.__draftCountry || "";
    const codes = Object.keys(shipping.countries).filter((c) => (shipping.countries[c] || []).length);
    codes.sort((a, b) => countryName(a).localeCompare(countryName(b), UP.lang));
    sel.innerHTML = '<option value="">' + t("co.choose") + "</option>" + codes.map((c) => '<option value="' + c + '"' + (c === cur ? " selected" : "") + ">" + esc(countryName(c)) + "</option>").join("");
  }
  function renderCarriers() {
    const c = $("country").value;
    const list = c ? shipping.countries[c] || [] : shipping.defaultCarriers;
    if (!list.includes(state.carrier)) state.carrier = "";
    $("carriers").innerHTML = list.map((name) => '<button type="button" data-c="' + name + '" class="' + (name === state.carrier ? "active" : "") + '">' + name + "</button>").join("");
    $("carriers").querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => { state.carrier = b.getAttribute("data-c"); renderCarriers(); saveDraft(); }));
  }
  function renderDelivery() {
    $("delivery").querySelectorAll("[data-d]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-d") === state.delivery));
    $("pickup-fields").hidden = state.delivery !== "pickup";
  }
  $("delivery").querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => { state.delivery = b.getAttribute("data-d"); renderDelivery(); saveDraft(); }));
  $("country").addEventListener("change", () => { renderCarriers(); saveDraft(); });

  function renderSummary() {
    const cart = UP.getCart();
    const subtotal = cart.reduce((a, i) => a + price(i) * i.qty, 0);
    $("summary").innerHTML =
      cart.map((i) => '<div class="summary-line"><span style="display:flex;gap:.6rem;align-items:center"><img src="' + esc(i.thumb) + '" alt="" style="width:36px;height:36px;object-fit:contain;background:var(--secondary)"><span>' + esc(i.size) + " × " + i.qty + (i.back ? ' <span class="two-sided">' + t("cart.twoSided") + "</span>" : "") + "</span></span><span>" + UP.formatEUR(price(i) * i.qty) + "</span></div>").join("") +
      '<div class="summary-line total"><span>' + t("cart.subtotal") + "</span><span>" + UP.formatEUR(subtotal) + "</span></div>" +
      (UP.isConverted() ? '<div class="summary-line"><span class="muted small">' + t("fx.payEUR") + '</span><span class="small">' + UP.formatPaid(subtotal) + "</span></div>" : "") +
      '<div class="summary-line"><span class="muted">' + t("cart.shipping") + '</span><span class="muted small">' + t("cart.shippingTbd") + "</span></div>";
  }

  function saveDraft() {
    const d = { delivery: state.delivery, carrier: state.carrier, country: $("country").value };
    ["name", "email", "phone", "street", "city", "postal", "pickupName", "pickupAddress", "comment"].forEach((k) => (d[k] = $(k).value));
    try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) {}
  }
  $("form").addEventListener("input", saveDraft);

  function renderAll() { renderCountries(); renderCarriers(); renderDelivery(); renderSummary(); }
  renderAll();
  document.addEventListener("up:lang", renderAll);

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("form-error"); err.hidden = true;
    const required = ["name", "email", "phone", "street", "city", "postal", "country"].concat(state.delivery === "pickup" ? ["pickupName", "pickupAddress"] : []);
    let bad = false;
    document.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    required.forEach((k) => { if (!$(k).value.trim()) { $(k).classList.add("invalid"); bad = true; } });
    if (!state.carrier) bad = true;
    if (bad) { err.textContent = t("co.required"); err.hidden = false; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("email").value.trim())) { $("email").classList.add("invalid"); err.textContent = t("co.emailInvalid"); err.hidden = false; return; }

    const btn = $("submit"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + t("co.placing");
    const payload = {
      lang: UP.lang,
      customer: { name: $("name").value.trim(), email: $("email").value.trim(), phone: $("phone").value.trim() },
      address: { street: $("street").value.trim(), city: $("city").value.trim(), postal: $("postal").value.trim(), country: $("country").value },
      shipping: { carrier: state.carrier, delivery: state.delivery, pickupName: $("pickupName").value.trim(), pickupAddress: $("pickupAddress").value.trim() },
      comment: $("comment").value.trim(),
      items: UP.getCart().map((i) => ({ photoId: i.photoId, photoToken: i.photoToken, fileName: i.fileName, size: i.size, orientation: i.orientation, qty: i.qty, crop: i.crop, dpi: i.dpi, thumb: i.thumb,
        back: i.back ? { photoId: i.back.photoId, photoToken: i.back.photoToken, fileName: i.back.fileName, crop: i.back.crop, dpi: i.back.dpi, thumb: i.back.thumb } : null })),
    };
    try {
      const r = await fetch(UP.API + "?action=order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.number) throw new Error(d.error || "err.generic");
      const orders = JSON.parse(localStorage.getItem("up.orders") || "[]");
      orders.unshift({ number: d.number, token: d.token, at: Date.now() });
      localStorage.setItem("up.orders", JSON.stringify(orders.slice(0, 20)));
      UP.saveCart([]);
      localStorage.removeItem(DRAFT);
      location.href = "order.html#" + encodeURIComponent(d.number) + "." + d.token;
    } catch (ex) {
      err.textContent = ex.message && ex.message.indexOf(" ") > -1 ? ex.message : t(ex.message || "err.generic");
      err.hidden = false; btn.disabled = false; btn.textContent = t("co.place");
    }
  });
});
