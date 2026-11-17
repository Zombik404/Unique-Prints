/* Unique prints — shared site logic: language, layout, catalogue, cart */
(function () {
  const LS_LANG = "up.lang", LS_CART = "up.cart";
  const API = "api/index.php";

  // Fallback catalogue (the live prices always come from the server, api/config.php)
  const FALLBACK_SIZES = [
    { id: "A3", w: 297, h: 420, price: 40.0 },
    { id: "A4", w: 210, h: 297, price: 29.0 },
    { id: "A5", w: 148, h: 210, price: 20.0 },
    { id: "A6", w: 105, h: 148, price: 15.0 },
    { id: "CR80", w: 85.6, h: 53.98, price: 2.99 },
  ];

  // Images: put your own files in assets/img/. If they are missing, the original ones are used.
  const IMG = {
    banner: ["assets/img/hero-banner.jpg"], // background of the big block at the top of the home page
    hero: ["assets/img/hero.jpg", "https://uniqueprints.lovable.app/assets/unique-prints-hero-D92j5fPa.jpg"],
    detail: ["assets/img/detail.webp"],
  };

  const ICONS = {
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  };

  // ---------- language ----------
  function detectLang() {
    try { const s = localStorage.getItem(LS_LANG); if (s && window.UP_DICT[s]) return s; } catch (e) {}
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (nav === "ua") return "uk";
    return window.UP_DICT[nav] ? nav : "en";
  }
  let lang = detectLang();
  function t(key, vars) {
    let s = (window.UP_DICT[lang] && window.UP_DICT[lang][key]) || window.UP_DICT.en[key] || key;
    if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
    return s;
  }
  function setLang(l) {
    if (!window.UP_DICT[l]) return;
    lang = l;
    try { localStorage.setItem(LS_LANG, l); } catch (e) {}
    document.documentElement.lang = l === "uk" ? "uk" : l;
    applyI18n();
    renderHeader();
    document.dispatchEvent(new CustomEvent("up:lang", { detail: l }));
  }
  function applyI18n(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    (root || document).querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
  }

  // ---------- money ----------
  // Prices live in EUR. Each language shows them converted at the server's daily rate
  // (api/config.php → display_currencies). Orders and payment stay in EUR: use formatPaid for that.
  const LOCALES = { en: "en-US", hu: "hu-HU", de: "de-DE", uk: "uk-UA", ru: "ru-RU" };
  const WHOLE = { HUF: true, UAH: true, RUB: true }; // shown without cents
  let FX = null; // { currencies: {lang: code}, rates: {code: 1 EUR = x}, date }
  function displayCurrency() {
    const c = FX && FX.currencies && FX.currencies[lang];
    return c && c !== "EUR" && FX.rates && FX.rates[c] > 0 ? c : "EUR";
  }
  function fmt(n, cur, digits) {
    const loc = cur === "EUR" ? (lang === "en" ? "en-IE" : LOCALES[lang] || lang) : LOCALES[lang] || "en-US";
    try { return new Intl.NumberFormat(loc, { style: "currency", currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(n)); }
    catch (e) { return Number(n).toFixed(digits) + " " + cur; }
  }
  function formatPaid(n) { return fmt(n, "EUR", 2); }
  function formatEUR(n) {
    const c = displayCurrency();
    if (c === "EUR") return formatPaid(n);
    return fmt(Number(n) * FX.rates[c], c, WHOLE[c] ? 0 : 2);
  }
  function isConverted() { return displayCurrency() !== "EUR"; }
  function renderFx() {
    const c = displayCurrency();
    let text = "", title = "";
    if (c !== "EUR") {
      text = "1 € = " + fmt(FX.rates[c], c, 2);
      title = t("fx.title") + (FX.date ? " · " + new Date(FX.date * 1000).toLocaleDateString(LOCALES[lang] || lang) : "");
    }
    document.querySelectorAll("[data-fx]").forEach((el) => { el.textContent = text; el.title = title; el.hidden = !text; });
  }

  // ---------- catalogue ----------
  let cataloguePromise = null;
  function catalogue() {
    if (!cataloguePromise) {
      cataloguePromise = fetch(API + "?action=catalogue", { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => (d && d.sizes && d.sizes.length ? d : { sizes: FALLBACK_SIZES, telegram: "UniqueOper", shipping: null, backPercent: 50 }))
        .catch(() => ({ sizes: FALLBACK_SIZES, telegram: "UniqueOper", shipping: null, backPercent: 50 }))
        .then((d) => { FX = d.fx || null; renderFx(); return d; });
    }
    return cataloguePromise;
  }

  // price of one plate in euros: format price, plus the back-side surcharge when the back is printed too
  function unitPrice(item, cat) {
    const s = cat.sizes.find((x) => x.id === item.size);
    if (!s) return 0;
    const base = Math.round(s.price * 100);
    const pct = typeof cat.backPercent === "number" ? cat.backPercent : 50;
    return (base + (item.back ? Math.round(base * pct / 100) : 0)) / 100;
  }

  // ---------- cart ----------
  function getCart() { try { return JSON.parse(localStorage.getItem(LS_CART) || "[]"); } catch (e) { return []; } }
  function saveCart(items) {
    try { localStorage.setItem(LS_CART, JSON.stringify(items)); } catch (e) { toast(t("err.generic")); }
    updateCartCount();
  }
  function cartCount() { return getCart().reduce((a, i) => a + (i.qty || 0), 0); }
  function updateCartCount() {
    const n = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = n; el.hidden = n === 0; });
  }

  // ---------- layout ----------
  function brand(cls) { return '<span class="brand-mark ' + (cls || "") + '"><span>Unique</span><span>prints</span></span>'; }
  function page() { const el = document.querySelector("[data-page]"); return (el && el.getAttribute("data-page")) || ""; }
  function renderHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;
    const p = page();
    const link = (href, key, id) => '<a href="' + href + '" class="nav-text' + (p === id ? " active" : "") + '">' + t(key) + "</a>";
    const mlink = (href, key, id) => '<a href="' + href + '"' + (p === id ? ' class="active"' : "") + ">" + t(key) + "</a>";
    el.className = "site-header";
    el.innerHTML =
      '<div class="container-site bar">' +
        '<a href="index.html" class="logo" aria-label="Unique prints">' + brand() + "</a>" +
        '<nav class="nav" aria-label="Main">' +
          link("index.html", "nav.home", "home") + link("prints.html", "nav.prints", "prints") + link("create.html", "nav.create", "create") +
          '<a href="cart.html" class="cart-link' + (p === "cart" || p === "checkout" ? " active" : "") + '" aria-label="' + t("nav.cart") + '">' + ICONS.bag +
            '<span class="cart-count" data-cart-count hidden>0</span></a>' +
          '<span class="fx-rate" data-fx hidden></span>' +
          '<div class="langs" role="group" aria-label="Language">' +
            window.UP_LANGS.map((l) => '<button type="button" data-lang="' + l + '" class="' + (l === lang ? "active" : "") + '" aria-pressed="' + (l === lang) + '">' + window.UP_LANG_LABELS[l] + "</button>").join("") +
          "</div>" +
        "</nav>" +
      "</div>" +
      '<nav class="mobile-nav" aria-label="Mobile">' + mlink("index.html", "nav.home", "home") + mlink("prints.html", "nav.prints", "prints") + mlink("create.html", "nav.create", "create") + mlink("cart.html", "nav.cart", "cart") + "</nav>";
    el.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.getAttribute("data-lang"))));
    updateCartCount();
    renderFx();
    catalogue();
  }
  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    el.className = "site-footer";
    el.innerHTML = '<div class="container-site bar"><a href="index.html" class="logo">' + brand() + '</a><span>© ' + new Date().getFullYear() + ' Unique prints. <span data-i18n="footer.rights">' + t("footer.rights") + "</span></span></div>";
  }

  function img(name, el) {
    const list = IMG[name];
    let i = 0;
    el.onerror = () => { i++; if (i < list.length) el.src = list[i]; else { el.onerror = null; el.style.visibility = "hidden"; } };
    el.src = list[0];
  }
  function bgImage(name) {
    // returns a promise with a working URL for CSS background
    const list = IMG[name];
    return new Promise((resolve) => {
      let i = 0;
      const tryNext = () => {
        if (i >= list.length) return resolve("");
        const probe = new Image();
        const url = list[i++];
        probe.onload = () => resolve(url);
        probe.onerror = tryNext;
        probe.src = url;
      };
      tryNext();
    });
  }

  let toastTimer;
  function toast(html, ms) {
    let el = document.getElementById("up-toast");
    if (!el) { el = document.createElement("div"); el.id = "up-toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = html;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms || 3500);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // plate size for a print preview, relative to the frame (%)
  function plateStyle(size, orientation, image) {
    let w = size.w, h = size.h;
    if (orientation === "landscape" && h > w) { const x = w; w = h; h = x; }
    if (orientation === "portrait" && w > h) { const x = w; w = h; h = x; }
    const ratio = w + "/" + h;
    const width = w >= h ? "62%" : "40%";
    return "width:" + width + ";aspect-ratio:" + ratio + ";" + (image ? "--print-image:url('" + image + "')" : "");
  }

  window.UP = { unitPrice, t, setLang, get lang() { return lang; }, applyI18n, formatEUR, formatPaid, isConverted, currency: displayCurrency, catalogue, getCart, saveCart, updateCartCount, ICONS, img, bgImage, toast, esc, plateStyle, API };

  document.documentElement.lang = lang;
  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderFooter();
    applyI18n();
    window.addEventListener("storage", (e) => { if (e.key === LS_CART) updateCartCount(); });
  });
})();
