/* Unique prints — admin panel */
(function () {
  const API = "../api/admin.php";
  const STATUSES = ["awaiting_quote", "awaiting_payment", "paid", "in_production", "shipped", "completed", "cancelled"];
  const L = {
    ru: {
      prices: "Цены", prTitle: "Цены", mugName: "Кружка 330 мл (11 oz)", mugArea: "печать {w} × {h} мм", prHint: "Цены вводятся в евро. Клиент оплачивает в евро, а на сайте видит цену в валюте своего языка по сегодняшнему курсу.",
      prFormat: "Формат", prEUR: "Цена, €", prOnSite: "На сайте", prDefault: "в config.php: {p}", prBack: "Печать с обратной стороны, % от цены формата", prBackHint: "Например, 50 — оборот стоит половину цены формата.",
      prSave: "Сохранить цены", prSaved: "Цены сохранены. На сайте они обновятся в течение минуты.", prReset: "Вернуть цены из config.php", prResetQ: "Вернуть все цены и надбавку за оборот к значениям из config.php?",
      prResetDone: "Цены возвращены к config.php", prRates: "Курс", prRatesDate: "обновлён {d}", prCustom: "Цены изменены в админке {d}", prFromConfig: "Сейчас действуют цены из config.php",
      prEURnote: "в евро", bad_price: "Цена должна быть от 0,01 до 100 000 €.", bad_percent: "Надбавка за оборот должна быть от 0 до 1000 %.",
      storage: "Место на диске", stTitle: "Место на диске", stUsed: "Занято сайтом", stPhotos: "Оригиналы фото", stFiles: "{n} файлов",
      stThumbs: "Превью", stDb: "База заказов", stFree: "Свободно на диске", stUnknown: "хостинг не сообщает",
      stByStatus: "По статусам", stOrders: "заказов", stCleanTitle: "Очистка старых заказов",
      stCleanHint: "Выберите статусы и возраст заказов. Возраст считается от последнего изменения заказа. Чистить можно только завершённые заказы.",
      stOlder: "Старше, дней", stPhotosBtn: "Удалить только фото", stOrdersBtn: "Удалить заказы полностью",
      stPhotosNote: "«Удалить только фото» — удаляет оригиналы, но оставляет сам заказ, превью, данные клиента и историю. Освобождает почти всё место.",
      stOrdersNote: "«Удалить заказы полностью» — заказ пропадёт из админки и из CSV вместе со всеми фото.",
      stNothing: "Под эти условия не попал ни один заказ.", stConfirmPhotos: "Удалить оригиналы фото у {n} заказ(ов): {p} фото, {mb}?\nСами заказы, превью и история останутся. Отменить нельзя.",
      stConfirmOrders: "Удалить полностью {n} заказ(ов) вместе с фото ({mb})?\nОни пропадут из админки и CSV. Отменить нельзя.",
      stFreed: "Готово: обработано заказов — {n}, освобождено {mb}", pick_status: "Отметьте хотя бы один статус.",
      purgeOne: "Удалить только фото", purgeOneQ: "Удалить оригиналы фото этого заказа? Заказ, превью и история останутся. Отменить нельзя.",
      purged: "Оригиналы удалены {date} для экономии места", purgedShort: "Оригинал удалён для экономии места", ev_photos_deleted: "Фото удалены",
      panel: "Админ-панель", refresh: "Обновить", export: "CSV", logout: "Выйти",
      loginTitle: "Вход в админ-панель", password: "Пароль", signIn: "Войти",
      notConfigured: "Пароль не задан. Откройте файл api/config.php и укажите admin_password (минимум 10 символов).",
      wrong_password: "Неверный пароль.", too_many_attempts: "Слишком много попыток. Подождите 15 минут.",
      search: "Номер заказа, имя, email, телефон…", all: "Все", unpaid: "Не оплачены",
      st_awaiting_quote: "Ждёт расчёта доставки", st_awaiting_payment: "Ждёт оплаты", st_paid: "Оплачен",
      st_in_production: "В производстве", st_shipped: "Отправлен", st_completed: "Выполнен", st_cancelled: "Отменён",
      paid: "Оплачен", notPaid: "Не оплачен", pieces: "шт.", plusShip: "+ доставка",
      noOrders: "Заказов пока нет.", nothingFound: "Ничего не найдено.", selectOrder: "Выберите заказ слева.",
      prev: "← Назад", next: "Дальше →", pageOf: "{a}–{b} из {n}",
      back: "← К списку", copy: "Копировать", copied: "Скопировано", created: "Создан",
      status: "Статус заказа", saveStatus: "Сохранить статус", statusSaved: "Статус сохранён",
      payment: "Оплата", confirmPay: "Подтвердить оплату", unconfirmPay: "Снять отметку об оплате",
      payConfirmQ: "Подтвердить, что клиент оплатил {sum}? Отмечайте только после реального поступления денег.",
      payUndoQ: "Снять отметку об оплате?", quoteFirst: "Сначала рассчитайте и сохраните доставку — тогда будет известна итоговая сумма.",
      paidAt: "Оплачен {date}", payNote: "Заказ остаётся неоплаченным, пока вы вручную не подтвердите оплату.",
      shipping: "Доставка", shipCost: "Стоимость доставки, €", saveQuote: "Сохранить расчёт", quoteSaved: "Расчёт сохранён",
      emailQuote: "Письмо клиенту с суммой", prints: "Принты", total: "Итого", quoteAt: "Расчёт сохранён {date}",
      lockedPaid: "Заказ оплачен — сумму изменить нельзя.",
      customer: "Клиент", name: "Имя", email: "Email", phone: "Телефон", address: "Адрес", country: "Страна",
      carrier: "Служба", delivery: "Способ", home: "Доставка домой", pickup: "Пункт выдачи", pickupPoint: "Пункт выдачи",
      comment: "Комментарий клиента", lang: "Язык сайта", copyAddress: "Скопировать адрес", writeTg: "Написать",
      items: "Принты в заказе", twoSided: "Двусторонняя печать", frontSide: "Лицевая сторона", backSide: "Обратная сторона", backSurcharge: "в т. ч. {sum} за обратную сторону на 1 шт.", portrait: "вертикальная", landscape: "горизонтальная",
      original: "Оригинал", printFile: "Файл для печати", dpi: "{dpi} dpi", crop: "Кадр: {w}% × {h}% исходника, отступ {x}% / {y}%",
      origSize: "Исходник {w}×{h} px · {mb} МБ", photoMissing: "Оригинал фото не найден",
      note: "Заметка (видна только вам)", saveNote: "Сохранить заметку", noteSaved: "Заметка сохранена",
      history: "История", ev_created: "Заказ оформлен", ev_status: "Статус", ev_quote: "Расчёт доставки", ev_payment: "Оплата",
      danger: "Удаление", del: "Удалить заказ", delQ: "Заказ и все фото будут удалены безвозвратно. Чтобы подтвердить, введите номер заказа:",
      deleted: "Заказ удалён", err: "Ошибка: {e}", bad_amount: "Сумма доставки должна быть от 0 до {max} €.",
      already_paid: "Заказ уже оплачен.", quote_first: "Сначала сохраните расчёт доставки.", confirm_mismatch: "Номер не совпал — заказ не удалён.",
      unauthorized: "Сессия истекла, войдите снова.", newOrders: "Новых заказов: {n}",
      mailSubject: "Your Unique prints order {no}",
      mailBody: "Hello {name},\n\nthank you for your order {no}.\n\nPrints: {prints}\nShipping ({carrier}): {ship}\nTotal: {total}\n\nPlease confirm, and we will send you the payment details. You can also message us on Telegram: https://t.me/{tg}\n\nUnique prints",
    },
    en: {
      prices: "Prices", prTitle: "Prices", mugName: "Mug 330 ml (11 oz)", mugArea: "print {w} × {h} mm", prHint: "Enter prices in euros. Customers pay in euros and see each price in their language's currency at today's rate.",
      prFormat: "Format", prEUR: "Price, €", prOnSite: "On the site", prDefault: "config.php: {p}", prBack: "Back side printing, % of the format price", prBackHint: "For example, 50 means the back side costs half the format price.",
      prSave: "Save prices", prSaved: "Prices saved. The site shows them within a minute.", prReset: "Restore prices from config.php", prResetQ: "Restore all prices and the back side surcharge to the values in config.php?",
      prResetDone: "Prices restored from config.php", prRates: "Rate", prRatesDate: "updated {d}", prCustom: "Prices changed in the admin panel on {d}", prFromConfig: "Prices from config.php are in use",
      prEURnote: "in euros", bad_price: "A price must be between €0.01 and €100,000.", bad_percent: "The back side surcharge must be between 0 and 1000 %.",
      storage: "Disk space", stTitle: "Disk space", stUsed: "Used by the site", stPhotos: "Original photos", stFiles: "{n} files",
      stThumbs: "Previews", stDb: "Order database", stFree: "Free on disk", stUnknown: "not reported by the host",
      stByStatus: "By status", stOrders: "orders", stCleanTitle: "Clean up old orders",
      stCleanHint: "Choose statuses and how old the orders must be. Age counts from the order's last change. Only finished orders can be cleaned up.",
      stOlder: "Older than, days", stPhotosBtn: "Delete photos only", stOrdersBtn: "Delete orders completely",
      stPhotosNote: "\"Delete photos only\" removes the originals but keeps the order, previews, customer details and history. It frees almost all the space.",
      stOrdersNote: "\"Delete orders completely\" removes the orders from the admin panel and the CSV together with all photos.",
      stNothing: "No orders match these conditions.", stConfirmPhotos: "Delete the original photos of {n} order(s): {p} photos, {mb}?\nThe orders, previews and history stay. This can't be undone.",
      stConfirmOrders: "Delete {n} order(s) completely, with their photos ({mb})?\nThey will disappear from the admin panel and the CSV. This can't be undone.",
      stFreed: "Done: {n} orders processed, {mb} freed", pick_status: "Tick at least one status.",
      purgeOne: "Delete photos only", purgeOneQ: "Delete this order's original photos? The order, previews and history stay. This can't be undone.",
      purged: "Originals deleted {date} to save space", purgedShort: "Original deleted to save space", ev_photos_deleted: "Photos deleted",
      panel: "Admin panel", refresh: "Refresh", export: "CSV", logout: "Sign out",
      loginTitle: "Admin sign in", password: "Password", signIn: "Sign in",
      notConfigured: "No password is set. Open api/config.php and set admin_password (at least 10 characters).",
      wrong_password: "Wrong password.", too_many_attempts: "Too many attempts. Wait 15 minutes.",
      search: "Order number, name, email, phone…", all: "All", unpaid: "Unpaid",
      st_awaiting_quote: "Awaiting shipping quote", st_awaiting_payment: "Awaiting payment", st_paid: "Paid",
      st_in_production: "In production", st_shipped: "Shipped", st_completed: "Completed", st_cancelled: "Cancelled",
      paid: "Paid", notPaid: "Unpaid", pieces: "pcs", plusShip: "+ shipping",
      noOrders: "No orders yet.", nothingFound: "Nothing found.", selectOrder: "Select an order on the left.",
      prev: "← Prev", next: "Next →", pageOf: "{a}–{b} of {n}",
      back: "← Back to list", copy: "Copy", copied: "Copied", created: "Created",
      status: "Order status", saveStatus: "Save status", statusSaved: "Status saved",
      payment: "Payment", confirmPay: "Confirm payment", unconfirmPay: "Remove payment mark",
      payConfirmQ: "Confirm that the customer paid {sum}? Only mark it after the money has actually arrived.",
      payUndoQ: "Remove the payment mark?", quoteFirst: "Save the shipping quote first so the final total is known.",
      paidAt: "Paid {date}", payNote: "The order stays unpaid until you confirm the payment manually.",
      shipping: "Shipping", shipCost: "Shipping cost, €", saveQuote: "Save quote", quoteSaved: "Quote saved",
      emailQuote: "Email the total to customer", prints: "Prints", total: "Total", quoteAt: "Quote saved {date}",
      lockedPaid: "The order is paid — the total can't be changed.",
      customer: "Customer", name: "Name", email: "Email", phone: "Phone", address: "Address", country: "Country",
      carrier: "Carrier", delivery: "Delivery", home: "Home delivery", pickup: "Pickup point", pickupPoint: "Pickup point",
      comment: "Customer comment", lang: "Site language", copyAddress: "Copy address", writeTg: "Message",
      items: "Prints in this order", twoSided: "Two-sided print", frontSide: "Front side", backSide: "Back side", backSurcharge: "incl. {sum} for the back side per piece", portrait: "portrait", landscape: "landscape",
      original: "Original", printFile: "Print file", dpi: "{dpi} dpi", crop: "Crop: {w}% × {h}% of original, offset {x}% / {y}%",
      origSize: "Original {w}×{h} px · {mb} MB", photoMissing: "Original photo not found",
      note: "Note (only you can see it)", saveNote: "Save note", noteSaved: "Note saved",
      history: "History", ev_created: "Order placed", ev_status: "Status", ev_quote: "Shipping quote", ev_payment: "Payment",
      danger: "Delete", del: "Delete order", delQ: "The order and all its photos will be deleted permanently. Type the order number to confirm:",
      deleted: "Order deleted", err: "Error: {e}", bad_amount: "Shipping must be between 0 and {max} €.",
      already_paid: "This order is already paid.", quote_first: "Save the shipping quote first.", confirm_mismatch: "Number didn't match — order not deleted.",
      unauthorized: "Session expired, please sign in again.", newOrders: "New orders: {n}",
      mailSubject: "Your Unique prints order {no}",
      mailBody: "Hello {name},\n\nthank you for your order {no}.\n\nPrints: {prints}\nShipping ({carrier}): {ship}\nTotal: {total}\n\nPlease confirm, and we will send you the payment details. You can also message us on Telegram: https://t.me/{tg}\n\nUnique prints",
    },
  };
  let lang = localStorage.getItem("up.admin.lang") || "ru";
  const t = (k, v) => { let s = (L[lang] && L[lang][k]) || L.en[k] || k; if (v) for (const x in v) s = s.split("{" + x + "}").join(v[x]); return s; };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = (n) => new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-IE", { style: "currency", currency: "EUR" }).format(Number(n || 0));
  const dt = (ts) => new Date(ts * 1000).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const country = (c) => { try { return new Intl.DisplayNames([lang], { type: "region" }).of(c); } catch (e) { return c; } };
  const stPill = (s) => '<span class="st st-' + s + '">' + t("st_" + s) + "</span>";
  const payPill = (p) => '<span class="pay ' + p + '">' + (p === "paid" ? t("paid") : t("notPaid")) + "</span>";

  let csrf = "";
  let telegram = "UniqueOper";
  let MUGS = new Set(); // size ids that are mugs (from the catalogue)
  const S = { q: "", status: "", page: 1, current: null, seen: Number(localStorage.getItem("up.admin.seen") || 0), lastMax: 0 };

  async function api(action, opts) {
    opts = opts || {};
    const url = API + "?action=" + action + (opts.query ? "&" + new URLSearchParams(opts.query) : "");
    const init = { credentials: "same-origin", headers: { Accept: "application/json" } };
    if (opts.body) { init.method = "POST"; init.headers["Content-Type"] = "application/json"; init.headers["X-CSRF"] = csrf; init.body = JSON.stringify(opts.body); }
    const r = await fetch(url, init);
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && action !== "login") { showLogin(); toast(t("unauthorized")); throw new Error("unauthorized"); }
    if (!r.ok) throw new Error(d.error || "HTTP " + r.status);
    return d;
  }
  let toastTimer;
  function toast(msg) { const el = $("up-toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3000); }
  function errMsg(e, extra) { const k = e && e.message; return L[lang][k] ? t(k, extra) : t("err", { e: k }); }

  function applyStatic() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.getAttribute("data-t")); });
    $("q").placeholder = t("search");
    document.querySelectorAll("[data-al]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-al") === lang));
  }
  document.querySelectorAll("[data-al]").forEach((b) => b.addEventListener("click", () => {
    lang = b.getAttribute("data-al"); localStorage.setItem("up.admin.lang", lang); applyStatic();
    if (!$("app").hidden) { loadList(); if (S.current) openOrder(S.current, true); }
  }));

  // ---------- auth ----------
  function showLogin(configured) {
    $("app").hidden = true; $("top-actions").hidden = true; $("login").hidden = false;
    $("not-configured").hidden = configured !== false;
    $("login-form").querySelector("button").disabled = configured === false;
    setTimeout(() => $("pw").focus(), 50);
  }
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-error").hidden = true;
    try {
      const d = await api("login", { body: { password: $("pw").value } });
      csrf = d.csrf; $("pw").value = ""; start();
    } catch (ex) { $("login-error").textContent = errMsg(ex); $("login-error").hidden = false; }
  });
  $("logout").addEventListener("click", async () => { try { await api("logout", { body: {} }); } catch (e) {} location.hash = ""; showLogin(true); });

  // ---------- list ----------
  let searchTimer;
  $("q").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.q = $("q").value.trim(); S.page = 1; loadList(); }, 250); });
  $("refresh").addEventListener("click", () => { loadList(); if (S.current) openOrder(S.current, true); });
  $("home-link").addEventListener("click", (e) => { e.preventDefault(); location.hash = ""; });

  async function loadList() {
    let d;
    try { d = await api("orders", { query: { q: S.q, status: S.status, page: S.page } }); } catch (e) { return; }
    const chips = [["", t("all"), d.all], ["unpaid", t("unpaid"), d.unpaid]].concat(STATUSES.map((s) => [s, t("st_" + s), d.counts[s]]));
    $("stats").innerHTML = chips.map(([k, label, n]) => '<button type="button" class="chip' + (S.status === k ? " active" : "") + '" data-f="' + k + '">' + esc(label) + " <b>" + (n || 0) + "</b></button>").join("");
    $("stats").querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { S.status = b.getAttribute("data-f"); S.page = 1; loadList(); }));

    const maxCreated = d.orders.reduce((m, o) => Math.max(m, o.created_at), 0);
    if (S.lastMax && maxCreated > S.lastMax) toast(t("newOrders", { n: d.orders.filter((o) => o.created_at > S.lastMax).length }));
    if (!S.q && !S.status && S.page === 1) S.lastMax = Math.max(S.lastMax, maxCreated);

    if (!d.orders.length) { $("orders").innerHTML = '<div class="empty-state">' + (S.q || S.status ? t("nothingFound") : t("noOrders")) + "</div>"; $("pager").innerHTML = ""; return; }
    $("orders").innerHTML = d.orders.map((o) =>
      '<button type="button" class="ord' + (o.number === S.current ? " active" : "") + '" data-no="' + esc(o.number) + '">' +
        '<span class="th">' + (o.thumb_item ? '<img loading="lazy" src="' + API + "?action=photo&kind=thumb&item=" + o.thumb_item + '" alt="">' : "") + "</span>" +
        '<span style="min-width:0"><span class="no">' + esc(o.number) + "</span>" + (o.created_at > S.seen ? '<span class="new-dot" title="new"></span>' : "") +
        '<span class="who" style="display:block">' + esc(o.name) + " · " + esc(o.country) + " · " + o.pieces + " " + t("pieces") + "</span>" +
        '<span class="who" style="display:block">' + dt(o.created_at) + "</span></span>" +
        '<span class="right"><span class="amt">' + (o.total != null ? eur(o.total) : eur(o.subtotal) + ' <span class="muted xsmall">' + t("plusShip") + "</span>") + "</span>" + stPill(o.status) + payPill(o.payment_status) + "</span>" +
      "</button>").join("");
    $("orders").querySelectorAll("[data-no]").forEach((b) => b.addEventListener("click", () => { location.hash = "order/" + b.getAttribute("data-no"); }));
    const a = (d.page - 1) * d.per + 1, b = Math.min(d.total, d.page * d.per);
    $("pager").innerHTML = '<button class="btn btn-sm btn-ghost" id="pp"' + (d.page <= 1 ? " disabled" : "") + ">" + t("prev") + "</button><span>" + t("pageOf", { a, b, n: d.total }) + '</span><button class="btn btn-sm btn-ghost" id="pn"' + (b >= d.total ? " disabled" : "") + ">" + t("next") + "</button>";
    $("pp").onclick = () => { S.page--; loadList(); };
    $("pn").onclick = () => { S.page++; loadList(); };
  }

  // ---------- details ----------
  function route() {
    const m = location.hash.match(/^#order\/(.+)$/);
    if (location.hash === "#storage") openStorage();
    else if (location.hash === "#prices") openPrices();
    else if (m) openOrder(decodeURIComponent(m[1]));
    else { S.current = null; $("app").classList.remove("has-detail"); $("detail-pane").innerHTML = '<div class="empty-state card">' + t("selectOrder") + "</div>"; loadList(); }
  }
  window.addEventListener("hashchange", route);

  async function openOrder(number, keepScroll) {
    S.current = number;
    $("app").classList.add("has-detail");
    document.querySelectorAll(".ord").forEach((el) => el.classList.toggle("active", el.getAttribute("data-no") === number));
    let d;
    try { d = await api("order", { query: { number } }); } catch (e) { $("detail-pane").innerHTML = '<div class="empty-state card">' + esc(errMsg(e)) + "</div>"; return; }
    const o = d.order;
    if (o.created_at > S.seen) { S.seen = Math.max(S.seen, o.created_at); localStorage.setItem("up.admin.seen", String(S.seen)); }
    const y = window.scrollY;
    const paid = o.payment_status === "paid";
    const addr = [o.street, o.postal + " " + o.city, country(o.country)].join(", ");
    const phoneDigits = (o.phone || "").replace(/[^\d+]/g, "");

    $("detail-pane").innerHTML =
      '<button class="btn btn-sm btn-ghost" id="back" style="margin-bottom:.75rem">' + t("back") + "</button>" +
      '<div class="d-head"><div><code>' + esc(o.number) + '</code> <button class="btn btn-sm btn-outline" id="copy-no">' + t("copy") + "</button>" +
        '<p class="muted small" style="margin-top:.35rem">' + t("created") + " " + dt(o.created_at) + " · " + t("lang") + ": " + esc((o.lang || "").toUpperCase()) + "</p></div>" +
        '<div style="display:flex;gap:.5rem;align-items:center">' + stPill(o.status) + payPill(o.payment_status) + "</div></div>" +

      '<div class="d-grid two">' +
        // status
        '<div class="card"><h3>' + t("status") + "</h3>" +
          '<select class="select" id="status-sel">' + STATUSES.filter((s) => s !== "paid" || o.status === "paid").map((s) => '<option value="' + s + '"' + (s === o.status ? " selected" : "") + (s === "paid" ? " disabled" : "") + ">" + t("st_" + s) + "</option>").join("") + "</select>" +
          '<div class="row-actions"><button class="btn btn-md btn-primary" id="save-status">' + t("saveStatus") + "</button></div></div>" +
        // payment
        '<div class="card"><h3>' + t("payment") + "</h3>" +
          (paid
            ? '<p><span class="pay paid">' + t("paidAt", { date: dt(o.paid_at) }) + '</span> <b style="margin-left:.5rem">' + eur(o.total) + '</b></p><div class="row-actions"><button class="btn btn-sm btn-danger" id="unpay">' + t("unconfirmPay") + "</button></div>"
            : '<p class="muted small">' + t("payNote") + "</p>" + (o.total == null ? '<p class="alert" style="margin-top:.75rem">' + t("quoteFirst") + "</p>" : "") +
              '<div class="row-actions"><button class="btn btn-md btn-primary" id="pay"' + (o.total == null ? " disabled" : "") + ">" + t("confirmPay") + (o.total != null ? " · " + eur(o.total) : "") + "</button></div>") +
        "</div>" +
      "</div>" +

      // shipping quote
      '<div class="card"><h3>' + t("shipping") + "</h3>" +
        '<dl class="kv"><dt>' + t("carrier") + "</dt><dd>" + esc(o.carrier) + "</dd><dt>" + t("delivery") + "</dt><dd>" + t(o.delivery === "pickup" ? "pickup" : "home") + "</dd>" +
        (o.delivery === "pickup" ? "<dt>" + t("pickupPoint") + "</dt><dd>" + esc(o.pickup_name) + "<br>" + esc(o.pickup_address) + "</dd>" : "") + "</dl>" +
        '<div class="field" style="margin-top:1rem;max-width:16rem"><label for="ship">' + t("shipCost") + '</label><input class="input" id="ship" type="number" min="0" max="' + d.max_quote + '" step="0.01" inputmode="decimal" value="' + (o.shipping != null ? o.shipping.toFixed(2) : "") + '"' + (paid ? " disabled" : "") + "></div>" +
        '<p class="calc" id="calc"></p>' +
        (paid ? '<p class="muted small" style="margin-top:.5rem">' + t("lockedPaid") + "</p>" : "") +
        (o.quote_at ? '<p class="muted xsmall" style="margin-top:.35rem">' + t("quoteAt", { date: dt(o.quote_at) }) + "</p>" : "") +
        '<div class="row-actions"><button class="btn btn-md btn-primary" id="save-quote"' + (paid ? " disabled" : "") + ">" + t("saveQuote") + '</button><a class="btn btn-md btn-outline" id="mail-quote" href="#">' + t("emailQuote") + "</a></div>" +
      "</div>" +

      // customer
      '<div class="card"><h3>' + t("customer") + "</h3>" +
        '<dl class="kv"><dt>' + t("name") + "</dt><dd>" + esc(o.name) + "</dd>" +
        "<dt>" + t("email") + '</dt><dd><a href="mailto:' + esc(o.email) + '">' + esc(o.email) + "</a></dd>" +
        "<dt>" + t("phone") + '</dt><dd><a href="tel:' + esc(phoneDigits) + '">' + esc(o.phone) + "</a></dd>" +
        "<dt>" + t("address") + "</dt><dd>" + esc(o.street) + "<br>" + esc(o.postal) + " " + esc(o.city) + "<br>" + esc(country(o.country)) + " (" + esc(o.country) + ")</dd>" +
        (o.comment ? "<dt>" + t("comment") + '</dt><dd style="white-space:pre-wrap">' + esc(o.comment) + "</dd>" : "") + "</dl>" +
        '<div class="row-actions"><button class="btn btn-sm btn-outline" id="copy-addr">' + t("copyAddress") + "</button></div>" +
      "</div>" +

      // items
      '<div class="card"><h3>' + t("items") + "</h3>" +
        d.items.map((i) => {
          const qClass = (dpi) => (dpi == null ? "" : dpi >= 240 ? "q-great" : dpi >= 150 ? "q-good" : "q-low");
          const sideInfo = (sd, sideParam, label) => {
            const c = sd.crop || {};
            const q = sideParam ? "&side=back" : "";
            return '<div style="margin-top:.6rem">' + (label ? '<p class="small" style="font-weight:600">' + label + "</p>" : "") +
              '<p class="meta">' + esc(sd.file_name || "") + (sd.dpi != null ? ' · <span class="badge ' + qClass(sd.dpi) + '">' + t("dpi", { dpi: sd.dpi }) + "</span>" : "") + "<br>" +
                (sd.has_original ? t("origSize", { w: sd.width, h: sd.height, mb: (sd.bytes / 1048576).toFixed(1) }) : t(o.photos_purged_at ? "purgedShort" : "photoMissing")) + "<br>" +
                t("crop", { w: Math.round(c.w * 100), h: Math.round(c.h * 100), x: Math.round(c.x * 100), y: Math.round(c.y * 100) }) + "</p>" +
              (sd.has_original ? '<div class="row-actions" style="margin-top:.5rem"><a class="btn btn-sm btn-primary" href="' + API + "?action=photo&kind=print&item=" + i.id + q + '">' + t("printFile") + '</a><a class="btn btn-sm btn-outline" href="' + API + "?action=photo&kind=original&item=" + i.id + q + '">' + t("original") + "</a></div>" : "") +
            "</div>";
          };
          const thumbs = '<div class="th"' + (i.back ? ' style="gap:4px;flex-direction:column"' : "") + ">" +
            (i.has_thumb ? '<img src="' + API + "?action=photo&kind=thumb&item=" + i.id + '" alt="" style="' + (i.back ? "max-height:48px" : "") + '">' : "") +
            (i.back && i.back.has_thumb ? '<img src="' + API + "?action=photo&kind=thumb&side=back&item=" + i.id + '" alt="" style="max-height:48px">' : "") + "</div>";
          return '<div class="item">' + thumbs + "<div>" +
            '<p style="font-weight:600">' + (MUGS.has(i.size) ? esc(t("mugName")) : esc(i.size) + " · " + t(i.orientation)) + " · " + i.qty + " × " + eur(i.unit) + ' = <span class="text-primary">' + eur(i.line) + "</span></p>" +
            (i.back ? '<p style="margin-top:.35rem"><span class="two-sided">' + t("twoSided") + "</span> <span class=\"muted small\">" + t("backSurcharge", { sum: eur(i.back.surcharge) }) + "</span></p>" : "") +
            sideInfo(i, false, i.back ? t("frontSide") : "") +
            (i.back ? sideInfo(i.back, true, t("backSide")) : "") +
          "</div></div>";
        }).join("") +
      "</div>" +

      // note
      '<div class="card"><h3>' + t("note") + '</h3><textarea class="textarea" id="note" maxlength="4000">' + esc(o.admin_note || "") + '</textarea><div class="row-actions"><button class="btn btn-sm btn-outline" id="save-note">' + t("saveNote") + "</button></div></div>" +

      // history
      '<div class="card"><h3>' + t("history") + '</h3><div class="events">' +
        d.events.map((e) => "<div><time>" + dt(e.at) + "</time>" + esc(t("ev_" + e.kind)) + (e.detail && e.kind !== "created" ? " — " + esc(e.detail.replace(/[a-z_]+/g, (w) => (L[lang]["st_" + w] ? t("st_" + w) : w))) : "") + "</div>").join("") +
      "</div></div>" +

      '<div class="card"><h3>' + t("danger") + "</h3>" +
        (o.photos_purged_at ? '<p class="muted small" style="margin-bottom:.75rem">' + t("purged", { date: dt(o.photos_purged_at) }) + "</p>" : "") +
        '<div class="row-actions" style="margin-top:0">' + (o.photos_purged_at ? "" : '<button class="btn btn-sm btn-outline" id="purge">' + t("purgeOne") + "</button>") +
        '<button class="btn btn-sm btn-danger" id="del">' + t("del") + "</button></div></div>";

    // calc + mail
    const calc = () => {
      const v = parseFloat($("ship").value);
      const ok = !isNaN(v) && v >= 0;
      $("calc").innerHTML = t("prints") + " <b>" + eur(o.subtotal) + "</b> + " + t("shipping").toLowerCase() + " <b>" + (ok ? eur(v) : "—") + "</b> = " + t("total").toLowerCase() + ' <b class="text-primary">' + (ok ? eur(o.subtotal + Math.round(v * 100) / 100) : "—") + "</b>";
      const subj = t("mailSubject", { no: o.number });
      const body = t("mailBody", { name: o.name, no: o.number, prints: eur(o.subtotal), carrier: o.carrier, ship: ok ? eur(v) : "—", total: ok ? eur(o.subtotal + v) : "—", tg: telegram });
      $("mail-quote").href = "mailto:" + encodeURIComponent(o.email) + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
    };
    calc();
    $("ship").addEventListener("input", calc);

    $("back").onclick = () => { location.hash = ""; };
    $("copy-no").onclick = () => navigator.clipboard.writeText(o.number).then(() => toast(t("copied")));
    $("copy-addr").onclick = () => navigator.clipboard.writeText([o.name, o.street, o.postal + " " + o.city, country(o.country), o.phone].join("\n")).then(() => toast(t("copied")));
    const act = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg); await openOrder(number, true); loadList(); } catch (e) { toast(errMsg(e, { max: d.max_quote })); } };
    $("save-status").onclick = () => act(() => api("status", { body: { number, status: $("status-sel").value } }), t("statusSaved"));
    $("save-quote").onclick = () => act(() => api("quote", { body: { number, shipping: $("ship").value } }), t("quoteSaved"));
    $("save-note").onclick = () => act(() => api("note", { body: { number, note: $("note").value } }), t("noteSaved"));
    if ($("pay")) $("pay").onclick = () => { if (confirm(t("payConfirmQ", { sum: eur(o.total) }))) act(() => api("payment", { body: { number, paid: true } })); };
    if ($("unpay")) $("unpay").onclick = () => { if (confirm(t("payUndoQ"))) act(() => api("payment", { body: { number, paid: false } })); };
    if ($("purge")) $("purge").onclick = () => { if (confirm(t("purgeOneQ"))) act(() => api("purge_photos", { body: { number } }), t("deleted")); };
    $("del").onclick = async () => {
      const v = prompt(t("delQ"));
      if (v == null) return;
      try { await api("delete", { body: { number, confirm: v.trim() } }); toast(t("deleted")); location.hash = ""; loadList(); } catch (e) { toast(errMsg(e)); }
    };
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }

  // ---------- disk space ----------
  const fmtBytes = (b) => {
    if (b == null) return t("stUnknown");
    const u = lang === "ru" ? ["Б", "КБ", "МБ", "ГБ", "ТБ"] : ["B", "KB", "MB", "GB", "TB"];
    let i = 0, v = b; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i ? v.toFixed(v < 10 ? 1 : 0) : v) + " " + u[i];
  };
  async function openStorage() {
    S.current = null;
    $("app").classList.add("has-detail");
    document.querySelectorAll(".ord").forEach((el) => el.classList.remove("active"));
    let d;
    try { d = await api("storage"); } catch (e) { $("detail-pane").innerHTML = '<div class="empty-state card">' + esc(errMsg(e)) + "</div>"; return; }
    const rows = STATUSES.filter((st) => d.by_status[st]).map((st) =>
      '<div class="summary-line"><span>' + stPill(st) + ' <span class="muted small">' + d.by_status[st].orders + " " + t("stOrders") + "</span></span><span>" + fmtBytes(d.by_status[st].bytes) + "</span></div>").join("");
    const chk = (st, on) => '<label class="opt' + (on ? " active" : "") + '"><input type="checkbox" value="' + st + '"' + (on ? " checked" : "") + ">" + t("st_" + st) + "</label>";
    $("detail-pane").innerHTML =
      '<button class="btn btn-sm btn-ghost" id="back" style="margin-bottom:.75rem">' + t("back") + "</button>" +
      '<div class="d-head"><h2 class="font-display" style="font-size:2rem">' + t("stTitle") + "</h2></div>" +
      '<div class="d-grid two">' +
        '<div class="card"><h3>' + t("stUsed") + '</h3><p class="price-big">' + fmtBytes(d.total_bytes) + "</p>" +
          '<dl class="kv" style="margin-top:1rem"><dt>' + t("stPhotos") + "</dt><dd>" + fmtBytes(d.photos_bytes) + ' <span class="muted small">· ' + t("stFiles", { n: d.photos_files }) + "</span></dd>" +
          "<dt>" + t("stThumbs") + "</dt><dd>" + fmtBytes(d.thumbs_bytes) + "</dd><dt>" + t("stDb") + "</dt><dd>" + fmtBytes(d.db_bytes) + "</dd></dl></div>" +
        '<div class="card"><h3>' + t("stFree") + '</h3><p class="price-big">' + fmtBytes(d.disk_free) + "</p>" +
          '<h3 style="margin-top:1.25rem">' + t("stByStatus") + "</h3>" + (rows || '<p class="muted small">' + t("noOrders") + "</p>") + "</div>" +
      "</div>" +
      '<div class="card"><h3>' + t("stCleanTitle") + '</h3><p class="muted small relaxed">' + t("stCleanHint") + "</p>" +
        '<div class="seg" id="cl-status" style="margin-top:1rem">' + chk("completed", true) + chk("cancelled", true) + chk("shipped", false) + "</div>" +
        '<div class="field" style="margin-top:1rem;max-width:12rem"><label for="cl-days">' + t("stOlder") + '</label><input class="input" id="cl-days" type="number" min="0" max="3650" value="30"></div>' +
        '<div class="row-actions"><button class="btn btn-md btn-primary" id="cl-photos">' + t("stPhotosBtn") + '</button><button class="btn btn-md btn-danger" id="cl-orders">' + t("stOrdersBtn") + "</button></div>" +
        '<p class="muted xsmall relaxed" style="margin-top:1rem">' + t("stPhotosNote") + "<br>" + t("stOrdersNote") + "</p>" +
      "</div>";
    $("back").onclick = () => { location.hash = ""; };
    $("cl-status").querySelectorAll("input").forEach((i) => i.addEventListener("change", () => i.parentElement.classList.toggle("active", i.checked)));
    const run = async (mode) => {
      const body = { mode, statuses: [...$("cl-status").querySelectorAll("input:checked")].map((i) => i.value), days: Number($("cl-days").value) || 0 };
      try {
        const pre = await api("cleanup", { body: Object.assign({ dry_run: true }, body) });
        if (!pre.orders) { toast(t("stNothing")); return; }
        const q = mode === "orders" ? t("stConfirmOrders", { n: pre.orders, mb: fmtBytes(pre.bytes) }) : t("stConfirmPhotos", { n: pre.orders, p: pre.photos, mb: fmtBytes(pre.bytes) });
        if (!confirm(q)) return;
        const res = await api("cleanup", { body });
        toast(t("stFreed", { n: res.orders, mb: fmtBytes(res.freed) }));
        loadList(); openStorage();
      } catch (e) { toast(errMsg(e)); }
    };
    $("cl-photos").onclick = () => run("photos");
    $("cl-orders").onclick = () => run("orders");
  }

  // ---------- prices ----------
  // Prices are entered in EUR; the shop converts them into each language's currency.
  const LANG_LABEL = { en: "EN", hu: "HU", de: "DE", uk: "UA", ru: "RUS" };
  const CUR_LOCALE = { USD: "en-US", HUF: "hu-HU", UAH: "uk-UA", RUB: "ru-RU", EUR: "de-DE" };
  const CUR_WHOLE = { HUF: true, UAH: true, RUB: true };
  function money(n, cur, digits) {
    const d = digits != null ? digits : CUR_WHOLE[cur] ? 0 : 2;
    try { return new Intl.NumberFormat(CUR_LOCALE[cur] || "en-US", { style: "currency", currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
    catch (e) { return Number(n).toFixed(d) + " " + cur; }
  }
  async function openPrices() {
    S.current = null;
    $("app").classList.add("has-detail");
    document.querySelectorAll(".ord").forEach((el) => el.classList.remove("active"));
    let d;
    try { d = await api("prices"); } catch (e) { $("detail-pane").innerHTML = '<div class="empty-state card">' + esc(errMsg(e)) + "</div>"; return; }
    renderPrices(d);
  }
  function renderPrices(d) {
    const rates = d.fx.rates || {};
    // one entry per language whose currency can be converted (languages sharing a currency are listed together)
    const curs = [];
    Object.keys(d.fx.currencies).forEach((l) => {
      const c = d.fx.currencies[l];
      if (c === "EUR" || !(rates[c] > 0)) return;
      const ex = curs.find((x) => x.cur === c);
      if (ex) ex.langs.push(LANG_LABEL[l] || l); else curs.push({ cur: c, langs: [LANG_LABEL[l] || l] });
    });
    const onSite = (eurPrice) => curs.map((x) => '<span class="pr-cur"><span class="muted">' + x.langs.join("/") + "</span> " + money(eurPrice * rates[x.cur], x.cur) + "</span>").join("");
    const ratesLine = curs.map((x) => "1 € = " + money(rates[x.cur], x.cur, 2)).join(" · ");
    const when = (ts) => new Date(ts * 1000).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB");
    $("detail-pane").innerHTML =
      '<button class="btn btn-sm btn-ghost" id="back" style="margin-bottom:.75rem">' + t("back") + "</button>" +
      '<div class="d-head"><h2 class="font-display" style="font-size:2rem">' + t("prTitle") + "</h2>" +
        '<span class="muted small">' + (d.custom && d.updated_at ? t("prCustom", { d: dt(d.updated_at) }) : t("prFromConfig")) + "</span></div>" +
      '<form class="card" id="pr-form" novalidate>' +
        '<p class="muted small relaxed">' + t("prHint") + "</p>" +
        (ratesLine ? '<p class="small" style="margin-top:.6rem"><span class="muted">' + t("prRates") + ":</span> " + ratesLine + (d.fx.date ? ' <span class="muted xsmall">(' + t("prRatesDate", { d: when(d.fx.date) }) + ")</span>" : "") + "</p>" : "") +
        '<div class="pr-table" style="margin-top:1.25rem">' +
          '<div class="pr-row pr-headrow"><span>' + t("prFormat") + "</span><span>" + t("prEUR") + "</span><span>" + t("prOnSite") + "</span></div>" +
          d.sizes.map((s) =>
            '<div class="pr-row">' +
              '<label for="pr-' + esc(s.id) + '"><b>' + (s.type === "mug" ? esc(t("mugName")) : esc(s.id)) + '</b><span class="muted xsmall" style="display:block">' + (s.type === "mug" ? t("mugArea", { w: s.w, h: s.h }) : s.w + " × " + s.h + " mm") + "</span></label>" +
              '<div><input class="input pr-input" id="pr-' + esc(s.id) + '" data-size="' + esc(s.id) + '" type="number" inputmode="decimal" min="0.01" max="100000" step="0.01" value="' + Number(s.price).toFixed(2) + '">' +
                '<span class="muted xsmall pr-def">' + t("prDefault", { p: eur(s.default_price) }) + "</span></div>" +
              '<div class="pr-conv" data-conv="' + esc(s.id) + '">' + onSite(s.price) + "</div>" +
            "</div>").join("") +
        "</div>" +
        '<div class="field" style="margin-top:1.25rem;max-width:22rem"><label for="pr-back">' + t("prBack") + '</label>' +
          '<input class="input" id="pr-back" type="number" inputmode="decimal" min="0" max="1000" step="1" value="' + d.back_percent + '">' +
          '<span class="muted xsmall">' + t("prBackHint") + " " + t("prDefault", { p: d.back_default + " %" }) + "</span></div>" +
        '<p class="alert error" id="pr-error" hidden style="margin-top:1rem"></p>' +
        '<div class="row-actions"><button class="btn btn-md btn-primary" type="submit" id="pr-save">' + t("prSave") + "</button>" +
          '<button class="btn btn-md btn-ghost" type="button" id="pr-reset"' + (d.custom ? "" : " disabled") + ">" + t("prReset") + "</button></div>" +
      "</form>";
    $("back").onclick = () => { location.hash = ""; };
    $("detail-pane").querySelectorAll(".pr-input").forEach((inp) => inp.addEventListener("input", () => {
      const v = Number(inp.value);
      inp.classList.toggle("invalid", !(v >= 0.01 && v <= 100000));
      $("detail-pane").querySelector('[data-conv="' + inp.dataset.size + '"]').innerHTML = v > 0 ? onSite(v) : "";
    }));
    $("pr-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      $("pr-error").hidden = true;
      const prices = {};
      let bad = false;
      $("detail-pane").querySelectorAll(".pr-input").forEach((inp) => { const v = Number(inp.value); if (!(v >= 0.01 && v <= 100000)) { bad = true; inp.classList.add("invalid"); } prices[inp.dataset.size] = Math.round(v * 100) / 100; });
      const bp = Number($("pr-back").value);
      if (bad) { $("pr-error").textContent = t("bad_price"); $("pr-error").hidden = false; return; }
      if ($("pr-back").value === "" || !(bp >= 0 && bp <= 1000)) { $("pr-error").textContent = t("bad_percent"); $("pr-error").hidden = false; return; }
      $("pr-save").disabled = true;
      try { renderPrices(await api("save_prices", { body: { prices, back_percent: bp } })); toast(t("prSaved")); }
      catch (ex) { $("pr-error").textContent = errMsg(ex); $("pr-error").hidden = false; $("pr-save").disabled = false; }
    });
    $("pr-reset").onclick = async () => {
      if (!confirm(t("prResetQ"))) return;
      try { renderPrices(await api("save_prices", { body: { reset: true } })); toast(t("prResetDone")); } catch (ex) { toast(errMsg(ex)); }
    };
  }

  // ---------- start ----------
  async function start() {
    $("login").hidden = true; $("app").hidden = false; $("top-actions").hidden = false;
    try { const c = await fetch("../api/index.php?action=catalogue").then((r) => r.json()); if (c.telegram) telegram = c.telegram; MUGS = new Set((c.sizes || []).filter((s) => s.type === "mug").map((s) => s.id)); } catch (e) {}
    route();
    clearInterval(window.__poll);
    window.__poll = setInterval(() => { if (!document.hidden) loadList(); }, 60000);
  }

  applyStatic();
  api("me").then((d) => { csrf = d.csrf; if (d.auth) start(); else showLogin(d.configured); }).catch(() => showLogin(true));
})();
