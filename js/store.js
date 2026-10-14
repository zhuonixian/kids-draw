// === 作品存储：localStorage 画廊 + PNG 数据导出 ===
// 契约：
//   ArtworkStore.list()                          -> [{id, dataUrl, name, scene, createdAt}] 新的在前
//   ArtworkStore.save(canvas, meta)              -> record | null；meta: {name, scene, crop:{x,y,w,h}(CSS像素)}
//   ArtworkStore.remove(id)                      -> 剩余列表
//   ArtworkStore.download(record)                -> 触发浏览器下载
//   保存成功后派发 window 事件 'artwork-saved'（detail 为 record）
const ArtworkStore = {
    KEY: 'kids-draw-gallery',
    MAX: 24,

    list() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY)) || [];
        } catch (e) {
            return [];
        }
    },

    save(canvas, meta = {}) {
        const dataUrl = this.dataUrl(canvas, meta.crop);
        if (!dataUrl) return null;
        const record = {
            id: 'aw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            dataUrl: dataUrl,
            name: meta.name || '我的作品',
            scene: meta.scene || '',
            createdAt: Date.now(),
        };
        const all = this.list();
        all.unshift(record);
        while (all.length > this.MAX) all.pop();
        try {
            localStorage.setItem(this.KEY, JSON.stringify(all));
        } catch (e) {
            // 存储满：保留最新的一半再试一次
            try {
                localStorage.setItem(this.KEY, JSON.stringify(all.slice(0, Math.floor(this.MAX / 2))));
            } catch (e2) {
                return null;
            }
        }
        window.dispatchEvent(new CustomEvent('artwork-saved', { detail: record }));
        return record;
    },

    remove(id) {
        const all = this.list().filter(r => r.id !== id);
        try {
            localStorage.setItem(this.KEY, JSON.stringify(all));
        } catch (e) { /* 删除只会释放空间，忽略 */ }
        return all;
    },

    // 展平到白底（避免透明区域导出发黑）；crop 为 CSS 像素，按位图/布局比换算
    dataUrl(canvas, crop) {
        let sx = 0, sy = 0, sw = canvas.width, sh = canvas.height;
        if (crop) {
            const rect = canvas.getBoundingClientRect();
            const ratioX = rect.width > 0 ? canvas.width / rect.width : 1;
            const ratioY = rect.height > 0 ? canvas.height / rect.height : 1;
            sx = Math.max(0, crop.x * ratioX);
            sy = Math.max(0, crop.y * ratioY);
            sw = Math.min(canvas.width - sx, crop.w * ratioX);
            sh = Math.min(canvas.height - sy, crop.h * ratioY);
        }
        if (sw < 1 || sh < 1) return null;

        // 控制体积：长边压到 900px 内，JPEG 存储才塞得进 localStorage
        const scale = Math.min(1, 900 / Math.max(sw, sh));
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(sw * scale));
        out.height = Math.max(1, Math.round(sh * scale));
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
        return out.toDataURL('image/jpeg', 0.85);
    },

    download(record) {
        const a = document.createElement('a');
        a.href = record.dataUrl;
        const ext = record.dataUrl && record.dataUrl.indexOf('image/png') === 5 ? 'png' : 'jpg';
        a.download = '画画乐园-' + record.name + '-' + new Date(record.createdAt).toISOString().slice(0, 10) + '.' + ext;
        document.body.appendChild(a);
        a.click();
        a.remove();
    },
};

// === 形状收集进度（描边完成后收入图鉴） ===
// ShapeProgress.list()            -> { 形状名: {count, lastAt} }
// ShapeProgress.mark(name)        -> 记一次完成，返回 {count, lastAt}
// ShapeProgress.completedCount()  -> 已完成的不同形状数
// ShapeProgress.reset()           -> 清空
const ShapeProgress = {
    KEY: 'kids-draw-shape-progress',

    list() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY)) || {};
        } catch (e) {
            return {};
        }
    },

    mark(name) {
        const all = this.list();
        const rec = all[name] || { count: 0, lastAt: 0 };
        rec.count++;
        rec.lastAt = Date.now();
        all[name] = rec;
        try {
            localStorage.setItem(this.KEY, JSON.stringify(all));
        } catch (e) { /* 进度丢失可接受 */ }
        return rec;
    },

    completedCount() {
        return Object.keys(this.list()).length;
    },

    reset() {
        try {
            localStorage.removeItem(this.KEY);
        } catch (e) { /* 忽略 */ }
    },
};

// === 设置存取（家长区） ===
// Settings.get(key, fallback) / Settings.set(key, value)
const Settings = {
    KEY: 'kids-draw-settings',

    get(key, fallback) {
        try {
            const all = JSON.parse(localStorage.getItem(this.KEY)) || {};
            return key in all ? all[key] : fallback;
        } catch (e) {
            return fallback;
        }
    },

    set(key, value) {
        let all = {};
        try {
            all = JSON.parse(localStorage.getItem(this.KEY)) || {};
        } catch (e) { /* 忽略 */ }
        all[key] = value;
        try {
            localStorage.setItem(this.KEY, JSON.stringify(all));
        } catch (e) { /* 忽略 */ }
        return value;
    },
};
