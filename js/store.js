// === 作品存储：IndexedDB 画廊（内存缓存 + 写透）+ ZIP 备份导出 ===
// 契约（保持同步 API，调用方无需 await）：
//   ArtworkStore.init()               -> Promise；启动时加载 IndexedDB 并迁移旧 localStorage 数据，
//                                        完成后派发 window 事件 'artwork-store-ready'（detail: {count}）
//   ArtworkStore.list()              -> [{id, dataUrl, thumb?, name, scene, createdAt}] 新的在前
//   ArtworkStore.save(canvas, meta)  -> record | null；meta: {name, scene, crop:{x,y,w,h}(CSS像素)}
//   ArtworkStore.remove(id)          -> 剩余列表
//   ArtworkStore.clear()             -> 清空全部作品（家长中心）
//   ArtworkStore.download(record)    -> 触发浏览器下载
//   ArtworkStore.exportAll()         -> Promise<{count, bytes}>；全部作品打包 ZIP 下载（家长中心备份）
//   保存成功后派发 window 事件 'artwork-saved'（detail 为 record）
//
// 存储模式：优先 IndexedDB（容量大，作品存 PNG 原画质，上限 200 张）；
// IndexedDB 不可用（如 file:// 直开）时回退旧 localStorage 行为（JPEG 900px，上限 24 张）。
const ArtworkStore = {
    LEGACY_KEY: 'kids-draw-gallery',   // 旧版 localStorage 画廊（迁移源）
    DB_NAME: 'kids-draw',
    DB_VERSION: 1,
    STORE: 'artworks',
    MAX: 200,                           // IndexedDB 模式作品上限
    LOCAL_MAX: 24,                      // localStorage 回退模式作品上限
    MAX_DATAURL_CHARS: 1.5 * 1024 * 1024, // PNG dataUrl 超过该长度降级 JPEG，控单张体积

    _records: [],                       // 内存缓存（新的在前），list() 同步读这里
    _db: null,
    _mode: 'idb',                       // 'idb' | 'local'
    _initPromise: null,

    init() {
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._openDB().then(db => {
            if (!db) {
                this._mode = 'local';
                this._records = this._localList();
                return;
            }
            this._db = db;
            return this._loadAll().then(list => this._migrateLegacy(list));
        }).catch(() => {
            // IndexedDB 半途失败：回退 localStorage，保证应用可用
            this._mode = 'local';
            this._records = this._localList();
        }).then(() => {
            window.dispatchEvent(new CustomEvent('artwork-store-ready', { detail: { count: this._records.length } }));
        });
        return this._initPromise;
    },

    _openDB() {
        return new Promise(resolve => {
            let req;
            try {
                if (typeof indexedDB === 'undefined') { resolve(null); return; }
                req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            } catch (e) { resolve(null); return; }
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE, { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        });
    },

    _loadAll() {
        return new Promise((resolve, reject) => {
            try {
                const tx = this._db.transaction(this.STORE, 'readonly');
                const req = tx.objectStore(this.STORE).getAll();
                req.onsuccess = () => {
                    const list = (req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    this._records = list;
                    resolve(list);
                };
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    },

    // 旧版 localStorage 画廊迁移：IndexedDB 为空且检测到旧数据时导入；
    // 全部写入成功后才删除旧 key（释放 localStorage 配额），失败保留下次启动重试
    _migrateLegacy(list) {
        if (list && list.length) return Promise.resolve();
        let legacy = [];
        try {
            legacy = JSON.parse(localStorage.getItem(this.LEGACY_KEY)) || [];
        } catch (e) { legacy = []; }
        if (!legacy.length) return Promise.resolve();
        return new Promise((resolve) => {
            try {
                const tx = this._db.transaction(this.STORE, 'readwrite');
                const store = tx.objectStore(this.STORE);
                legacy.forEach(r => { if (r && r.id) store.put(r); });
                tx.oncomplete = () => {
                    this._records = legacy.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    try { localStorage.removeItem(this.LEGACY_KEY); } catch (e) { /* 保底不阻塞 */ }
                    resolve();
                };
                tx.onerror = () => resolve(); // 保留旧 key，下次再试
                tx.onabort = () => resolve();
            } catch (e) { resolve(); }
        });
    },

    list() {
        return this._records;
    },

    save(canvas, meta = {}) {
        if (this._mode === 'local') return this._localSave(canvas, meta);
        const dataUrl = this._export(canvas, meta.crop, 1400, 'image/png');
        if (dataUrl && dataUrl.length > this.MAX_DATAURL_CHARS) {
            // 内容过于丰富时 PNG 体积失控，降级高质量 JPEG（画面已展平白底，视觉无差）
            const jpeg = this._export(canvas, meta.crop, 1400, 'image/jpeg', 0.92);
            if (jpeg) dataUrl = jpeg;
        }
        if (!dataUrl) return null;
        const record = {
            id: 'aw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            dataUrl: dataUrl,
            thumb: this._export(canvas, meta.crop, 360, 'image/jpeg', 0.75) || dataUrl,
            name: meta.name || '我的作品',
            scene: meta.scene || '',
            createdAt: Date.now(),
        };
        this._records.unshift(record);
        const overflow = [];
        while (this._records.length > this.MAX) overflow.push(this._records.pop());
        this._persist(record, overflow);
        window.dispatchEvent(new CustomEvent('artwork-saved', { detail: record }));
        return record;
    },

    // 写透 IndexedDB：失败不影响本次会话（内存里仍在），下次启动以库里为准
    _persist(record, overflow) {
        try {
            const tx = this._db.transaction(this.STORE, 'readwrite');
            const store = tx.objectStore(this.STORE);
            store.put(record);
            (overflow || []).forEach(r => store.delete(r.id));
        } catch (e) { /* 静默：会话内仍可用 */ }
    },

    remove(id) {
        this._records = this._records.filter(r => r.id !== id);
        if (this._mode === 'idb') {
            try {
                const tx = this._db.transaction(this.STORE, 'readwrite');
                tx.objectStore(this.STORE).delete(id);
            } catch (e) { /* 静默 */ }
        } else {
            this._localWrite(this._records);
        }
        return this._records;
    },

    clear() {
        this._records = [];
        if (this._mode === 'idb') {
            try {
                const tx = this._db.transaction(this.STORE, 'readwrite');
                tx.objectStore(this.STORE).clear();
            } catch (e) { /* 静默 */ }
        } else {
            try { localStorage.removeItem(this.LEGACY_KEY); } catch (e) { /* 忽略 */ }
        }
        return this._records;
    },

    // 展平到白底（避免透明区域导出发黑）并按长边上限缩放；crop 为 CSS 像素，按位图/布局比换算
    _export(canvas, crop, maxEdge, mime, quality) {
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

        const scale = Math.min(1, maxEdge / Math.max(sw, sh));
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(sw * scale));
        out.height = Math.max(1, Math.round(sh * scale));
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
        return out.toDataURL(mime, quality);
    },

    // === localStorage 回退模式（file:// 或 IndexedDB 不可用）：行为与旧版一致 ===
    _localList() {
        try {
            return JSON.parse(localStorage.getItem(this.LEGACY_KEY)) || [];
        } catch (e) {
            return [];
        }
    },

    _localWrite(all) {
        try {
            localStorage.setItem(this.LEGACY_KEY, JSON.stringify(all));
            return true;
        } catch (e) {
            // 存储满：保留最新的一半再试一次
            try {
                localStorage.setItem(this.LEGACY_KEY, JSON.stringify(all.slice(0, Math.floor(this.LOCAL_MAX / 2))));
                return true;
            } catch (e2) {
                return false;
            }
        }
    },

    _localSave(canvas, meta = {}) {
        // 旧版压缩策略：长边 900px JPEG（localStorage 5MB 配额所限）
        const dataUrl = this._export(canvas, meta.crop, 900, 'image/jpeg', 0.85);
        if (!dataUrl) return null;
        const record = {
            id: 'aw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            dataUrl: dataUrl,
            name: meta.name || '我的作品',
            scene: meta.scene || '',
            createdAt: Date.now(),
        };
        const all = this._localList();
        all.unshift(record);
        while (all.length > this.LOCAL_MAX) all.pop();
        if (!this._localWrite(all)) return null;
        this._records = all;
        window.dispatchEvent(new CustomEvent('artwork-saved', { detail: record }));
        return record;
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

    // === 从 ZIP 备份恢复（家长中心）：解析 exportAll 产出的包并合入画廊 ===
    // file: 用户选择的 File/Blob；返回 Promise<{count, skipped}>
    // 错误语义：'notzip' 非压缩包 / 'notours' 非本应用备份包 / 'compressed' 含压缩条目（我们的备份恒为 store）
    importZip(file) {
        return file.arrayBuffer().then(buf => {
            const entries = this._parseBackupZip(new Uint8Array(buf));
            const manifestBytes = entries['manifest.json'];
            if (!manifestBytes) throw new Error('notours');
            let manifest;
            try {
                manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
            } catch (e) { throw new Error('notours'); }
            if (!manifest || !Array.isArray(manifest.artworks)) throw new Error('notours');

            // 跳过已存在的（同名同日期视为同一幅），其余按原日期顺序合入
            const existing = new Set(this._records.map(r => r.name + '|' + r.createdAt));
            const pending = [];
            manifest.artworks.forEach(a => {
                if (!a || !a.file || existing.has(a.name + '|' + Date.parse(a.createdAt))) return;
                const imgBytes = entries[a.file];
                if (!imgBytes || !imgBytes.length) return;
                const ext = a.file.slice(a.file.lastIndexOf('.') + 1).toLowerCase();
                const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
                pending.push({
                    dataUrl: 'data:' + mime + ';base64,' + this._bytesToBase64(imgBytes),
                    name: a.name || '恢复的作品',
                    scene: a.scene || '',
                    createdAt: Date.parse(a.createdAt) || Date.now(),
                });
            });
            if (!pending.length) return { count: 0, skipped: manifest.artworks.length };

            return Promise.all(pending.map(p => this._thumbFromDataUrl(p.dataUrl))).then(thumbs => {
                const imported = pending.map((p, i) => ({
                    id: 'aw-' + p.createdAt + '-' + Math.random().toString(36).slice(2, 6),
                    dataUrl: p.dataUrl,
                    thumb: thumbs[i] || p.dataUrl,
                    name: p.name,
                    scene: p.scene,
                    createdAt: p.createdAt,
                }));
                this._records = this._records.concat(imported)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                const overflow = [];
                while (this._records.length > this.MAX) overflow.push(this._records.pop());
                this._persistAll(imported, overflow);
                window.dispatchEvent(new CustomEvent('artwork-saved', { detail: imported[0] }));
                return { count: imported.length, skipped: manifest.artworks.length - imported.length };
            });
        });
    },

    _persistAll(records, overflow) {
        try {
            const tx = this._db.transaction(this.STORE, 'readwrite');
            const store = tx.objectStore(this.STORE);
            records.forEach(r => store.put(r));
            (overflow || []).forEach(r => store.delete(r.id));
        } catch (e) { /* 静默：会话内仍可用 */ }
    },

    // store-only ZIP 解析：定位 EOCD → 顺序读中央目录 → 按本地头定位数据切片。
    // 只服务自家备份（exportAll 恒为 store），遇到压缩条目直接报错，不做 inflate
    _parseBackupZip(bytes) {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let eocd = -1;
        const scanFloor = Math.max(0, bytes.length - 22 - 65535);
        for (let i = bytes.length - 22; i >= scanFloor; i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('notzip');
        const count = dv.getUint16(eocd + 10, true);
        let ptr = dv.getUint32(eocd + 16, true);
        const decoder = new TextDecoder();
        const entries = {};
        for (let i = 0; i < count; i++) {
            if (dv.getUint32(ptr, true) !== 0x02014b50) throw new Error('notzip');
            const method = dv.getUint16(ptr + 10, true);
            if (method !== 0) throw new Error('compressed');
            const size = dv.getUint32(ptr + 24, true);
            const nameLen = dv.getUint16(ptr + 28, true);
            const extraLen = dv.getUint16(ptr + 30, true);
            const commentLen = dv.getUint16(ptr + 32, true);
            const localOff = dv.getUint32(ptr + 42, true);
            const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
            const dataStart = localOff + 30 + dv.getUint16(localOff + 26, true) + dv.getUint16(localOff + 28, true);
            entries[name] = bytes.subarray(dataStart, dataStart + size);
            ptr += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    },

    _bytesToBase64(bytes) {
        let bin = '';
        // 分块拼接，避免大图 String 参数栈溢出
        for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
    },

    // 由原图 dataUrl 生成 360px JPEG 缩略图（导入的作品包里没有 thumb）
    _thumbFromDataUrl(dataUrl) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                try {
                    const scale = Math.min(1, 360 / Math.max(img.width, img.height));
                    const out = document.createElement('canvas');
                    out.width = Math.max(1, Math.round(img.width * scale));
                    out.height = Math.max(1, Math.round(img.height * scale));
                    const ctx = out.getContext('2d');
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, out.width, out.height);
                    ctx.drawImage(img, 0, 0, out.width, out.height);
                    resolve(out.toDataURL('image/jpeg', 0.75));
                } catch (e) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
        });
    },

    // === 全部作品打包导出（ZIP，store 不压缩；文件名 UTF-8 标志位） ===
    exportAll() {
        return Promise.resolve().then(() => {
            const list = this._records.slice();
            if (!list.length) throw new Error('empty');
            const files = [{ name: 'manifest.json', bytes: this._manifestBytes(list) }];
            list.forEach((r, i) => {
                files.push({ name: this._zipName(i + 1, r) + '.' + (r.dataUrl.indexOf('image/png') === 5 ? 'png' : 'jpg'), bytes: this._dataUrlBytes(r.dataUrl) });
            });
            const blob = this._buildZip(files);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '画画乐园-作品备份-' + new Date().toISOString().slice(0, 10) + '.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            return { count: list.length, bytes: blob.size };
        });
    },

    _manifestBytes(list) {
        const manifest = {
            app: '画画乐园',
            exportedAt: new Date().toISOString(),
            count: list.length,
            artworks: list.map((r, i) => ({
                file: this._zipName(i + 1, r) + '.' + (r.dataUrl.indexOf('image/png') === 5 ? 'png' : 'jpg'),
                name: r.name,
                scene: r.scene || '',
                createdAt: new Date(r.createdAt).toISOString(),
            })),
        };
        return new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    },

    // 序号 + 作品名（去文件系统非法字符），保证解压后顺序与画廊一致
    _zipName(seq, record) {
        const safe = String(record.name || '作品').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 20) || '作品';
        return String(seq).padStart(2, '0') + '-' + safe;
    },

    _dataUrlBytes(dataUrl) {
        const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    },

    // 最小可用 ZIP 构建：全部 store（无压缩）+ UTF-8 文件名标志，系统自带解压即可打开
    _buildZip(files) {
        const enc = new TextEncoder();
        const chunks = [];
        const central = [];
        let offset = 0;
        const now = new Date();
        const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
        const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

        files.forEach(f => {
            const nameBytes = enc.encode(f.name);
            const crc = this._crc32(f.bytes);
            const local = new Uint8Array(30 + nameBytes.length);
            const lv = new DataView(local.buffer);
            lv.setUint32(0, 0x04034b50, true);   // local file header signature
            lv.setUint16(4, 20, true);           // version needed
            lv.setUint16(6, 0x0800, true);       // flags: UTF-8 文件名
            lv.setUint16(8, 0, true);            // method: store
            lv.setUint16(10, dosTime, true);
            lv.setUint16(12, dosDate, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, f.bytes.length, true);
            lv.setUint32(22, f.bytes.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);           // extra length
            local.set(nameBytes, 30);
            chunks.push(local, f.bytes);

            const cd = new Uint8Array(46 + nameBytes.length);
            const cv = new DataView(cd.buffer);
            cv.setUint32(0, 0x02014b50, true);   // central directory signature
            cv.setUint16(4, 20, true);           // version made by
            cv.setUint16(6, 20, true);           // version needed
            cv.setUint16(8, 0x0800, true);       // flags: UTF-8 文件名
            cv.setUint16(10, 0, true);           // method: store
            cv.setUint16(12, dosTime, true);
            cv.setUint16(14, dosDate, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, f.bytes.length, true);
            cv.setUint32(24, f.bytes.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);           // extra length
            cv.setUint16(32, 0, true);           // comment length
            cv.setUint16(34, 0, true);           // disk number
            cv.setUint16(36, 0, true);           // internal attrs
            cv.setUint32(38, 0, true);           // external attrs
            cv.setUint32(42, offset, true);      // local header offset
            cd.set(nameBytes, 46);
            central.push(cd);

            offset += local.length + f.bytes.length;
        });

        const centralSize = central.reduce((s, c) => s + c.length, 0);
        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);       // end of central directory signature
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, centralSize, true);
        ev.setUint32(16, offset, true);

        return new Blob([].concat(chunks, central, [eocd]), { type: 'application/zip' });
    },

    _crc32(bytes) {
        if (!this._crcTable) {
            this._crcTable = new Uint32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                this._crcTable[n] = c >>> 0;
            }
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc = (this._crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
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

// 启动：加载 IndexedDB 并迁移旧数据（画廊就绪后派发 'artwork-store-ready'）
document.addEventListener('DOMContentLoaded', () => {
    ArtworkStore.init();
});
