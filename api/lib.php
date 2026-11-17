<?php
/** Unique prints — shared backend helpers (database, validation, images). */

declare(strict_types=1);

if (!defined('UP_APP')) { http_response_code(403); exit; }

const STATUSES = ['awaiting_quote', 'awaiting_payment', 'paid', 'in_production', 'shipped', 'completed', 'cancelled'];
// only finished orders can be cleaned up from the disk-space screen
const CLEANUP_STATUSES = ['completed', 'cancelled', 'shipped'];
const ALLOWED_MIME = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

function cfg(?string $key = null)
{
    static $c = null;
    if ($c === null) $c = require __DIR__ . '/config.php';
    return $key === null ? $c : ($c[$key] ?? null);
}

function data_dir(string $sub = ''): string
{
    $d = rtrim((string) cfg('data_dir'), '/');
    $path = $sub === '' ? $d : $d . '/' . $sub;
    if (!is_dir($path)) @mkdir($path, 0775, true);
    return $path;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $pdo = new PDO('sqlite:' . data_dir() . '/shop.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        path TEXT NOT NULL,
        mime TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        original_name TEXT,
        ip TEXT,
        order_id INTEGER,
        created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photos_order ON photos(order_id);
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT NOT NULL UNIQUE,
        token_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'awaiting_quote',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        lang TEXT,
        name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
        street TEXT NOT NULL, city TEXT NOT NULL, postal TEXT NOT NULL, country TEXT NOT NULL,
        carrier TEXT NOT NULL, delivery TEXT NOT NULL, pickup_name TEXT, pickup_address TEXT,
        comment TEXT,
        subtotal_cents INTEGER NOT NULL,
        shipping_cents INTEGER,
        total_cents INTEGER,
        quote_at INTEGER,
        paid_at INTEGER,
        admin_note TEXT,
        ip TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        photo_id TEXT NOT NULL,
        file_name TEXT,
        size TEXT NOT NULL,
        orientation TEXT NOT NULL,
        qty INTEGER NOT NULL,
        unit_cents INTEGER NOT NULL,
        line_cents INTEGER NOT NULL,
        crop_json TEXT NOT NULL,
        dpi INTEGER,
        thumb_path TEXT
    );
    CREATE INDEX IF NOT EXISTS items_order ON order_items(order_id);
    CREATE TABLE IF NOT EXISTS order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        at INTEGER NOT NULL,
        kind TEXT NOT NULL,
        detail TEXT
    );
    CREATE TABLE IF NOT EXISTS hits (
        ip TEXT NOT NULL,
        kind TEXT NOT NULL,
        at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hits_ip ON hits(ip, kind, at);
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    );
    ");
    // two-sided printing (added later; older databases get the columns on first run)
    $have = array_column($pdo->query('PRAGMA table_info(order_items)')->fetchAll(), 'name');
    $add = ['back_photo_id' => 'TEXT', 'back_file_name' => 'TEXT', 'back_crop_json' => 'TEXT', 'back_dpi' => 'INTEGER', 'back_thumb_path' => 'TEXT', 'back_cents' => 'INTEGER NOT NULL DEFAULT 0'];
    foreach ($add as $col => $type) if (!in_array($col, $have, true)) $pdo->exec("ALTER TABLE order_items ADD COLUMN $col $type");
    $haveO = array_column($pdo->query('PRAGMA table_info(orders)')->fetchAll(), 'name');
    if (!in_array('photos_purged_at', $haveO, true)) $pdo->exec('ALTER TABLE orders ADD COLUMN photos_purged_at INTEGER');
}

// ---------- HTTP helpers ----------
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $error, int $code = 400): void { json_out(['error' => $error], $code); }

function body_json(int $maxBytes = 8_000_000): array
{
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) fail('err.generic', 413);
    $d = json_decode($raw, true);
    if (!is_array($d)) fail('err.generic');
    return $d;
}

function client_ip(): string { return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }

