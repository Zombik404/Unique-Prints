#!/usr/bin/env bash
# Unique prints — update a running site on Ubuntu from this folder (a git clone of the repository).
#
#   sudo bash deploy.sh /var/www/your-site
#
# What it does:
#   1. backs up the whole current site (including orders and photos) to /root/uniqueprints-backups/
#   2. copies the new site files over it, NEVER touching data/ (orders, photos, database)
#   3. builds the new api/config.php, keeping the server's own settings from the old one
#      (admin password, Telegram, e-mail, site address, data folder)
#   4. gives styles/scripts/pictures a new ?v= version so browsers don't show cached old files
#   5. checks PHP syntax, fixes permissions of data/, reloads the web server
# If anything fails, the site is restored from the backup automatically.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-}"

say()  { printf '\033[1;33m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run it with sudo:  sudo bash $0 /path/to/site"
[ -n "$DEST" ] || die "Give the site folder:  sudo bash $0 /var/www/your-site"
DEST="$(cd "$DEST" 2>/dev/null && pwd)" || die "Folder not found: $1"
[ "$DEST" != "$SRC" ] || die "The site folder must be different from this download folder."
[ -f "$DEST/api/config.php" ] && [ -f "$DEST/create.html" ] || die "$DEST does not look like the Unique prints site (no api/config.php or create.html)."
[ -f "$SRC/api/config.php" ] && [ -f "$SRC/assets/js/mug3d.js" ] || die "Run this script from the downloaded new version."
command -v php >/dev/null || die "PHP is not installed."
command -v rsync >/dev/null || die "rsync is missing:  sudo apt install -y rsync"
php -r 'exit(PHP_VERSION_ID >= 80000 ? 0 : 1);' || die "PHP 8.0 or newer is needed (now: $(php -r 'echo PHP_VERSION;'))."

# web server user that must be able to write data/
OWNER="$(stat -c '%U' "$DEST/data" 2>/dev/null || echo www-data)"
[ "$OWNER" = "root" ] && OWNER="www-data"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=/root/uniqueprints-backups
BACKUP="$BACKUP_DIR/site-$STAMP.tar.gz"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"

say "Backing up $DEST"
tar -czf "$BACKUP" -C "$DEST" .
ok "Backup: $BACKUP ($(du -h "$BACKUP" | cut -f1))"

restore() {
  printf '\033[1;31m✗ Update failed, restoring the backup…\033[0m\n' >&2
  find "$DEST" -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
  tar -xzf "$BACKUP" -C "$DEST" --exclude=./data
  printf '\033[1;31m✗ Site restored to the previous version. Nothing in data/ was changed.\033[0m\n' >&2
}
trap restore ERR

say "Building the new config.php with this server's settings"
NEWCFG="$(mktemp)"
php -d display_errors=stderr -r '
  [$oldFile, $newFile, $out] = array_slice($argv, 1);
  $old = include $oldFile;
  if (!is_array($old)) { fwrite(STDERR, "old config.php did not return settings\n"); exit(1); }
  $new = file_get_contents($newFile);
  // keep these from the server (secrets and server-specific values)
  foreach (["admin_password", "telegram_operator", "telegram_bot_token", "telegram_chat_id", "notify_email", "site_url"] as $k) {
    if (!array_key_exists($k, $old)) continue;
    $val = var_export((string) $old[$k], true);
    $new = preg_replace_callback("/(\x27" . $k . "\x27\s*=>\s*)\x27(?:[^\x27\\\\]|\\\\.)*\x27/", fn($m) => $m[1] . $val, $new, 1, $n);
    if ($n !== 1) { fwrite(STDERR, "could not set $k\n"); exit(1); }
  }
  // a custom data folder (outside public_html) is kept too
  if (isset($old["data_dir"]) && realpath($old["data_dir"]) && realpath($old["data_dir"]) !== realpath(dirname($oldFile) . "/../data")) {
    $new = preg_replace_callback("/(\x27data_dir\x27\s*=>\s*)[^,\n]+/", fn($m) => $m[1] . var_export(realpath($old["data_dir"]), true), $new, 1);
  }
  file_put_contents($out, $new);
' "$DEST/api/config.php" "$SRC/api/config.php" "$NEWCFG"
php -l "$NEWCFG" >/dev/null
php -r '$c = include $argv[1]; exit(strlen((string) $c["admin_password"]) >= 10 ? 0 : 1);' "$NEWCFG" \
  || die "The admin password from the old config.php is shorter than 10 characters — set a longer one in $DEST/api/config.php first."
ok "config.php ready (password, Telegram, e-mail and site address kept)"

say "Copying the new site files (data/ is not touched)"
rsync -a --delete \
  --exclude '/data/' --exclude '/api/config.php' \
  --exclude '/.git/' --exclude '/.github/' --exclude '/deploy.sh' --exclude '/dev-router.php' --exclude '/Claude outputs/' \
  "$SRC/" "$DEST/"
# new version number in the addresses of styles, scripts and pictures, so visitors' browsers
# fetch the new files instead of showing old ones from their cache
VER="$(date +%Y%m%d%H%M%S)"
find "$DEST" -path "$DEST/data" -prune -o -type f \( -name '*.html' -o -path "$DEST/assets/js/app.js" \) -print0 \
  | xargs -0 sed -i -E "s/\?v=[0-9]{8,14}/?v=$VER/g"
install -m 640 -o root -g "$OWNER" "$NEWCFG" "$DEST/api/config.php"
rm -f "$NEWCFG"
# data/ keeps its contents; only make sure the protection files exist and the web server can write there
mkdir -p "$DEST/data/uploads"
[ -f "$DEST/data/.htaccess" ] || cp "$SRC/data/.htaccess" "$DEST/data/.htaccess"
[ -f "$DEST/data/uploads/.htaccess" ] || cp "$SRC/data/uploads/.htaccess" "$DEST/data/uploads/.htaccess"
chown -R "$OWNER":"$OWNER" "$DEST/data"
find "$DEST" -path "$DEST/data" -prune -o -type d -exec chmod 755 {} +
find "$DEST" -path "$DEST/data" -prune -o -type f ! -path "$DEST/api/config.php" -exec chmod 644 {} +
ok "Files copied"

say "Checking PHP files"
for f in "$DEST"/api/*.php; do php -l "$f" >/dev/null; done
ok "PHP syntax OK"

trap - ERR

say "Reloading the web server (clears PHP's code cache)"
reloaded=""
for svc in apache2 $(systemctl list-units --type=service --no-legend 'php*-fpm*' 2>/dev/null | awk '{print $1}') nginx; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then systemctl reload "$svc" && reloaded="$reloaded $svc"; fi
done
ok "Reloaded:${reloaded:- nothing found (reload your web server yourself)}"

echo
ok "Done. Open your site and the admin panel (/admin/) to check."
echo "   To undo:  sudo tar -xzf $BACKUP -C $DEST"
