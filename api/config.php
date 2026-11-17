<?php
/**
 * Unique prints — settings.
 * Edit this file after uploading the site to your hosting.
 */
return [
    // ── Admin panel ─────────────────────────────────────────────────────
    // Password for /admin. Use at least 10 characters.
    // You can paste a plain password, or a bcrypt hash (starts with $2y$) made with:
    //   php -r "echo password_hash('your-password', PASSWORD_DEFAULT);"
    // While this is empty, the admin panel stays locked.
    'admin_password' => '',

    // ── Contacts ────────────────────────────────────────────────────────
    // Telegram username of the operator (without @). Used for the button on the order page.
    'telegram_operator' => 'UniqueOper',

    // ── New order notifications (optional) ─────────────────────────────
    // Telegram bot: create one with @BotFather, paste the token here,
    // then write any message to the bot and put your chat id below
    // (you can get it from @userinfobot). Leave empty to switch off.
    'telegram_bot_token' => '',
    'telegram_chat_id'   => '',
    // E-mail for new order notifications (uses PHP mail()). Leave empty to switch off.
    'notify_email' => '',
    // Public address of your site, used in links inside notifications, e.g. https://uniqueprints.com
    'site_url' => '',

    // ── Prices (EUR) ────────────────────────────────────────────────────
    'currency' => 'EUR',
    'sizes' => [
        ['id' => 'A3',   'w' => 297,  'h' => 420,   'price' => 40.00],
        ['id' => 'A4',   'w' => 210,  'h' => 297,   'price' => 29.00],
        ['id' => 'A5',   'w' => 148,  'h' => 210,   'price' => 20.00],
        ['id' => 'A6',   'w' => 105,  'h' => 148,   'price' => 15.00],
        ['id' => 'CR80', 'w' => 85.6, 'h' => 53.98, 'price' => 2.99],
    ],

    // ── Display currency per site language ─────────────────────────────
    // Prices are set and paid in EUR (above). Visitors see them converted into
    // the currency of the language they picked; checkout also shows the EUR amount.
    // Use 'EUR' for a language to show euros without conversion.
    'display_currencies' => ['en' => 'USD', 'hu' => 'HUF', 'de' => 'EUR', 'uk' => 'UAH', 'ru' => 'RUB'],
    // Exchange rates are fetched from this address once a day (free, no key needed)
    // and kept in data/fx.json. If the address cannot be reached, the last saved
    // rates are used, and if there are none yet, the rates below (1 EUR = ...).
    'fx_url' => 'https://open.er-api.com/v6/latest/EUR',
    'fx_fallback' => ['USD' => 1.10, 'HUF' => 365, 'UAH' => 50.2, 'RUB' => 91.1],

    // Printing on the back of the plate costs this percent of the format price (for the material used).
    'back_side_percent' => 50,

    // ── Shipping: which carriers are offered in which country ──────────
    // Countries that are not listed do not appear at checkout.
    'shipping' => (function () {
        $all = ['DPD', 'DHL', 'UPS', 'GLS'];
        $eu = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
        $countries = [];
        foreach ($eu as $c) $countries[$c] = $all;
        $countries['CH'] = $all;
        $countries['NO'] = $all;
        $countries['GB'] = ['DPD', 'DHL', 'UPS'];
        return ['countries' => $countries, 'defaultCarriers' => $all, 'maxQuote' => 1000];
    })(),

    // ── Storage ─────────────────────────────────────────────────────────
    // Folder for the database and uploaded photos. For extra safety you can
    // move it outside public_html and change this path.
    'data_dir' => __DIR__ . '/../data',
    'max_upload_mb' => 20,
    // Minimum photo size in pixels (works for both portrait and landscape photos).
    'min_photo_long' => 1920,
    'min_photo_short' => 1080,
    // Uploaded photos that never became part of an order are removed after this many days.
    'orphan_photo_days' => 3,
];
