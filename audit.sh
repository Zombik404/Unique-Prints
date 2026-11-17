#!/usr/bin/env bash
# Unique prints — security check of the server and the site. READ-ONLY: it changes nothing.
#
#   bash audit.sh /var/www/uniqueprints uniqueprints.webhop.me
#
# Prints a report with [OK] / [WARN] / [FAIL] marks. Passwords and tokens are never printed,
# so the report can be sent for review.

SITE="${1:-/var/www/uniqueprints}"
DOMAIN="${2:-}"
[ -n "$DOMAIN" ] || DOMAIN="$(grep -hoE '^\s*ServerName\s+\S+' /etc/apache2/sites-enabled/*.conf 2>/dev/null | awk '{print $2}' | head -1)"

ok()   { printf '[OK]   %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*"; }
info() { printf '       %s\n' "$*"; }
head1(){ printf '\n=== %s ===\n' "$*"; }
has()  { command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo bash $0 ...) so all settings can be read."; exit 1; }
echo "Unique prints security audit — $(date -u '+%Y-%m-%d %H:%M UTC') — site: $SITE — domain: ${DOMAIN:-?}"

# ---------------------------------------------------------------- system
head1 "System and updates"
. /etc/os-release 2>/dev/null; info "OS: ${PRETTY_NAME:-?}, kernel $(uname -r), up $(uptime -p 2>/dev/null)"
if [ -f /var/run/reboot-required ]; then warn "A reboot is pending (new kernel or libraries are installed but not in use)"; else ok "No reboot pending"; fi
if has apt; then
  UPG="$(apt list --upgradable 2>/dev/null | grep -c upgradable)"; SEC="$(apt list --upgradable 2>/dev/null | grep -c -- '-security')"
  if [ "$SEC" -gt 0 ]; then fail "$SEC security updates waiting ($UPG updates in total)"; elif [ "$UPG" -gt 0 ]; then warn "$UPG updates waiting (no security ones)"; else ok "All packages up to date"; fi
fi
if dpkg -s unattended-upgrades >/dev/null 2>&1 && grep -qs '"1"' /etc/apt/apt.conf.d/20auto-upgrades; then ok "Automatic security updates are on"; else warn "Automatic security updates are off (unattended-upgrades)"; fi
DF="$(df -P "$SITE" 2>/dev/null | awk 'NR==2{print $5" used, "int($4/1024)" MB free"}')"; info "Disk: $DF"

# ---------------------------------------------------------------- accounts
head1 "Accounts"
U0="$(awk -F: '$3==0{print $1}' /etc/passwd | tr '\n' ' ')"; [ "$U0" = "root " ] && ok "Only root has full rights (uid 0)" || fail "Accounts with uid 0: $U0"
SHELLS="$(awk -F: '$7 !~ /(nologin|false|sync|halt|shutdown)$/ {print $1}' /etc/passwd | tr '\n' ' ')"; info "Accounts that can log in: $SHELLS"
NOPW="$(awk -F: '($2=="" ){print $1}' /etc/shadow 2>/dev/null | tr '\n' ' ')"; [ -z "$NOPW" ] && ok "No accounts without a password" || fail "Accounts WITHOUT a password: $NOPW"
[ -s /root/.ssh/authorized_keys ] && info "root has $(grep -c -E '^(ssh|ecdsa)-' /root/.ssh/authorized_keys) SSH key(s)" || info "root has no SSH keys (logs in with a password)"

# ---------------------------------------------------------------- ssh
head1 "SSH"
if has sshd; then
  T="$(sshd -T 2>/dev/null)"; g() { echo "$T" | awk -v k="$1" '$1==k{print $2; exit}'; }
  if [ -z "$T" ]; then T="$(cat /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tr 'A-Z' 'a-z' | grep -vE '^\s*#')"; info "(read from sshd_config; defaults apply where a setting is missing)"; fi
  PORT="$(g port)"; info "Port ${PORT:-22}"
  PRL="$(g permitrootlogin)"; PRL="${PRL:-prohibit-password}"
  case "$PRL" in
    no) ok "root cannot log in over SSH";;
    prohibit-password|without-password) ok "root can log in only with an SSH key";;
    *) warn "root can log in over SSH with a password (PermitRootLogin $PRL)";;
  esac
  PA="$(g passwordauthentication)"; [ "${PA:-yes}" = "no" ] && ok "Password logins are off (keys only)" || warn "Password logins are on: open to password guessing"
  MAT="$(g maxauthtries)"; [ "${MAT:-6}" -le 4 ] && ok "MaxAuthTries $MAT" || info "MaxAuthTries ${MAT:-6} (4 or fewer is better)"
  XF="$(g x11forwarding)"; [ "${XF:-no}" = "no" ] && ok "X11 forwarding off" || warn "X11 forwarding on"
  if has journalctl; then
    FAILS="$(journalctl -u ssh -u sshd --since '24 hours ago' 2>/dev/null | grep -cE 'Failed password|Invalid user')"
  else
    FAILS="$(grep -sE 'Failed password|Invalid user' /var/log/auth.log | wc -l)"
  fi
  [ "${FAILS:-0}" -gt 20 ] && warn "$FAILS failed SSH logins in the last 24 h (someone is guessing passwords)" || info "Failed SSH logins in the last 24 h: ${FAILS:-0}"
  if [ "${FAILS:-0}" -gt 0 ]; then
    { journalctl -u ssh -u sshd --since '24 hours ago' 2>/dev/null || cat /var/log/auth.log 2>/dev/null; } | grep -oE 'from [0-9a-f.:]+' | sort | uniq -c | sort -rn | head -5 | sed 's/^/       top: /'
  fi
  LAST="$(last -n 5 -w 2>/dev/null | grep -vE '^(reboot|wtmp|$)' | awk '{print $1" from "$3" "$4" "$5" "$6" "$7}')"; [ -n "$LAST" ] && echo "$LAST" | sed 's/^/       recent login: /'
