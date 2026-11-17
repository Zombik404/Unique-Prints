<?php
/** Unique prints — public API: catalogue, photo upload, order creation, order status. */

declare(strict_types=1);
define('UP_APP', true);
require __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'catalogue': action_catalogue(); break;
        case 'upload': action_upload(); break;
        case 'order': action_order(); break;
        case 'order_status': action_order_status(); break;
        default: fail('not_found', 404);
    }
} catch (Throwable $e) {
    error_log('[uniqueprints] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail('err.generic', 500);
}

function action_catalogue(): void
{
    $sizes = array_map(fn($s) => ['id' => $s['id'], 'w' => $s['w'], 'h' => $s['h'], 'price' => (float) $s['price']], cfg('sizes'));
    header('Cache-Control: public, max-age=300');
    json_out([
        'sizes' => $sizes,
        'currency' => cfg('currency'),
        'telegram' => cfg('telegram_operator'),
        'backPercent' => (float) (cfg('back_side_percent') ?? 50),
        'shipping' => ['countries' => cfg('shipping')['countries'], 'defaultCarriers' => cfg('shipping')['defaultCarriers']],
        'fx' => (function () { $fx = fx_rates(); return ['base' => 'EUR', 'currencies' => display_currencies(), 'rates' => (object) $fx['rates'], 'date' => $fx['date']]; })(),
    ]);
}

function action_upload(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
    if (!rate_ok('upload', 80, 3600)) fail('Too many uploads. Please try again later.', 429);
    $f = $_FILES['photo'] ?? null;
    if (!$f || !is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        $code = is_array($f) ? (int) $f['error'] : UPLOAD_ERR_NO_FILE;
        fail(in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'err.big' : 'err.upload');
    }
    $max = (int) cfg('max_upload_mb') * 1024 * 1024;
    if ((int) $f['size'] > $max) fail('err.big');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
    if (!isset(ALLOWED_MIME[$mime])) fail('err.type');
    $info = @getimagesize($f['tmp_name']);
    if (!$info || $info[0] < 1 || $info[1] < 1) fail('err.read');
    $minLong = (int) (cfg('min_photo_long') ?: 1920); $minShort = (int) (cfg('min_photo_short') ?: 1080);
    if (max($info[0], $info[1]) < $minLong || min($info[0], $info[1]) < $minShort) fail('err.small');

    $id = rand_hex(12);
    $token = rand_hex(16);
    $rel = 'uploads/' . date('Y/m') . '/' . $id . '.' . ALLOWED_MIME[$mime];
    data_dir('uploads/' . date('Y/m'));
    if (!move_uploaded_file($f['tmp_name'], data_dir() . '/' . $rel)) fail('err.upload', 500);
    @chmod(data_dir() . '/' . $rel, 0640);

    db()->prepare('INSERT INTO photos (id, token_hash, path, mime, bytes, width, height, original_name, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        ->execute([$id, hash_token($token), $rel, $mime, (int) $f['size'], (int) $info[0], (int) $info[1], mb_substr((string) $f['name'], 0, 160), client_ip(), time()]);

    if (random_int(1, 20) === 1) cleanup_orphans();
    json_out(['id' => $id, 'token' => $token]);
}

function action_order(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
    if (!rate_ok('order', 15, 3600)) fail('Too many orders from this connection. Please try again later.', 429);
    $d = body_json();
    $pdo = db();

    $c = $d['customer'] ?? []; $a = $d['address'] ?? []; $s = $d['shipping'] ?? [];
    $name = str_field($c['name'] ?? null, 120);
    $email = str_field($c['email'] ?? null, 160);
    $phone = str_field($c['phone'] ?? null, 40);
    $street = str_field($a['street'] ?? null, 200);
    $city = str_field($a['city'] ?? null, 100);
    $postal = str_field($a['postal'] ?? null, 20);
    $country = strtoupper((string) ($a['country'] ?? ''));
    $carrier = (string) ($s['carrier'] ?? '');
    $delivery = (string) ($s['delivery'] ?? '');
    $pickupName = str_field($s['pickupName'] ?? null, 160, false);
    $pickupAddress = str_field($s['pickupAddress'] ?? null, 240, false);
    $comment = str_field($d['comment'] ?? null, 1000, false);
    $lang = in_array($d['lang'] ?? '', ['en', 'hu', 'de', 'uk', 'ru'], true) ? $d['lang'] : 'en';

    if (!$name || !$email || !$phone || !$street || !$city || !$postal) fail('co.required');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('co.emailInvalid');
    $countries = cfg('shipping')['countries'];
    if (!isset($countries[$country]) || !in_array($carrier, $countries[$country], true)) fail('co.required');
    if (!in_array($delivery, ['home', 'pickup'], true)) fail('co.required');
    if ($delivery === 'pickup' && (!$pickupName || !$pickupAddress)) fail('co.required');
    if ($delivery === 'home') { $pickupName = null; $pickupAddress = null; }

    $items = $d['items'] ?? [];
    if (!is_array($items) || count($items) < 1 || count($items) > 50) fail('err.generic');
    $sizes = sizes_by_id();
    $clean = []; $subtotal = 0; $photoIds = [];
    foreach ($items as $it) {
        $size = (string) ($it['size'] ?? '');
        if (!isset($sizes[$size])) fail('err.generic');
        $qty = (int) ($it['qty'] ?? 0);
        if ($qty < 1 || $qty > 50) fail('err.generic');
        $orientation = ($it['orientation'] ?? '') === 'landscape' ? 'landscape' : 'portrait';
        $front = clean_side($it, $pdo);
        $back = !empty($it['back']) && is_array($it['back']) ? clean_side($it['back'], $pdo) : null;

        $base = (int) round($sizes[$size]['price'] * 100);
        $backCents = $back ? (int) round($base * (float) (cfg('back_side_percent') ?? 50) / 100) : 0;
        $unit = $base + $backCents;
        $line = $unit * $qty;
        $subtotal += $line;
        $photoIds[$front['photo_id']] = true;
        if ($back) $photoIds[$back['photo_id']] = true;
        $clean[] = [
            'photo_id' => $front['photo_id'], 'file_name' => $front['file_name'], 'size' => $size, 'orientation' => $orientation,
            'qty' => $qty, 'unit_cents' => $unit, 'line_cents' => $line, 'crop_json' => $front['crop_json'],
            'dpi' => $front['dpi'], 'thumb' => $front['thumb'], 'back' => $back, 'back_cents' => $backCents,
        ];
    }

    $token = rand_hex(16);
    $now = time();
    $pdo->beginTransaction();
    try {
        $number = new_order_number($pdo);
        $pdo->prepare('INSERT INTO orders (number, token_hash, status, payment_status, lang, name, email, phone, street, city, postal, country, carrier, delivery, pickup_name, pickup_address, comment, subtotal_cents, ip, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$number, hash_token($token), 'awaiting_quote', 'unpaid', $lang, $name, $email, $phone, $street, $city, $postal, $country, $carrier, $delivery, $pickupName, $pickupAddress, $comment, $subtotal, client_ip(), $now, $now]);
        $orderId = (int) $pdo->lastInsertId();
        $thumbDir = 'thumbs/' . $orderId;
        $ins = $pdo->prepare('INSERT INTO order_items (order_id, photo_id, file_name, size, orientation, qty, unit_cents, line_cents, crop_json, dpi, thumb_path, back_photo_id, back_file_name, back_crop_json, back_dpi, back_thumb_path, back_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $saveThumb = function (?string $bin, string $name) use ($thumbDir): ?string {
            if ($bin === null) return null;
            data_dir($thumbDir);
            file_put_contents(data_dir() . '/' . $thumbDir . '/' . $name, $bin);
            return $thumbDir . '/' . $name;
        };
        foreach ($clean as $i => $it) {
            $thumbPath = $saveThumb($it['thumb'], ($i + 1) . '.jpg');
            $b = $it['back'];
            $backThumb = $b ? $saveThumb($b['thumb'], ($i + 1) . '-back.jpg') : null;
            $ins->execute([$orderId, $it['photo_id'], $it['file_name'], $it['size'], $it['orientation'], $it['qty'], $it['unit_cents'], $it['line_cents'], $it['crop_json'], $it['dpi'], $thumbPath,
                $b['photo_id'] ?? null, $b['file_name'] ?? null, $b['crop_json'] ?? null, $b['dpi'] ?? null, $backThumb, $it['back_cents']]);
        }
        $upd = $pdo->prepare('UPDATE photos SET order_id = ? WHERE id = ?');
        foreach (array_keys($photoIds) as $pid) $upd->execute([$orderId, $pid]);
        add_event($orderId, 'created', 'Order placed by customer');
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $order = ['number' => $number, 'name' => $name, 'country' => $country, 'carrier' => $carrier, 'delivery' => $delivery, 'subtotal_cents' => $subtotal];
    try { notify_new_order($order, $clean); } catch (Throwable $e) { error_log('[uniqueprints] notify: ' . $e->getMessage()); }

    json_out(['number' => $number, 'token' => $token]);
}

/** Checks one printed side (photo ownership, crop, preview thumbnail) and returns it cleaned. */
function clean_side(array $it, PDO $pdo): array
{
    $cr = $it['crop'] ?? [];
    $crop = [];
    foreach (['x', 'y', 'w', 'h'] as $k) {
        $v = $cr[$k] ?? null;
        if (!is_numeric($v) || $v < 0 || $v > 1) fail('err.generic');
        $crop[$k] = round((float) $v, 5);
    }
    if ($crop['w'] <= 0 || $crop['h'] <= 0 || $crop['x'] + $crop['w'] > 1.001 || $crop['y'] + $crop['h'] > 1.001) fail('err.generic');
    $pid = (string) ($it['photoId'] ?? '');
    $st = $pdo->prepare('SELECT * FROM photos WHERE id = ?');
    $st->execute([$pid]);
    $photo = $st->fetch();
    if (!$photo || !hash_equals($photo['token_hash'], hash_token((string) ($it['photoToken'] ?? ''))) || $photo['order_id'] !== null) {
        fail('Photo upload expired. Please remove this print from the cart and add it again.');
    }
    $thumb = null;
    $t = (string) ($it['thumb'] ?? '');
    if (strpos($t, 'data:image/jpeg;base64,') === 0 && strlen($t) < 400000) {
        $bin = base64_decode(substr($t, 23), true);
        if ($bin !== false && ($ti = @getimagesizefromstring($bin)) && $ti['mime'] === 'image/jpeg') $thumb = $bin;
    }
    return [
        'photo_id' => $pid, 'file_name' => str_field($it['fileName'] ?? '', 160, false), 'crop_json' => json_encode($crop),
        'dpi' => is_numeric($it['dpi'] ?? null) ? (int) $it['dpi'] : null, 'thumb' => $thumb,
    ];
}

function action_order_status(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
    if (!rate_ok('status', 120, 3600)) fail('Too many requests', 429);
    $d = body_json(10000);
    $st = db()->prepare('SELECT * FROM orders WHERE number = ?');
    $st->execute([(string) ($d['number'] ?? '')]);
    $o = $st->fetch();
    if (!$o || !hash_equals($o['token_hash'], hash_token((string) ($d['token'] ?? '')))) fail('ord.notFound', 404);
    $it = db()->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
    $it->execute([$o['id']]);
    $items = [];
    foreach ($it->fetchAll() as $row) {
        $thumb = null;
        if ($row['thumb_path'] && is_file(data_dir() . '/' . $row['thumb_path'])) $thumb = 'data:image/jpeg;base64,' . base64_encode((string) file_get_contents(data_dir() . '/' . $row['thumb_path']));
        $items[] = ['size' => $row['size'], 'orientation' => $row['orientation'], 'qty' => (int) $row['qty'], 'two_sided' => !empty($row['back_photo_id']), 'unit' => (int) $row['unit_cents'] / 100, 'line_total' => (int) $row['line_cents'] / 100, 'thumb' => $thumb];
    }
    json_out([
        'number' => $o['number'], 'status' => $o['status'], 'payment_status' => $o['payment_status'],
        'carrier' => $o['carrier'], 'delivery' => $o['delivery'],
        'subtotal' => (int) $o['subtotal_cents'] / 100,
        'shipping_cost' => $o['shipping_cents'] !== null ? (int) $o['shipping_cents'] / 100 : null,
        'total' => $o['total_cents'] !== null ? (int) $o['total_cents'] / 100 : null,
        'items' => $items, 'telegram' => cfg('telegram_operator'), 'created_at' => (int) $o['created_at'],
    ]);
}
