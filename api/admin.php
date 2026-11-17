<?php
/** Unique prints — admin API (orders, statuses, shipping quotes, payments, photos). */

declare(strict_types=1);
define('UP_APP', true);
require __DIR__ . '/lib.php';

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
ini_set('session.use_strict_mode', '1');   // never accept a session id the server didn't create
ini_set('session.use_only_cookies', '1');
session_name('up_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

const ADMIN_IDLE_SECONDS = 8 * 3600; // signed out after 8 hours without any activity

$action = $_GET['action'] ?? '';

try {
    if ($action === 'me') action_me();
    if ($action === 'login') action_login();
    require_admin();
    // anything that changes data must be a POST (with the CSRF header checked in require_admin)
    $changes = ['logout', 'status', 'quote', 'payment', 'note', 'delete', 'cleanup', 'purge_photos', 'save_prices'];
    if (in_array($action, $changes, true) && $_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
    switch ($action) {
        case 'logout': session_destroy(); json_out(['ok' => true]);
        case 'orders': action_orders(); break;
        case 'order': action_order(); break;
        case 'status': action_status(); break;
        case 'quote': action_quote(); break;
        case 'payment': action_payment(); break;
        case 'note': action_note(); break;
        case 'delete': action_delete(); break;
        case 'photo': action_photo(); break;
        case 'export': action_export(); break;
        case 'storage': action_storage(); break;
        case 'cleanup': action_cleanup(); break;
        case 'purge_photos': action_purge_photos(); break;
        case 'prices': action_prices(); break;
        case 'save_prices': action_save_prices(); break;
        default: fail('not_found', 404);
    }
} catch (Throwable $e) {
    error_log('[uniqueprints admin] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail('server_error', 500);
}

// ---------- auth ----------
function password_configured(): bool { return strlen((string) cfg('admin_password')) >= 10; }

function action_me(): void
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = rand_hex(16);
    $active = !empty($_SESSION['admin']) && time() - (int) ($_SESSION['seen'] ?? 0) <= ADMIN_IDLE_SECONDS;
    json_out(['auth' => $active, 'configured' => password_configured(), 'csrf' => $_SESSION['csrf']]);
}

function action_login(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
    if (!password_configured()) fail('not_configured', 403);
    if (!rate_ok('login', 8, 900)) fail('too_many_attempts', 429);
    $d = body_json(10000);
    $given = (string) ($d['password'] ?? '');
    $stored = (string) cfg('admin_password');
    $ok = strpos($stored, '$2y$') === 0 || strpos($stored, '$argon2') === 0 ? password_verify($given, $stored) : hash_equals($stored, $given);
    if (!$ok) { usleep(700000); fail('wrong_password', 401); }
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['seen'] = time();
    $_SESSION['csrf'] = rand_hex(16);
    json_out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

function require_admin(): void
{
    if (!empty($_SESSION['admin']) && time() - (int) ($_SESSION['seen'] ?? 0) > ADMIN_IDLE_SECONDS) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    if (empty($_SESSION['admin'])) fail('unauthorized', 401);
    $_SESSION['seen'] = time();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $h = (string) ($_SERVER['HTTP_X_CSRF'] ?? '');
        if ($h === '' || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $h)) fail('csrf', 403);
    }
}

function find_order(string $number): array
{
    $st = db()->prepare('SELECT * FROM orders WHERE number = ?');
    $st->execute([$number]);
    $o = $st->fetch();
    if (!$o) fail('order_not_found', 404);
    return $o;
}

function order_public(array $o): array
{
    return [
        'id' => (int) $o['id'], 'number' => $o['number'], 'status' => $o['status'], 'payment_status' => $o['payment_status'],
        'lang' => $o['lang'], 'name' => $o['name'], 'email' => $o['email'], 'phone' => $o['phone'],
        'street' => $o['street'], 'city' => $o['city'], 'postal' => $o['postal'], 'country' => $o['country'],
        'carrier' => $o['carrier'], 'delivery' => $o['delivery'], 'pickup_name' => $o['pickup_name'], 'pickup_address' => $o['pickup_address'],
        'comment' => $o['comment'], 'admin_note' => $o['admin_note'],
        'subtotal' => (int) $o['subtotal_cents'] / 100,
        'shipping' => $o['shipping_cents'] !== null ? (int) $o['shipping_cents'] / 100 : null,
        'total' => $o['total_cents'] !== null ? (int) $o['total_cents'] / 100 : null,
        'quote_at' => $o['quote_at'] !== null ? (int) $o['quote_at'] : null,
        'photos_purged_at' => isset($o['photos_purged_at']) && $o['photos_purged_at'] !== null ? (int) $o['photos_purged_at'] : null,
        'paid_at' => $o['paid_at'] !== null ? (int) $o['paid_at'] : null,
        'created_at' => (int) $o['created_at'], 'updated_at' => (int) $o['updated_at'],
    ];
}

// ---------- list ----------
function action_orders(): void
{
    $pdo = db();
    $q = trim((string) ($_GET['q'] ?? ''));
    $status = (string) ($_GET['status'] ?? '');
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $per = 40;
    $where = []; $args = [];
    if ($q !== '') {
        $where[] = "(number LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\')";
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $q) . '%';
        array_push($args, $like, $like, $like, $like, $like);
    }
    if ($status === 'unpaid') { $where[] = "payment_status = 'unpaid' AND status != 'cancelled'"; }
    elseif (in_array($status, STATUSES, true)) { $where[] = 'status = ?'; $args[] = $status; }
    $sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $cnt = $pdo->prepare("SELECT COUNT(*) FROM orders $sqlWhere");
    $cnt->execute($args);
    $total = (int) $cnt->fetchColumn();
    $st = $pdo->prepare("SELECT o.*, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS pieces,
        (SELECT thumb_path FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS first_thumb,
        (SELECT id FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS first_item
        FROM orders o $sqlWhere ORDER BY created_at DESC LIMIT $per OFFSET " . (($page - 1) * $per));
    $st->execute($args);
    $rows = array_map(function ($o) {
        $p = order_public($o);
        $p['pieces'] = (int) $o['pieces'];
        $p['thumb_item'] = $o['first_thumb'] ? (int) $o['first_item'] : null;
        return $p;
    }, $st->fetchAll());

    $counts = array_fill_keys(STATUSES, 0);
    foreach ($pdo->query('SELECT status, COUNT(*) c FROM orders GROUP BY status') as $r) $counts[$r['status']] = (int) $r['c'];
    $unpaid = (int) $pdo->query("SELECT COUNT(*) FROM orders WHERE payment_status = 'unpaid' AND status != 'cancelled'")->fetchColumn();
    $paidSum = (int) $pdo->query("SELECT COALESCE(SUM(total_cents),0) FROM orders WHERE payment_status = 'paid'")->fetchColumn();
    $all = (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
    json_out(['orders' => $rows, 'total' => $total, 'page' => $page, 'per' => $per, 'counts' => $counts, 'unpaid' => $unpaid, 'all' => $all, 'paid_sum' => $paidSum / 100]);
}

// ---------- details ----------
function action_order(): void
{
    $o = find_order((string) ($_GET['number'] ?? ''));
    $pdo = db();
    $it = $pdo->prepare('SELECT i.*, p.width, p.height, p.bytes, p.mime, p.original_name,
        b.width AS b_width, b.height AS b_height, b.bytes AS b_bytes, b.mime AS b_mime, b.original_name AS b_original_name
        FROM order_items i LEFT JOIN photos p ON p.id = i.photo_id LEFT JOIN photos b ON b.id = i.back_photo_id WHERE i.order_id = ? ORDER BY i.id');
    $it->execute([$o['id']]);
    $items = array_map(fn($r) => [
        'id' => (int) $r['id'], 'size' => $r['size'], 'orientation' => $r['orientation'], 'qty' => (int) $r['qty'],
        'unit' => (int) $r['unit_cents'] / 100, 'line' => (int) $r['line_cents'] / 100,
        'crop' => json_decode($r['crop_json'], true), 'dpi' => $r['dpi'] !== null ? (int) $r['dpi'] : null,
        'file_name' => $r['file_name'] ?: $r['original_name'], 'width' => (int) $r['width'], 'height' => (int) $r['height'],
        'bytes' => (int) $r['bytes'], 'has_thumb' => (bool) $r['thumb_path'], 'has_original' => $r['mime'] !== null,
        'back' => $r['back_photo_id'] ? [
            'crop' => json_decode((string) $r['back_crop_json'], true), 'dpi' => $r['back_dpi'] !== null ? (int) $r['back_dpi'] : null,
            'file_name' => $r['back_file_name'] ?: $r['b_original_name'], 'width' => (int) $r['b_width'], 'height' => (int) $r['b_height'],
            'bytes' => (int) $r['b_bytes'], 'has_thumb' => (bool) $r['back_thumb_path'], 'has_original' => $r['b_mime'] !== null,
            'surcharge' => (int) $r['back_cents'] / 100,
        ] : null,
    ], $it->fetchAll());
    $ev = $pdo->prepare('SELECT at, kind, detail FROM order_events WHERE order_id = ? ORDER BY id DESC');
    $ev->execute([$o['id']]);
    json_out(['order' => order_public($o), 'items' => $items, 'events' => $ev->fetchAll(), 'max_quote' => cfg('shipping')['maxQuote'] ?? 1000, 'currency' => cfg('currency')]);
}

// ---------- changes ----------
function touch_order(int $id, array $fields): void
{
    $fields['updated_at'] = time();
    $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($fields)));
    db()->prepare("UPDATE orders SET $sets WHERE id = ?")->execute([...array_values($fields), $id]);
}

function action_status(): void
{
    $d = body_json(10000);
    $o = find_order((string) ($d['number'] ?? ''));
    $status = (string) ($d['status'] ?? '');
    if (!in_array($status, STATUSES, true)) fail('bad_status');
    if ($status === 'paid') fail('use_payment_button');
    if ($status === $o['status']) json_out(['ok' => true]);
    touch_order((int) $o['id'], ['status' => $status]);
    add_event((int) $o['id'], 'status', $o['status'] . ' → ' . $status);
    json_out(['ok' => true]);
}

function action_quote(): void
{
    $d = body_json(10000);
    $o = find_order((string) ($d['number'] ?? ''));
    if ($o['payment_status'] === 'paid') fail('already_paid');
    $v = $d['shipping'] ?? null;
    if (!is_numeric($v)) fail('bad_amount');
    $cents = (int) round((float) $v * 100);
    $max = (int) ((cfg('shipping')['maxQuote'] ?? 1000) * 100);
    if ($cents < 0 || $cents > $max) fail('bad_amount');
    $total = (int) $o['subtotal_cents'] + $cents;
    $fields = ['shipping_cents' => $cents, 'total_cents' => $total, 'quote_at' => time()];
    if ($o['status'] === 'awaiting_quote') $fields['status'] = 'awaiting_payment';
    touch_order((int) $o['id'], $fields);
    add_event((int) $o['id'], 'quote', 'Shipping €' . money($cents) . ' · total €' . money($total));
    json_out(['ok' => true]);
}

function action_payment(): void
{
    $d = body_json(10000);
    $o = find_order((string) ($d['number'] ?? ''));
    $paid = !empty($d['paid']);
    if ($paid) {
        if ($o['total_cents'] === null) fail('quote_first');
        if ($o['payment_status'] === 'paid') json_out(['ok' => true]);
        $fields = ['payment_status' => 'paid', 'paid_at' => time()];
        if (in_array($o['status'], ['awaiting_quote', 'awaiting_payment'], true)) $fields['status'] = 'paid';
        touch_order((int) $o['id'], $fields);
        add_event((int) $o['id'], 'payment', 'Payment confirmed manually · €' . money((int) $o['total_cents']));
    } else {
        if ($o['payment_status'] !== 'paid') json_out(['ok' => true]);
        $fields = ['payment_status' => 'unpaid', 'paid_at' => null];
        if ($o['status'] === 'paid') $fields['status'] = 'awaiting_payment';
        touch_order((int) $o['id'], $fields);
        add_event((int) $o['id'], 'payment', 'Payment confirmation removed');
    }
    json_out(['ok' => true]);
}

function action_note(): void
{
    $d = body_json(20000);
    $o = find_order((string) ($d['number'] ?? ''));
    $note = str_field($d['note'] ?? '', 4000, false);
    touch_order((int) $o['id'], ['admin_note' => $note]);
    json_out(['ok' => true]);
}

function action_delete(): void
{
    $d = body_json(10000);
    $o = find_order((string) ($d['number'] ?? ''));
    if (($d['confirm'] ?? '') !== $o['number']) fail('confirm_mismatch');
    $freed = delete_order_fully((int) $o['id']);
    json_out(['ok' => true, 'freed' => $freed]);
}

/** Removes only the original photos of one order; previews, data and history stay. */
function action_purge_photos(): void
{
    $d = body_json(10000);
    $o = find_order((string) ($d['number'] ?? ''));
    $freed = purge_order_photos((int) $o['id']);
    add_event((int) $o['id'], 'photos_deleted', 'Original photos removed, ' . round($freed / 1048576, 1) . ' MB freed');
    json_out(['ok' => true, 'freed' => $freed]);
}

// ---------- prices ----------
// Prices are always in EUR. The shop shows them converted into each language's currency.
function prices_out(): array
{
    $fx = fx_rates();
    return [
        'sizes' => array_map(fn($s) => ['id' => $s['id'], 'type' => $s['type'], 'w' => $s['w'], 'h' => $s['h'], 'price' => $s['price'], 'default_price' => $s['default_price']], price_sizes()),
        'back_percent' => back_percent(),
        'back_default' => (float) (cfg('back_side_percent') ?? 50),
        'custom' => setting('prices') !== null || setting('back_percent') !== null,
        'updated_at' => max((int) setting_time('prices'), (int) setting_time('back_percent')) ?: null,
        'fx' => ['currencies' => display_currencies(), 'rates' => (object) $fx['rates'], 'date' => $fx['date']],
    ];
}

function action_prices(): void { json_out(prices_out()); }

function action_save_prices(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
    $d = body_json(10000);
    if (!empty($d['reset'])) {
        set_setting('prices', null);
        set_setting('back_percent', null);
        json_out(prices_out());
    }
    $ids = array_column(cfg('sizes'), 'id');
    $in = (array) ($d['prices'] ?? []);
    $prices = [];
    foreach ($ids as $id) {
        $v = $in[$id] ?? null;
        if (!is_numeric($v)) fail('bad_price');
        $v = round((float) $v, 2);
        if ($v < 0.01 || $v > 100000) fail('bad_price');
        $prices[$id] = $v;
    }
    $bp = $d['back_percent'] ?? null;
    if (!is_numeric($bp) || (float) $bp < 0 || (float) $bp > 1000) fail('bad_percent');
    set_setting('prices', $prices);
    set_setting('back_percent', round((float) $bp, 2));
    json_out(prices_out());
}

// ---------- disk space ----------
function action_storage(): void
{
    $pdo = db();
    [$photoBytes, $photoFiles] = dir_bytes(data_dir() . '/uploads');
    [$thumbBytes] = dir_bytes(data_dir() . '/thumbs');
    $dbBytes = 0;
    foreach (glob(data_dir() . '/shop.sqlite*') ?: [] as $f) $dbBytes += (int) filesize($f);
    $orphans = (int) $pdo->query('SELECT COUNT(*) FROM photos WHERE order_id IS NULL')->fetchColumn();
    $byStatus = [];
    $st = $pdo->query('SELECT o.status, COUNT(*) AS orders, COALESCE(SUM(p.bytes), 0) AS bytes FROM orders o LEFT JOIN photos p ON p.order_id = o.id GROUP BY o.status');
    foreach ($st as $r) $byStatus[$r['status']] = ['orders' => (int) $r['orders'], 'bytes' => (int) $r['bytes']];
    // number of orders per status (the join above counts one row per photo)
    foreach ($pdo->query('SELECT status, COUNT(*) c FROM orders GROUP BY status') as $r) $byStatus[$r['status']]['orders'] = (int) $r['c'];
    $free = @disk_free_space(data_dir());
    json_out([
        'photos_bytes' => $photoBytes, 'photos_files' => $photoFiles, 'thumbs_bytes' => $thumbBytes, 'db_bytes' => $dbBytes,
        'total_bytes' => $photoBytes + $thumbBytes + $dbBytes, 'disk_free' => $free === false ? null : (int) $free,
        'orphans' => $orphans, 'by_status' => $byStatus, 'cleanup_statuses' => CLEANUP_STATUSES,
    ]);
}

/**
 * Bulk clean-up of old orders. mode "photos" removes only the original photos (order data, previews and
 * history stay); mode "orders" deletes the orders completely. Only finished statuses can be cleaned.
 * With dry_run it only reports what would be removed.
 */
function action_cleanup(): void
{
    $d = body_json(10000);
    $mode = ($d['mode'] ?? '') === 'orders' ? 'orders' : 'photos';
    $statuses = array_values(array_intersect((array) ($d['statuses'] ?? []), CLEANUP_STATUSES));
    $days = max(0, min(3650, (int) ($d['days'] ?? 30)));
    if (!$statuses) fail('pick_status');
    $pdo = db();
    $in = implode(',', array_fill(0, count($statuses), '?'));
    $sql = "SELECT o.id, o.number, COALESCE(SUM(p.bytes), 0) AS bytes, COUNT(p.id) AS photos
            FROM orders o LEFT JOIN photos p ON p.order_id = o.id
            WHERE o.status IN ($in) AND o.updated_at < ?" . ($mode === 'photos' ? ' AND o.photos_purged_at IS NULL' : '') . '
            GROUP BY o.id';
    $st = $pdo->prepare($sql);
    $st->execute([...$statuses, time() - $days * 86400]);
    $rows = $st->fetchAll();
    $sum = ['orders' => count($rows), 'photos' => array_sum(array_column($rows, 'photos')), 'bytes' => (int) array_sum(array_column($rows, 'bytes'))];
    if (!empty($d['dry_run'])) json_out($sum + ['dry_run' => true]);

    $freed = 0;
    foreach ($rows as $r) {
        if ($mode === 'orders') $freed += delete_order_fully((int) $r['id']);
        else { $freed += purge_order_photos((int) $r['id']); add_event((int) $r['id'], 'photos_deleted', 'Original photos removed (bulk clean-up)'); }
    }
    cleanup_orphans();
    try { $pdo->exec('VACUUM'); } catch (Throwable $e) {}
    json_out($sum + ['freed' => $freed]);
}

// ---------- files ----------
function action_photo(): void
{
    $itemId = (int) ($_GET['item'] ?? 0);
    $kind = (string) ($_GET['kind'] ?? 'thumb');
    $isBack = (string) ($_GET['side'] ?? '') === 'back';
    $st = db()->prepare('SELECT i.*, o.number FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.id = ?');
    $st->execute([$itemId]);
    $r = $st->fetch();
    if (!$r) fail('not_found', 404);
    $photoId = $isBack ? $r['back_photo_id'] : $r['photo_id'];
    $thumbPath = $isBack ? $r['back_thumb_path'] : $r['thumb_path'];
    $cropJson = $isBack ? $r['back_crop_json'] : $r['crop_json'];
    $base = $r['number'] . '-' . $r['id'] . '-' . $r['size'] . ($isBack ? '-BACK' : ($r['back_photo_id'] ? '-FRONT' : ''));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=3600');
    if ($kind === 'thumb') {
        $f = $thumbPath ? data_dir() . '/' . $thumbPath : '';
        if (!$f || !is_file($f)) fail('not_found', 404);
        header('Content-Type: image/jpeg');
        readfile($f);
        exit;
    }
    $p = null;
    if ($photoId) { $ps = db()->prepare('SELECT path, mime FROM photos WHERE id = ?'); $ps->execute([$photoId]); $p = $ps->fetch(); }
    if (!$p || !is_file(data_dir() . '/' . $p['path'])) fail('not_found', 404);
    if ($kind === 'original') {
        $ext = ALLOWED_MIME[$p['mime']] ?? 'bin';
        header('Content-Type: ' . $p['mime']);
        header('Content-Disposition: attachment; filename="' . $base . '-original.' . $ext . '"');
        header('Content-Length: ' . filesize(data_dir() . '/' . $p['path']));
        readfile(data_dir() . '/' . $p['path']);
        exit;
    }
    if ($kind === 'print') {
        $jpg = make_print_file($p, json_decode((string) $cropJson, true) ?: []);
        if ($jpg === null) fail('print_file_failed', 500);
        header('Content-Type: image/jpeg');
        header('Content-Disposition: attachment; filename="' . $base . '-' . $r['orientation'] . '-print.jpg"');
        header('Content-Length: ' . strlen($jpg));
        echo $jpg;
        exit;
    }
    fail('bad_kind');
}

function action_export(): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="orders-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Number', 'Created', 'Status', 'Payment', 'Name', 'Email', 'Phone', 'Street', 'City', 'Postal', 'Country', 'Carrier', 'Delivery', 'Pickup', 'Items', 'Prints EUR', 'Shipping EUR', 'Total EUR', 'Comment', 'Note']);
    $pdo = db();
    $items = $pdo->prepare('SELECT size, qty, back_photo_id FROM order_items WHERE order_id = ? ORDER BY id');
    foreach ($pdo->query('SELECT * FROM orders ORDER BY created_at DESC') as $o) {
        $items->execute([$o['id']]);
        $list = implode('; ', array_map(fn($i) => $i['size'] . ' x' . $i['qty'] . ($i['back_photo_id'] ? ' (2-sided)' : ''), $items->fetchAll()));
        // customer-entered text is prefixed so spreadsheet apps never treat it as a formula
        $safe = fn($v) => (is_string($v) && $v !== '' && strpbrk($v[0], "=+-@\t\r") !== false) ? "'" . $v : $v;
        fputcsv($out, array_map($safe, [
            $o['number'], date('Y-m-d H:i', (int) $o['created_at']), $o['status'], $o['payment_status'], $o['name'], $o['email'], $o['phone'],
            $o['street'], $o['city'], $o['postal'], $o['country'], $o['carrier'], $o['delivery'], trim(($o['pickup_name'] ?? '') . ' ' . ($o['pickup_address'] ?? '')),
            $list, money((int) $o['subtotal_cents']), $o['shipping_cents'] !== null ? money((int) $o['shipping_cents']) : '', $o['total_cents'] !== null ? money((int) $o['total_cents']) : '',
            $o['comment'], $o['admin_note'],
        ]));
    }
    fclose($out);
    exit;
}