else
  info "sshd not found"
fi

# ---------------------------------------------------------------- network
head1 "Firewall and open ports"
if has ufw && ufw status 2>/dev/null | grep -q "Status: active"; then ok "Firewall (ufw) is on"; ufw status | sed -n '5,30p' | sed 's/^/       /'
elif has nft && [ "$(nft list ruleset 2>/dev/null | grep -c 'drop\|reject')" -gt 0 ]; then ok "Firewall rules found (nftables)"
else fail "No firewall is active: every program that listens on a port is reachable from the internet"; fi
info "Programs listening for connections from outside:"
ss -tulpnH 2>/dev/null | awk '$5 !~ /^(127\.|\[::1\]|::1)/ {split($5,a,":"); port=a[length(a)]; match($0,/users:\(\("[^"]+"/); p=substr($0,RSTART+9,RLENGTH-10); print "         " $1 " port " port "  " p}' | sort -u
if has fail2ban-client && systemctl is-active --quiet fail2ban 2>/dev/null; then ok "fail2ban is on: $(fail2ban-client status 2>/dev/null | sed -n 's/.*Jail list:\s*//p')"; else warn "fail2ban is not running (blocks IPs that guess passwords)"; fi

# ---------------------------------------------------------------- apache
head1 "Apache"
if has apache2ctl; then
  info "$(apache2 -v 2>/dev/null | head -1)"
  MODS="$(apache2ctl -M 2>/dev/null)"
  for m in rewrite headers expires ssl; do echo "$MODS" | grep -q "${m}_module" && ok "module $m on" || warn "module $m off"; done
  echo "$MODS" | grep -q "status_module" && warn "mod_status is on (check /server-status is not public)"
  echo "$MODS" | grep -q "autoindex_module" && info "mod_autoindex on (the site's .htaccess turns folder listings off)"
  ST="$(grep -rhsiE '^\s*ServerTokens' /etc/apache2/ | tail -1 | awk '{print $2}')"; [ "${ST,,}" = "prod" ] && ok "ServerTokens Prod (version hidden)" || warn "Apache shows its version to everyone (ServerTokens ${ST:-OS})"
  SS="$(grep -rhsiE '^\s*ServerSignature' /etc/apache2/ | tail -1 | awk '{print $2}')"; [ "${SS,,}" = "off" ] && ok "ServerSignature Off" || warn "Apache signature on error pages is on (ServerSignature ${SS:-On})"
  grep -qsE 'AllowOverride\s+(All|.*FileInfo.*AuthConfig|.*AuthConfig.*FileInfo)' /etc/apache2/sites-enabled/*.conf /etc/apache2/apache2.conf && ok "AllowOverride lets the site's .htaccess work" || fail ".htaccess may be ignored (AllowOverride None) — the protections in it would not work"
fi

# ---------------------------------------------------------------- php
head1 "PHP (as used by the web server)"
PHPINI="$(ls /etc/php/*/apache2/php.ini /etc/php/*/fpm/php.ini 2>/dev/null | tail -1)"
P() { php -c "$PHPINI" -r "echo ini_get('$1');" 2>/dev/null; }
info "PHP $(php -r 'echo PHP_VERSION;' 2>/dev/null), settings: ${PHPINI:-?}"
[ "$(P expose_php)" = "" ] || [ "$(P expose_php)" = "0" ] && ok "PHP version hidden (expose_php Off)" || warn "PHP announces its version (expose_php On)"
[ "$(P display_errors)" = "" ] || [ "$(P display_errors)" = "0" ] || [ "$(P display_errors)" = "Off" ] && ok "Errors are not shown to visitors" || fail "display_errors is on: errors with file paths are shown to visitors"
[ "$(P log_errors)" = "1" ] && ok "Errors are logged" || warn "log_errors off"
info "upload_max_filesize $(P upload_max_filesize), post_max_size $(P post_max_size), memory_limit $(P memory_limit)"
[ "$(P session.use_strict_mode)" = "1" ] && ok "session.use_strict_mode on" || info "session.use_strict_mode off (the site turns it on for the admin panel itself)"
for e in pdo_sqlite gd curl fileinfo exif; do php -c "$PHPINI" -m 2>/dev/null | grep -qi "^$e$" && ok "extension $e" || warn "extension $e missing"; done
php -c "$PHPINI" -r 'echo function_exists("imagecreatefromwebp")?"":"x";' 2>/dev/null | grep -q x && warn "GD without WebP: WebP photos can't be turned into print files"

# ---------------------------------------------------------------- site files
head1 "Site files ($SITE)"
if [ -f "$SITE/api/config.php" ]; then
  CFG="$SITE/api/config.php"
  info "config.php: $(stat -c '%A %U:%G' "$CFG")"
  [ "$(stat -c '%a' "$CFG")" -le 640 ] && ok "config.php is not readable by other users" || warn "config.php can be read by every user on the server"
  php -r '$c=@include $argv[1]; if(!is_array($c)){echo "unreadable";exit;} $p=(string)($c["admin_password"]??"");
    echo (preg_match("/^\\$(2y|argon2)/",$p)?"hash":"plain")," ",strlen($p)," ",(($c["telegram_bot_token"]??"")!==""?"tg":"notg")," ",(($c["site_url"]??"")!==""?"url":"nourl");' "$CFG" | {
    read -r kind len tg url
    if [ "$kind" = "hash" ]; then ok "Admin password is stored as a hash"; else warn "Admin password is stored as plain text ($len characters) in config.php"; fi
    [ "$kind" = "plain" ] && [ "${len:-0}" -lt 14 ] && warn "Admin password is short ($len characters): use 14 or more"
    [ "$tg" = "tg" ] && info "Telegram notifications: configured" || info "Telegram notifications: not configured"
    [ "$url" = "url" ] && ok "site_url is set" || warn "site_url is empty (Telegram messages have no link to the order)"
  }
  OWN="$(stat -c '%U' "$SITE/index.html")"; [ "$OWN" = "www-data" ] && warn "Site files belong to the web server user: a PHP bug could rewrite the site" || ok "Site files belong to $OWN, not to the web server"
  if has sudo; then
    W="$(sudo -u www-data find "$SITE" -path "$SITE/data" -prune -o -writable -print 2>/dev/null | head -5)"
    [ -z "$W" ] && ok "The web server can write only to data/" || { warn "The web server can change site files outside data/:"; echo "$W" | sed 's/^/         /'; }
  fi
  [ -d "$SITE/data" ] && info "data/: $(stat -c '%A %U:%G' "$SITE/data"), $(du -sh "$SITE/data" 2>/dev/null | cut -f1)"
  for f in .htaccess api/.htaccess data/.htaccess data/uploads/.htaccess; do [ -f "$SITE/$f" ] && ok "$f present" || fail "$f missing"; done
  STRAY="$(find "$SITE" -maxdepth 2 \( -name '*.zip' -o -name '*.tar*' -o -name '*.bak' -o -name '*.sql' -o -name '.git' -o -name 'Claude outputs' -o -name '*.orig' -o -name '*~' \) 2>/dev/null)"
  [ -z "$STRAY" ] && ok "No archives, backups or .git inside the site folder" || { warn "Files that don't belong in the site folder:"; echo "$STRAY" | sed 's/^/         /'; }
  if [ -f "$SITE/data/shop.sqlite" ]; then
    php -r '$p=new PDO("sqlite:".$argv[1]); echo $p->query("select count(*) from orders")->fetchColumn()," orders, ",$p->query("select count(*) from photos")->fetchColumn()," photos in the database";' "$SITE/data/shop.sqlite" 2>/dev/null | sed 's/^/       /'; echo
  fi
else
  fail "No site found in $SITE"
fi

# ---------------------------------------------------------------- from outside
head1 "Seen from the internet (https://${DOMAIN:-?})"
if [ -n "$DOMAIN" ] && has curl; then
  H="$(curl -sS -I --max-time 10 "https://$DOMAIN/" 2>&1)"
  if echo "$H" | grep -qi '^HTTP/'; then
    for h in Strict-Transport-Security Content-Security-Policy X-Frame-Options X-Content-Type-Options Referrer-Policy Permissions-Policy; do
      echo "$H" | grep -qi "^$h:" && ok "header $h" || warn "header $h missing"
    done
    SV="$(echo "$H" | grep -i '^server:' | tr -d '\r' | cut -d' ' -f2-)"; echo "$SV" | grep -q '[0-9]' && warn "Server header shows versions: $SV" || ok "Server header: ${SV:-none}"
    XP="$(echo "$H" | grep -i '^x-powered-by:' | tr -d '\r')"; [ -n "$XP" ] && warn "$XP (reveals PHP version)" || ok "No X-Powered-By header"
  else
    warn "Could not open https://$DOMAIN/ from the server itself: $(echo "$H" | head -1)"
  fi
  R="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 10 "http://$DOMAIN/")"; case "$R" in 30[1278]\ https://*) ok "http:// redirects to https://";; *) warn "http:// does not redirect to https:// ($R)";; esac
  printf '       %-34s %s\n' "address" "answer (should be 403/404 except the first two)"
  for u in / /admin/ /api/config.php /api/lib.php /data/shop.sqlite /data/fx.json /README.md /deploy.sh /.user.ini /.htaccess /.git/config "/server-status" /data/uploads/; do
    c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN$u")"
    case "$u" in /|/admin/) [ "$c" = "200" ] && m="OK" || m="WARN";; *) case "$c" in 403|404) m="OK";; 000) m="WARN";; *) m="FAIL";; esac;; esac
    printf '[%-4s] %-34s %s\n' "$m" "$u" "$c"
  done
  if has openssl; then
    END="$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    if [ -n "$END" ]; then DAYS=$(( ( $(date -d "$END" +%s) - $(date +%s) ) / 86400 )); [ "$DAYS" -gt 14 ] && ok "Certificate valid for $DAYS more days" || fail "Certificate expires in $DAYS days"; fi
    for v in tls1:1.0 tls1_1:1.1; do echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" -"${v%%:*}" >/dev/null 2>&1 && warn "Old protocol TLS ${v#*:} is accepted" || ok "Old protocol TLS ${v#*:} refused"; done
  fi
  systemctl list-timers 2>/dev/null | grep -q certbot && ok "Certificate renews automatically (certbot timer)" || { has certbot && warn "certbot timer not found: check that the certificate renews"; }
else
  info "Give the domain as the 2nd argument to check from outside."
fi

# ---------------------------------------------------------------- backups
head1 "Backups"
if [ -d /root/uniqueprints-backups ]; then
  N="$(ls /root/uniqueprints-backups 2>/dev/null | wc -l)"; info "Update backups: $N in /root/uniqueprints-backups ($(du -sh /root/uniqueprints-backups | cut -f1)), newest: $(ls -t /root/uniqueprints-backups | head -1)"
else info "No update backups yet"; fi
if crontab -l 2>/dev/null | grep -qiE 'backup|tar|rsync|uniqueprints' || compgen -G "/etc/cron.daily/*uniqueprints*" >/dev/null || compgen -G "/etc/cron.d/*uniqueprints*" >/dev/null; then ok "A scheduled backup exists"; else warn "No scheduled backup of orders and photos (data/): if the disk fails, all orders are lost"; fi

# ---------------------------------------------------------------- recent errors
head1 "Recent site errors (Apache log, last 10)"
grep -hs 'uniqueprints' /var/log/apache2/error*.log | tail -10 | cut -c1-220 | sed 's/^/       /'
echo
echo "Done. Nothing was changed."
