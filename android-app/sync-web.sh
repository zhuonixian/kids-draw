#!/usr/bin/env bash
# 同步主仓库 Web 资源到 Capacitor www/
# 有意排除: sw.js / manifest.json —— WebView(https://localhost) 下 SW 无意义，
# 且其缓存会让 APK 升级后仍加载旧代码；排除后 register('sw.js') 静默 404，随包即最新。
set -euo pipefail
cd "$(dirname "$0")"

ROOT=..
WWW=www
rm -rf "$WWW"
mkdir -p "$WWW/js" "$WWW/css"

cp "$ROOT/index.html" "$WWW/index.html"
cp "$ROOT"/css/*.css "$WWW/css/"
cp "$ROOT"/js/*.js "$WWW/js/"
# 贴纸/字体/图标/音效素材整体拷入（排除 js 目录下已被排除的无需处理）
cp -r "$ROOT/assets" "$WWW/assets"

# 注入原生桥脚本（返回键/状态栏），插在 </body> 前
cp native-bridge.js "$WWW/js/"
sed -i 's|</body>|<script src="js/native-bridge.js"></script></body>|' "$WWW/index.html"

echo "www/ 已同步: $(find "$WWW" -type f | wc -l) 个文件"
