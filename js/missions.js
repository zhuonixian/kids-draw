// === 小画家任务系统 ===
// 线性任务列表（做完一个解锁下一个），把贴纸/场景/对称画笔串成有目标的创作循环。
// 进度持久化在 localStorage（kids-draw-missions）；freecanvas 在关键动作处调用 Missions.bump() 埋点。
const Missions = {
    KEY: 'kids-draw-missions',

    // event: 埋点动作名；where: 附加条件（payload 过滤）；target: 完成所需次数
    list: [
        { id: 'sticker1', icon: '⭐', title: '第一张贴纸', desc: '在画布上放 1 个贴纸', target: 1, event: 'sticker' },
        { id: 'scene1',   icon: '🏞️', title: '场景探险家', desc: '换一个画画场景试试', target: 1, event: 'scene' },
        { id: 'rotate1',  icon: '🔄', title: '转一转', desc: '把贴纸旋转一下', target: 1, event: 'rotate' },
        { id: 'copy1',    icon: '👥', title: '复制魔法', desc: '复制一个贴纸', target: 1, event: 'copy' },
        { id: 'ocean3',   icon: '🐟', title: '海底小世界', desc: '在海底场景放 3 个贴纸', target: 3, event: 'sticker', where: p => p.scene === 'ocean' },
        { id: 'mirror5',  icon: '🪞', title: '镜子魔法', desc: '用左右对称画 5 笔', target: 5, event: 'stroke', where: p => p.sym === 'mirror' },
        { id: 'kaleido8', icon: '🎨', title: '万花筒小画家', desc: '用万花筒画 8 笔', target: 8, event: 'stroke', where: p => p.sym === 'kaleido' },
        { id: 'space3',   icon: '🚀', title: '太空漫游', desc: '在太空场景画 3 笔', target: 3, event: 'stroke', where: p => p.scene === 'space' },
        { id: 'sticker10', icon: '🏅', title: '贴纸收藏家', desc: '一共放上 10 个贴纸', target: 10, event: 'sticker' },
        { id: 'save3',    icon: '🖼️', title: '小小艺术家', desc: '保存 3 幅作品', target: 3, event: 'save' },
        { id: 'name1',    icon: '✍️', title: '会写自己的名字', desc: '在「名字」描红里写完一个字', target: 1, event: 'trace', where: p => p && p.category === 'name' }
    ],

    state: { progress: {}, done: [], hinted: [] },

    _load() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.KEY));
            if (saved && typeof saved === 'object') {
                this.state.progress = saved.progress || {};
                this.state.done = Array.isArray(saved.done) ? saved.done : [];
                this.state.hinted = Array.isArray(saved.hinted) ? saved.hinted : [];
            }
        } catch (e) { /* 忽略坏数据 */ }
    },

    _save() {
        try { localStorage.setItem(this.KEY, JSON.stringify(this.state)); } catch (e) { /* 存储满时静默 */ }
    },

    get(id) {
        return this.list.find(m => m.id === id);
    },

    // 当前任务 = 第一个未完成（线性解锁）
    current() {
        return this.list.find(m => !this.state.done.includes(m.id)) || null;
    },

    progressOf(m) {
        return Math.min(this.state.progress[m.id] || 0, m.target);
    },

    // 埋点入口：事件名 + 附加条件 payload；完成时庆祝并返回完成的任务数组
    bump(event, payload) {
        payload = payload || {};
        const finished = [];
        this.list.forEach(m => {
            if (this.state.done.includes(m.id)) return;
            if (m.event !== event) return;
            if (m.where && !m.where(payload)) return;
            this.state.progress[m.id] = (this.state.progress[m.id] || 0) + 1;
            if (this.state.progress[m.id] >= m.target) {
                this.state.done.push(m.id);
                finished.push(m);
            }
        });
        if (finished.length) {
            this._save();
            if (typeof App !== 'undefined') {
                App.showToast(finished.length === 1 ? `任务完成：${finished[0].title} 🏆` : `完成 ${finished.length} 个任务 🏆`);
                App.celebrate();
                App.say(finished.length === 1 ? '任务完成！' + finished[0].title : '完成任务！');
            }
        } else {
            this._save();
        }
        this.updateBadge();
        this._renderIfOpen();
        return finished;
    },

    // === 顶栏徽章 ===
    updateBadge() {
        const badge = document.getElementById('mission-badge');
        const btn = document.getElementById('fc-missions');
        if (!badge || !btn) return;
        const cur = this.current();
        if (!cur) {
            badge.textContent = '✓';
            badge.classList.add('all-done');
            return;
        }
        badge.textContent = this.progressOf(cur) + '/' + cur.target;
        badge.classList.remove('all-done');
    },

    // 每个任务只在首次成为"当前任务"时 toast 提示一次
    hintCurrent() {
        const cur = this.current();
        if (!cur || this.state.hinted.includes(cur.id)) return;
        this.state.hinted.push(cur.id);
        this._save();
        if (typeof App !== 'undefined') App.showToast(`小任务：${cur.title}（${cur.desc}）`);
    },

    // === 任务面板 ===
    openPanel() {
        ['sticker-panel', 'shape-panel', 'scene-panel', 'mission-panel'].forEach(pid => {
            const p = document.getElementById(pid);
            if (p) p.classList.remove('open');
        });
        this.renderPanel();
        const panel = document.getElementById('mission-panel');
        if (panel) panel.classList.add('open');
    },

    _renderIfOpen() {
        const panel = document.getElementById('mission-panel');
        if (panel && panel.classList.contains('open')) this.renderPanel();
    },

    renderPanel() {
        const listEl = document.getElementById('mission-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        this.list.forEach(m => {
            const done = this.state.done.includes(m.id);
            const cur = this.current();
            const isCurrent = cur && cur.id === m.id;
            const n = this.progressOf(m);
            const item = document.createElement('div');
            item.className = 'mission-item' + (done ? ' done' : '') + (isCurrent ? ' current' : '') + ((!done && !isCurrent) ? ' locked' : '');
            item.innerHTML = `
                <span class="mission-icon">${done ? '🏆' : m.icon}</span>
                <div class="mission-body">
                    <div class="mission-title">${m.title}</div>
                    <div class="mission-desc">${m.desc}</div>
                    <div class="mission-bar"><i style="width:${(n / m.target * 100).toFixed(0)}%"></i></div>
                </div>
                <span class="mission-count">${done ? '✓' : n + '/' + m.target}</span>`;
            listEl.appendChild(item);
        });
        const summary = document.getElementById('mission-summary');
        if (summary) {
            summary.textContent = this.state.done.length >= this.list.length
                ? '所有任务都完成啦，你就是小画家冠军！🎉'
                : `已完成 ${this.state.done.length} / ${this.list.length} 个任务`;
        }
    }
};

Missions._load();
