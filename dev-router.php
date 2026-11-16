<?php
$root = __DIR__;
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (preg_match('#^/data(/|$)#', $uri) || preg_match('#^/api/(config|lib)\.php$#', $uri)) { http_response_code(403); exit('Forbidden'); }
$p = $root . $uri;
if (is_dir($p)) { foreach (['index.html','index.php'] as $i) if (is_file(rtrim($p,'/')."/$i")) { if (str_ends_with($i,'.php')) { chdir(dirname($p."/$i")); require rtrim($p,'/')."/$i"; return true; } header('Content-Type: text/html; charset=utf-8'); readfile(rtrim($p,'/')."/$i"); return true; } }
if (is_file($p)) return false;
$h = $root . rtrim($uri,'/') . '.html';
if (is_file($h)) { header('Content-Type: text/html; charset=utf-8'); readfile($h); return true; }
return false;