/** Simple per-IP limiter. Returns false when the limit is exceeded. */
function rate_ok(string $kind, int $max, int $windowSec): bool
{
    $pdo = db();
    $now = time();
    $ip = client_ip();
    $pdo->prepare('DELETE FROM hits WHERE at < ?')->execute([$now - 86400]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM hits WHERE ip = ? AND kind = ? AND at > ?');
    $st->execute([$ip, $kind, $now - $windowSec]);
    if ((int) $st->fetchColumn() >= $max) return false;
    $pdo->prepare('INSERT INTO hits (ip, kind, at) VALUES (?, ?, ?)')->execute([$ip, $kind, $now]);
    return true;
}

function rand_hex(int $bytes): string { return bin2hex(random_bytes($bytes)); }
function hash_token(string $t): string { return hash('sha256', $t); }

function str_field($v, int $max, bool $required = true): ?string
{
    $s = is_string($v) ? trim(preg_replace('/[\x00-\x1F\x7F]/u', ' ', $v) ?? '') : '';
    if ($s === '') { if ($required) return null; return ''; }
    if (mb_strlen($s) > $max) $s = mb_substr($s, 0, $max);
    return $s;
}

// ---------- settings changed from the admin panel (stored in the database) ----------
function setting(string $key)
{
    $st = db()->prepare('SELECT value FROM settings WHERE key = ?');
    $st->execute([$key]);
    $v = $st->fetchColumn();
    return $v === false ? null : json_decode((string) $v, true);
}
function setting_time(string $key): ?int
{
    $st = db()->prepare('SELECT updated_at FROM settings WHERE key = ?');
    $st->execute([$key]);
    $v = $st->fetchColumn();
    return $v === false ? null : (int) $v;
}
function set_setting(string $key, $value): void
{
    if ($value === null) { db()->prepare('DELETE FROM settings WHERE key = ?')->execute([$key]); return; }
    db()->prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        ->execute([$key, json_encode($value), time()]);
}

// Formats with their current price in EUR: the price set in the admin panel, or the one from config.php.
function price_sizes(): array
{
    $over = setting('prices');
    $out = [];
    foreach (cfg('sizes') as $s) {
        $s['type'] = ($s['type'] ?? '') === 'mug' ? 'mug' : 'plate';
        $s['default_price'] = (float) $s['price'];
        if (is_array($over) && isset($over[$s['id']]) && is_numeric($over[$s['id']])) $s['price'] = (float) $over[$s['id']];
        $s['price'] = (float) $s['price'];
        $out[] = $s;
    }
    return $out;
}
// Surcharge for printing the back side, in percent of the format price.
function back_percent(): float
{
    $v = setting('back_percent');
    return is_numeric($v) ? (float) $v : (float) (cfg('back_side_percent') ?? 50);
}

function sizes_by_id(): array
{
    $out = [];
    foreach (price_sizes() as $s) $out[$s['id']] = $s;
    return $out;
}

function money(int $cents): string { return number_format($cents / 100, 2, '.', ''); }

// ---------- exchange rates (display only; prices and payments stay in EUR) ----------

// Which currency each site language shows.
function display_currencies(): array
{
    $map = cfg('display_currencies');
    return is_array($map) ? $map : ['en' => 'EUR', 'hu' => 'EUR', 'de' => 'EUR', 'uk' => 'EUR', 'ru' => 'EUR'];
}

// Rates as "1 EUR = x", refreshed at most once a day and cached in data/fx.json.
// Never throws: on any failure it returns the last saved rates or the fallback from config.
function fx_rates(): array
{
    $need = array_values(array_unique(array_filter(display_currencies(), fn($c) => $c !== 'EUR')));
    $file = data_dir() . '/fx.json';
    $cached = is_file($file) ? json_decode((string) @file_get_contents($file), true) : null;
    if (!is_array($cached) || !is_array($cached['rates'] ?? null)) $cached = null;
    $fresh_enough = $cached && ($cached['need'] ?? null) === $need && time() - (int) ($cached['checked'] ?? 0) < 86400;

    if (!$fresh_enough) {
        $lock = @fopen($file . '.lock', 'c');
        if ($lock && flock($lock, LOCK_EX | LOCK_NB)) {
            $fresh = fx_fetch($need);
            if ($fresh) {
                $cached = $fresh + ['need' => $need];
            } else {
                // source unreachable: keep what we have (or nothing, so the config fallback is used)
                // and try again in an hour instead of on every page view
                $cached = ['rates' => $cached['rates'] ?? [], 'date' => $cached['date'] ?? null, 'checked' => time() - 86400 + 3600, 'need' => $need];
            }
            $tmp = $file . '.tmp';
            if (@file_put_contents($tmp, json_encode($cached)) !== false) @rename($tmp, $file);
            flock($lock, LOCK_UN);
        }
        if ($lock) fclose($lock);
    }

    $rates = $cached['rates'] ?? [];
    foreach ((array) cfg('fx_fallback') as $c => $r) if (!isset($rates[$c]) && is_numeric($r) && $r > 0) $rates[$c] = (float) $r;
    return ['rates' => $rates, 'date' => $cached['date'] ?? null, 'checked' => $cached['checked'] ?? 0];
}

function fx_fetch(array $need): ?array
{
    $url = (string) cfg('fx_url');
    if ($url === '' || !$need) return null;
    $raw = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_FOLLOWLOCATION => true]);
        $raw = curl_exec($ch);
        if (curl_getinfo($ch, CURLINFO_HTTP_CODE) !== 200) $raw = false;
        curl_close($ch);
    } else {
        $raw = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 6]]));
    }
    $d = $raw ? json_decode($raw, true) : null;
    if (!is_array($d) || ($d['result'] ?? '') !== 'success' || !is_array($d['rates'] ?? null)) return null;
    $rates = [];
    foreach ($need as $c) {
        $r = $d['rates'][$c] ?? null;
        if (!is_numeric($r) || $r <= 0) return null;
        $rates[$c] = (float) $r;
    }
    return ['rates' => $rates, 'date' => (int) ($d['time_last_update_unix'] ?? time()), 'checked' => time()];
}

