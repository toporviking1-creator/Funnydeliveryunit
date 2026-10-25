#!/bin/sh
# Собирает игру из src/ в один файл index.html (его раздаёт GitHub Pages)
set -e
cd "$(dirname "$0")"
{
  cat <<'HEAD'
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0E2430">
<meta name="description" content="Родблок — менеджер родового отделения в духе Theme Hospital: сутки дежурства за заведующего.">
<title>Родблок</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230E2430'/%3E%3Ccircle cx='9' cy='16' r='4' fill='%2312B954'/%3E%3Ccircle cx='16' cy='16' r='4' fill='%23F2B300'/%3E%3Ccircle cx='23' cy='16' r='4' fill='%23F0213A'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&family=Unbounded:wght@700;800&display=swap">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
html, body { margin: 0; }
img { max-width: 100%; }
HEAD
  cat src/style.css
  printf '</style>\n</head>\n<body>\n'
  cat src/body.html
  printf '<script>\n'
  cat src/data.js src/engine1.js src/engine2.js src/engine3.js src/engine4.js src/engine5.js src/ui1.js src/ui3.js src/ui2.js
  printf '</script>\n</body>\n</html>\n'
} > index.html
echo "index.html: $(wc -c < index.html) байт"
