// === 我的作品：本地画廊 ===
const Gallery = {
    grid: null,
    empty: null,
    lightbox: null,
    _currentId: null,      // 预览中的作品
    _deleteArmed: false,   // 删除二次确认
    _deleteTimer: null,
    _deleteLabel: '删除',  // 删除按钮原始文字

    init() {
        this.grid = document.getElementById('gallery-grid');
        this.empty = document.getElementById('gallery-empty');
        this.lightbox = document.getElementById('gallery-lightbox');
        if (!this.grid || !this.lightbox) return;

        document.getElementById('gallery-back').addEventListener('click', () => App.showScene('home'));

        // 成长画册：全部作品排版成 A4 画册打印（打印为 PDF 即可存档分享）
        const printBtn = document.getElementById('gallery-print');
        if (printBtn) printBtn.addEventListener('click', () => this.printAlbum());

        // 点遮罩关闭预览
        const backdrop = this.lightbox.querySelector('[data-close]');
        if (backdrop) backdrop.addEventListener('click', () => this._closeLightbox());

        document.getElementById('lightbox-share').addEventListener('click', () => {
            // Web Share API：iPad/手机原生分享面板；文件分享优先，不支持则退化为文本
            const record = ArtworkStore.list().find(r => r.id === this._currentId);
            if (!record) return;
            if (!navigator.share) { App.showToast('当前设备不支持分享'); return; }
            fetch(record.dataUrl).then(r => r.blob()).then(blob => {
                const file = new File([blob], record.name + '.jpg', { type: 'image/jpeg' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    return navigator.share({ files: [file], title: '画画乐园', text: record.name });
                }
                return navigator.share({ title: '画画乐园', text: '看我的作品：' + record.name });
            }).then(() => App.showToast('已分享')).catch((err) => {
                if (!err || err.name !== 'AbortError') App.showToast('当前设备不支持分享');
            });
        });

        document.getElementById('lightbox-download').addEventListener('click', () => {
            // 现查现用：记录可能已被并发删除
            const record = ArtworkStore.list().find(r => r.id === this._currentId);
            if (!record) return;
            ArtworkStore.download(record);
            App.showToast('已开始下载');
        });

        // 做成贺卡：把当前预览的作品送进贺卡工坊
        document.getElementById('lightbox-card').addEventListener('click', () => {
            const record = ArtworkStore.list().find(r => r.id === this._currentId);
            if (!record) return;
            if (typeof CardMaker === 'undefined') return;
            this._closeLightbox();
            CardMaker.open(record);
        });

        const delBtn = document.getElementById('lightbox-delete');
        if (delBtn) {
            this._deleteLabel = delBtn.textContent;
            delBtn.addEventListener('click', () => this._onDelete(delBtn));
        }

        // 保存作品后实时刷新（仅在画廊可见时）
        window.addEventListener('artwork-saved', () => {
            const scene = document.getElementById('gallery');
            if (scene && scene.classList.contains('active')) this.render();
        });

        // 存储就绪（IndexedDB 异步加载/迁移完成）后，若画廊正展示空态则重绘
        window.addEventListener('artwork-store-ready', () => {
            const scene = document.getElementById('gallery');
            if (scene && scene.classList.contains('active')) this.render();
        });
    },

    // 成长画册打印：A4 双列，含作品名与日期；最多取最近 60 幅（避免打印文档过重）
    printAlbum() {
        const list = ArtworkStore.list().slice(0, 60);
        if (!list.length) {
            App.showToast('还没有作品，先去画一幅吧 🎨');
            return;
        }
        const fmt = (ts) => {
            const d = new Date(ts);
            return (d.getMonth() + 1) + '月' + d.getDate() + '日';
        };
        const who = (typeof Settings !== 'undefined' && Settings.get('childName', '')) || '宝贝';
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        doc.open();
        doc.write('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>画画乐园 · ' + who + '的成长画册</title>' +
            '<style>' +
            '@page { size: A4; margin: 10mm; }' +
            "body { font-family: sans-serif; color: #444; }" +
            'h1 { font-size: 18px; text-align: center; margin: 0 0 6mm; }' +
            '.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }' +
            '.cell { border: 2px dashed #bbb; border-radius: 12px; padding: 4mm; text-align: center; page-break-inside: avoid; }' +
            '.cell img { width: 100%; }' +
            '.cap { margin: 2mm 0 0; font-size: 13px; color: #888; }' +
            '</style></head><body>' +
            '<h1>🎨 ' + who + '的成长画册 · ' + list.length + ' 幅作品</h1>' +
            '<div class="grid">' +
            list.map(r => '<div class="cell"><img src="' + r.dataUrl + '"><p class="cap">' + r.name + ' · ' + fmt(r.createdAt) + '</p></div>').join('') +
            '</div></body></html>');
        doc.close();
        App.showToast('已生成成长画册，可打印或存为 PDF');
        const doPrint = () => {
            frame.contentWindow.focus();
            frame.contentWindow.print();
            setTimeout(() => frame.remove(), 2000);
        };
        if (doc.readyState === 'complete') doPrint();
        else frame.onload = doPrint;
    },

    // 进入画廊：收起遗留预览再重绘
    onEnter() {
        if (!this.grid) return;
        this._closeLightbox();
        this.render();
    },

    render() {
        if (!this.grid) return;
        const list = ArtworkStore.list();
        this.grid.innerHTML = '';
        if (!list.length) {
            this.empty.style.display = 'block';
            return;
        }
        this.empty.style.display = 'none';
        list.forEach(record => {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            card.dataset.id = record.id;

            const img = document.createElement('img');
            // 网格用小图（新记录带 360px thumb），预览/下载仍用原图
            img.src = record.thumb || record.dataUrl;
            img.alt = record.name;

            const meta = document.createElement('div');
            meta.className = 'gallery-card-meta';
            const name = document.createElement('div');
            name.className = 'gallery-card-name';
            name.textContent = record.name;
            const date = document.createElement('div');
            date.className = 'gallery-card-date';
            date.textContent = this._formatDate(record.createdAt);
            meta.appendChild(name);
            meta.appendChild(date);

            card.appendChild(img);
            card.appendChild(meta);
            card.addEventListener('click', () => this._openLightbox(record));
            this.grid.appendChild(card);
        });
    },

    // M/D HH:mm，月/日/时不补零
    _formatDate(ts) {
        const d = new Date(ts);
        const min = d.getMinutes() < 10 ? '0' + d.getMinutes() : '' + d.getMinutes();
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + min;
    },

    _openLightbox(record) {
        if (!record) return;
        document.getElementById('lightbox-img').src = record.dataUrl;
        this._currentId = record.id;
        this._resetDelete();
        this.lightbox.classList.add('open');
    },

    _closeLightbox() {
        this.lightbox.classList.remove('open');
        this._currentId = null;
        this._resetDelete();
    },

    // 删除二次确认：首次点武装按钮，2.5 秒内再点才真删
    _onDelete(btn) {
        if (!this._currentId) return;
        if (!this._deleteArmed) {
            this._deleteArmed = true;
            btn.textContent = '确认删除';
            btn.style.background = '#E57373';
            clearTimeout(this._deleteTimer);
            this._deleteTimer = setTimeout(() => this._resetDelete(), 2500);
            return;
        }
        clearTimeout(this._deleteTimer);
        this._deleteTimer = null;
        ArtworkStore.remove(this._currentId);
        this._closeLightbox();
        this.render();
        App.showToast('已删除');
    },

    // 还原删除按钮的文字与内联样式
    _resetDelete() {
        this._deleteArmed = false;
        clearTimeout(this._deleteTimer);
        this._deleteTimer = null;
        const btn = document.getElementById('lightbox-delete');
        if (btn) {
            btn.textContent = this._deleteLabel;
            btn.style.background = '';
        }
    },
};

document.addEventListener('DOMContentLoaded', () => Gallery.init());