function new_order_number(PDO $pdo): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($i = 0; $i < 20; $i++) {
        $suffix = '';
        for ($k = 0; $k < 4; $k++) $suffix .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $n = 'UP-' . date('ymd') . '-' . $suffix;
        $st = $pdo->prepare('SELECT 1 FROM orders WHERE number = ?');
        $st->execute([$n]);
        if (!$st->fetchColumn()) return $n;
    }
    throw new RuntimeException('Could not create order number');
}

function add_event(int $orderId, string $kind, string $detail = ''): void
{
    db()->prepare('INSERT INTO order_events (order_id, at, kind, detail) VALUES (?, ?, ?, ?)')->execute([$orderId, time(), $kind, $detail]);
}

// ---------- cleanup ----------
function cleanup_orphans(): void
{
    $days = (int) (cfg('orphan_photo_days') ?: 3);
    $pdo = db();
    $st = $pdo->prepare('SELECT id, path FROM photos WHERE order_id IS NULL AND created_at < ?');
    $st->execute([time() - $days * 86400]);
    foreach ($st->fetchAll() as $p) {
        @unlink(data_dir() . '/' . $p['path']);
        $pdo->prepare('DELETE FROM photos WHERE id = ?')->execute([$p['id']]);
    }
}

// ---------- images ----------
function gd_load(string $file, string $mime)
{
    @ini_set('memory_limit', '1024M');
    switch ($mime) {
        case 'image/jpeg': $im = @imagecreatefromjpeg($file); break;
        case 'image/png': $im = @imagecreatefrompng($file); break;
        case 'image/webp': $im = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($file) : false; break;
        default: $im = false;
    }
    if (!$im) return false;
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($file);
        $o = (int) ($exif['Orientation'] ?? 1);
        if ($o === 3) $im = imagerotate($im, 180, 0);
        elseif ($o === 6) $im = imagerotate($im, -90, 0);
        elseif ($o === 8) $im = imagerotate($im, 90, 0);
        elseif (in_array($o, [2, 4, 5, 7], true)) {
            if ($o === 5 || $o === 7) $im = imagerotate($im, $o === 5 ? -90 : 90, 0);
            imageflip($im, $o === 4 ? IMG_FLIP_VERTICAL : IMG_FLIP_HORIZONTAL);
        }
    }
    return $im;
}

