// === Capacitor 原生桥（仅随 APK 打包，主仓库不含；网页环境下本文件自短路） ===
(function () {
    if (!window.Capacitor || !window.Capacitor.Plugins) return;

    // 返回键：非首页先回首页、首页 2 秒内再按才退出——防止孩子误触直接退出丢画作
    var AppPlugin = window.Capacitor.Plugins.App;
    if (AppPlugin && AppPlugin.addListener) {
        var lastBack = 0;
        AppPlugin.addListener('backButton', function () {
            var home = document.getElementById('home');
            if (home && !home.classList.contains('active') && window.App) {
                window.App.showScene('home');
                return;
            }
            var now = Date.now();
            if (now - lastBack < 2000) {
                AppPlugin.exitApp();
            } else {
                lastBack = now;
                if (window.App) window.App.showToast('再按一次退出');
            }
        });
    }

    // 状态栏配色对齐主题色（失败静默：老系统无此能力不影响功能）
    var StatusBar = window.Capacitor.Plugins.StatusBar;
    if (StatusBar && StatusBar.setBackgroundColor) {
        StatusBar.setBackgroundColor({ color: '#FF6B6B' }).catch(function () {});
    }

    // WebView 不处理 <a download>（「保存到设备」/「备份全部作品」会无效）：
    // 拦截下载点击 → 写入应用缓存目录 → 弹系统分享面板（保存到文件/相册或发微信）
    var Filesystem = window.Capacitor.Plugins.Filesystem;
    var Share = window.Capacitor.Plugins.Share;
    if (Filesystem && Share) {
        var shareDownload = function (href, filename) {
            fetch(href).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
                var b64 = window.ArtworkStore && ArtworkStore._bytesToBase64
                    ? ArtworkStore._bytesToBase64(new Uint8Array(buf))
                    : btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
                return Filesystem.writeFile({
                    path: filename,
                    data: b64,
                    directory: 'CACHE',
                    recursive: true
                });
            }).then(function (res) {
                return Share.share({
                    title: '画画乐园',
                    url: res.uri,
                    dialogTitle: '保存或分享'
                });
            }).catch(function (e) {
                // 用户取消分享面板不算失败
                if (e && String(e.message || e).indexOf('cancel') > -1) return;
                if (window.App) window.App.showToast('保存失败，请重试');
            });
        };

        var origAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            var href = this.getAttribute('href') || '';
            if (this.download && (href.indexOf('data:') === 0 || href.indexOf('blob:') === 0)) {
                shareDownload(href, this.download);
                return;
            }
            return origAnchorClick.apply(this, arguments);
        };
    }
})();
