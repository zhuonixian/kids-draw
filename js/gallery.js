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

        // 点遮罩关闭预览
        const backdrop = this.lightbox.querySelector('[data-close]');
        if (backdrop) backdrop.addEventListener('click', () => this._closeLightbox());

        document.getElementById('lightbox-download').addEventListener('click', () => {
            // 现查现用：记录可能已被并发删除
            const record = ArtworkStore.list().find(r => r.id === this._currentId);
            if (!record) return;
            ArtworkStore.download(record);
            App.showToast('已开始下载');
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
            img.src = record.dataUrl;
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