/** Produce the cropped print file (JPEG, full resolution of the chosen area). */
function make_print_file(array $photo, array $crop): ?string
{
    if (!function_exists('imagecreatetruecolor')) return null;
    $src = data_dir() . '/' . $photo['path'];
    $im = gd_load($src, $photo['mime']);
    if (!$im) return null;
    $W = imagesx($im); $H = imagesy($im);
    $x = (int) round(max(0, min(1, (float) $crop['x'])) * $W);
    $y = (int) round(max(0, min(1, (float) $crop['y'])) * $H);
    $w = (int) round(max(0.001, min(1, (float) $crop['w'])) * $W);
    $h = (int) round(max(0.001, min(1, (float) $crop['h'])) * $H);
    $w = min($w, $W - $x); $h = min($h, $H - $y);
    $out = imagecreatetruecolor($w, $h);
    imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
    imagecopy($out, $im, 0, 0, $x, $y, $w, $h);
    imagedestroy($im);
    ob_start();
    imagejpeg($out, null, 95);
    imagedestroy($out);
    return (string) ob_get_clean();
}

// ---------- notifications ----------
function notify_new_order(array $order, array $items): void
{
    $lines = [];
    foreach ($items as $it) $lines[] = '• ' . ((sizes_by_id()[$it['size']]['type'] ?? '') === 'mug' ? 'Кружка ' . $it['size'] : $it['size']) . ' × ' . $it['qty'] . (!empty($it['back']) ? ' (двусторонняя)' : '') . ' — €' . money((int) $it['line_cents']);
    $site = rtrim((string) cfg('site_url'), '/');
    $text = "🆕 Новый заказ {$order['number']}\n"
        . "{$order['name']} · {$order['country']} · {$order['carrier']} (" . ($order['delivery'] === 'pickup' ? 'пункт выдачи' : 'домой') . ")\n"
        . implode("\n", $lines) . "\n"
        . 'Принты: €' . money((int) $order['subtotal_cents']) . ' + доставка (нужно рассчитать)'
        . ($site ? "\n{$site}/admin/#order/{$order['number']}" : '');

    $token = (string) cfg('telegram_bot_token');
    $chat = (string) cfg('telegram_chat_id');
    if ($token !== '' && $chat !== '') {
        $url = 'https://api.telegram.org/bot' . $token . '/sendMessage';
        $payload = http_build_query(['chat_id' => $chat, 'text' => $text, 'disable_web_page_preview' => 'true']);
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6]);
            @curl_exec($ch);
            curl_close($ch);
        } else {
            @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'POST', 'header' => 'Content-Type: application/x-www-form-urlencoded', 'content' => $payload, 'timeout' => 6]]));
        }
    }
    $mail = (string) cfg('notify_email');
    if ($mail !== '' && function_exists('mail')) {
        @mail($mail, '=?UTF-8?B?' . base64_encode('Новый заказ ' . $order['number']) . '?=', $text, "Content-Type: text/plain; charset=UTF-8\r\n");
    }
}

// ---------- storage ----------
function dir_bytes(string $dir): array
{
    $bytes = 0; $files = 0;
    if (!is_dir($dir)) return [0, 0];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) { if ($f->isFile() && $f->getFilename() !== '.htaccess') { $bytes += $f->getSize(); $files++; } }
    return [$bytes, $files];
}

/** Removes the original photos of one order from disk (the order itself and its small previews stay). */
function purge_order_photos(int $orderId): int
{
    $pdo = db();
    $freed = 0;
    $ph = $pdo->prepare('SELECT id, path FROM photos WHERE order_id = ?');
    $ph->execute([$orderId]);
    foreach ($ph->fetchAll() as $p) {
        $f = data_dir() . '/' . $p['path'];
        if (is_file($f)) { $freed += (int) filesize($f); @unlink($f); }
    }
    $pdo->prepare('DELETE FROM photos WHERE order_id = ?')->execute([$orderId]);
    $pdo->prepare('UPDATE orders SET photos_purged_at = ? WHERE id = ?')->execute([time(), $orderId]);
    return $freed;
}

/** Deletes one order completely: original photos, previews and all records. */
function delete_order_fully(int $orderId): int
{
    $freed = purge_order_photos($orderId);
    $dir = data_dir() . '/thumbs/' . $orderId;
    if (is_dir($dir)) { foreach (glob($dir . '/*') ?: [] as $f) { $freed += (int) filesize($f); @unlink($f); } @rmdir($dir); }
    db()->prepare('DELETE FROM orders WHERE id = ?')->execute([$orderId]);
    return $freed;
}
