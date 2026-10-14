// === 自由画布模块（v5 - 快照撤销 + 贴纸/图形选择弹层 + 贴纸选中拖动）===
const FreeCanvas = {
    canvas: null,
    ctx: null,
    dpr: 1,

    currentColor: '#FF6B6B',
    brushSize: 16,
    brushType: 'crayon',
    currentTool: 'sticker',
    bgColor: '#FFFFFF',
    shapeSize: 40, // 图形大小
    currentStickerId: 'piggy',
    currentStickerCategory: 'friends',
    stickerImages: {},
    // 最近使用的贴纸 id（持久化，"最近"分类 tab 用；null = 未加载）
    _recentIds: null,

    objects: [],
    currentStroke: null,
    _isDrawing: false,
    _lastPoint: null,

    // 快照式撤销历史（深拷贝 objects，上限 40 条）
    _history: [],

    // 贴纸选中/拖动状态
    _selectedObj: null,
    _draggingObj: null,
    _dragStartPos: null,
    _dragMoved: false,
    _dragSnapshot: null,
    _tapDelete: false,

    // 清空二次确认状态
    _clearArmed: false,
    _clearTimer: null,

    // 对称画模式（off / mirror 左右 / quad 四向 / kaleido 万花筒）
    symmetry: 'off',
    // 当前场景底图（null = 纯底色）
    canvasScene: null,
    // 场景目录：label 面板用；emoji+css 渐变做缩略
    scenes: {
        none:   { label: '不用了', emoji: '🚫', css: 'linear-gradient(180deg, #FFFFFF, #F0F0F0)' },
        ocean:  { label: '海底', emoji: '🐟', css: 'linear-gradient(180deg, #9BD7FF 65%, #FFE9B3 65%)' },
        space:  { label: '太空', emoji: '🚀', css: 'linear-gradient(180deg, #3D3A8C 30%, #151538)' },
        meadow: { label: '草地', emoji: '🌻', css: 'linear-gradient(180deg, #BEEBFF 60%, #A8E063 60%)' },
        snow:   { label: '雪地', emoji: '⛄', css: 'linear-gradient(180deg, #C9E3F5 70%, #FFFFFF 70%)' }
    },

    // 离屏缓存
    _cacheCanvas: null,
    _cacheCtx: null,
    _cacheDirty: true,

    // 无限画布
    panX: 0, panY: 0,
    _panStart: null, _panPanStart: null,

    // 图形分类
    currentShapeType: 'circle',
    currentShapeCategory: 'basic',

    shapeCategories: {
        basic:  { label: '基础', shapes: ['circle', 'rect', 'triangle', 'star', 'heart'] },
        animal: { label: '动物', shapes: ['cat', 'bunny', 'bear', 'fish', 'chick'] },
        nature: { label: '自然', shapes: ['sun', 'cloud', 'flower', 'tree', 'mushroom'] },
        fun:    { label: '卡通', shapes: ['house', 'car', 'rocket', 'crown', 'balloon'] }
    },

    bgColors: ['#FFFFFF', '#FFF8E7', '#F0F4FF', '#FDE8E8', '#E8F5E9', '#FFF3E0', '#F3E5F5', '#E0F7FA'],

    onEnter() {
        this.canvas = document.getElementById('freecanvas-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        // 进场景时确保两个弹层都关闭
        ['sticker-panel', 'shape-panel'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.remove('open');
        });
        this._disarmClear();
        this._pinch = null; // 手势状态复位（防止切场景后残留）
        this._updateUndoBtn();
        if (typeof Missions !== 'undefined') { Missions.updateBadge(); Missions.hintCurrent(); }
        this._resizeCanvas();
        this._preloadStickers();
        this._initUI();
        if (!this._eventsBound) { this._addEvents(); this._eventsBound = true; }
        if (!this._onResize) {
            this._onResize = () => { this._resizeCanvas(); this.redraw(); };
        }
        window.removeEventListener('resize', this._onResize);
        window.addEventListener('resize', this._onResize);
        this.redraw();
    },

    _resizeCanvas() {
        const r = this.canvas.getBoundingClientRect();
        if (r.width === 0) return;
        this.canvas.width = r.width * this.dpr;
        this.canvas.height = r.height * this.dpr;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        this._cacheCanvas = document.createElement('canvas');
        this._cacheCanvas.width = this.canvas.width;
        this._cacheCanvas.height = this.canvas.height;
        this._cacheCtx = this._cacheCanvas.getContext('2d');
        this._cacheDirty = true;
    },

    // === UI 初始化 ===
    _initUI() {
        // 颜色（只构建一次，避免重进场景时圆钮颜色与实际选色脱节）
        const cc = document.getElementById('freecanvas-colors');
        if (!cc.children.length) createColorPicker('freecanvas-colors', (hex) => { this.currentColor = hex; });

        // 工具按钮（贴纸/图形工具额外打开对应选择弹层；场景只开面板不切工具）
        document.querySelectorAll('.fc-toolbar .tool-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.dataset.tool === 'scene') { this._togglePanel('scene-panel'); return; }
                this.currentTool = btn.dataset.tool;
                if (btn.dataset.type === 'eraser') this.brushType = 'eraser';
                this._updateHighlight();
                if (btn.dataset.tool === 'sticker') this._togglePanel('sticker-panel');
                else if (btn.dataset.tool === 'shape') this._togglePanel('shape-panel');
            };
        });

        // 画笔类型
        document.querySelectorAll('.fc-toolbar .brush-type-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.id === 'fc-symmetry') return; // 对称按钮走独立循环切换
                this.brushType = btn.dataset.type;
                this.currentTool = 'brush';
                this._updateHighlight();
            };
        });

        // 对称画：关 → 左右 → 四向 → 万花筒 循环
        const symBtn = document.getElementById('fc-symmetry');
        if (symBtn) {
            symBtn.onclick = () => {
                const order = ['off', 'mirror', 'quad', 'kaleido'];
                this.symmetry = order[(order.indexOf(this.symmetry) + 1) % order.length];
                this.currentTool = 'brush';
                this._updateHighlight();
                App.showToast({ off: '对称：关', mirror: '左右对称 ✨', quad: '四向对称 ✨✨', kaleido: '万花筒模式 🎨' }[this.symmetry]);
            };
        }

        // 弹层大小按钮（同步 shapeSize）
        const sizeBtns = Array.from(document.querySelectorAll('#sticker-sizes .picker-size-btn'));
        sizeBtns.forEach(btn => {
            btn.onclick = () => {
                this.shapeSize = parseInt(btn.dataset.size);
                sizeBtns.forEach(b => b.classList.toggle('active', b === btn));
            };
        });

        // 画笔大小
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.brushSize = parseInt(btn.dataset.size);
            };
        });

        // 弹层遮罩 / 返回按钮点击关闭所在弹层
        document.querySelectorAll('.picker-panel [data-close]').forEach(el => {
            el.onclick = () => {
                const panel = el.closest('.picker-panel');
                if (panel) panel.classList.remove('open');
            };
        });

        // 底色
        const bg = document.getElementById('bg-colors');
        bg.innerHTML = '';
        this.bgColors.forEach((c, i) => {
            const d = document.createElement('div');
            d.className = 'bg-dot' + (i === 0 ? ' active' : '');
            d.style.backgroundColor = c;
            if (c === '#FFFFFF') d.style.border = '2px solid #ddd';
            d.onclick = () => { bg.querySelectorAll('.bg-dot').forEach(x => x.classList.remove('active')); d.classList.add('active'); this.bgColor = c; this._cacheDirty = true; this.redraw(); };
            bg.appendChild(d);
        });

        // 功能按钮：撤销 / 保存 / 清空（二次确认）/ 返回
        const undoBtn = document.getElementById('fc-undo');
        if (undoBtn) undoBtn.onclick = () => this._undo();
        const saveBtn = document.getElementById('fc-save');
        if (saveBtn) saveBtn.onclick = () => this._saveArtwork();
        const clearBtn = document.querySelector('.action-tools .btn-clear');
        if (clearBtn) clearBtn.onclick = () => this._handleClear(clearBtn);
        const backBtn = document.querySelector('.action-tools .btn-back');
        if (backBtn) backBtn.onclick = () => App.showScene('home');

        // 贴纸操作条按钮
        document.querySelectorAll('#sticker-action-bar .sab-btn').forEach(btn => {
            btn.onclick = () => this._stickerAction(btn.dataset.act);
        });

        // 小画家任务按钮
        const missionBtn = document.getElementById('fc-missions');
        if (missionBtn) missionBtn.onclick = () => Missions.openPanel();
    },

    // === 选择弹层（贴纸/图形/场景） ===
    _togglePanel(id) {
        const panel = document.getElementById(id);
        if (!panel) return;
        const wasOpen = panel.classList.contains('open');
        // 先收起所有弹层（再次点击同工具 = 仅关闭，保留工具）
        ['sticker-panel', 'shape-panel', 'scene-panel', 'mission-panel'].forEach(pid => {
            const p = document.getElementById(pid);
            if (p) p.classList.remove('open');
        });
        if (wasOpen) return;
        if (id === 'sticker-panel') this._renderStickerPanel();
        else if (id === 'shape-panel') this._renderShapePanel();
        else if (id === 'scene-panel') this._renderScenePanel();
        panel.classList.add('open');
    },

    _renderStickerPanel() {
        if (typeof StickerLibrary === 'undefined') return;
        // 分类 tabs（有最近记录时"最近"置顶）
        const tabsEl = document.getElementById('sticker-tabs');
        tabsEl.innerHTML = '';
        const tabs = [];
        if (this._getRecent().length) tabs.push(['recent', '最近']);
        Object.keys(StickerLibrary.categories).forEach(cat => {
            tabs.push([cat, (StickerLibrary.categories[cat] && StickerLibrary.categories[cat].label) || cat]);
        });
        tabs.forEach(([cat, label]) => {
            const tab = document.createElement('button');
            tab.className = 'picker-tab' + (cat === this.currentStickerCategory ? ' active' : '');
            tab.textContent = label;
            tab.onclick = () => { this.currentStickerCategory = cat; this._renderStickerPanel(); };
            tabsEl.appendChild(tab);
        });
        // 贴纸网格
        const gridEl = document.getElementById('sticker-grid');
        gridEl.innerHTML = '';
        const items = this.currentStickerCategory === 'recent'
            ? this._getRecent().map(id => StickerLibrary.items.find(it => it.id === id)).filter(Boolean)
            : StickerLibrary.byCategory(this.currentStickerCategory);
        items.forEach(sticker => {
            const item = document.createElement('button');
            item.className = 'picker-item' + (sticker.id === this.currentStickerId ? ' active' : '');
            item.title = sticker.name;
            item.innerHTML = `<img src="${sticker.source}" alt="${sticker.name}">`;
            item.onclick = () => {
                this.currentStickerId = sticker.id;
                this.currentTool = 'sticker';
                this._updateHighlight();
                this._togglePanel('sticker-panel'); // 选中即关闭，回画布点放
            };
            gridEl.appendChild(item);
        });
        // 大小按钮高亮同步 shapeSize（无精确匹配时取最接近档位）
        const sizeBtns = Array.from(document.querySelectorAll('#sticker-sizes .picker-size-btn'));
        let match = sizeBtns.find(b => parseInt(b.dataset.size) === this.shapeSize);
        if (!match && sizeBtns.length) {
            match = sizeBtns.reduce((best, b) =>
                Math.abs(parseInt(b.dataset.size) - this.shapeSize) < Math.abs(parseInt(best.dataset.size) - this.shapeSize) ? b : best);
        }
        sizeBtns.forEach(b => b.classList.toggle('active', b === match));
    },

    _renderShapePanel() {
        const tabsEl = document.getElementById('shape-tabs');
        tabsEl.innerHTML = '';
        Object.keys(this.shapeCategories).forEach(cat => {
            const tab = document.createElement('button');
            tab.className = 'picker-tab' + (cat === this.currentShapeCategory ? ' active' : '');
            tab.textContent = this.shapeCategories[cat].label;
            tab.onclick = () => { this.currentShapeCategory = cat; this._renderShapePanel(); };
            tabsEl.appendChild(tab);
        });
        const gridEl = document.getElementById('shape-grid');
        gridEl.innerHTML = '';
        this.shapeCategories[this.currentShapeCategory].shapes.forEach(type => {
            const item = document.createElement('button');
            item.className = 'picker-item' + (type === this.currentShapeType ? ' active' : '');
            item.title = type;
            item.innerHTML = this._shapeIcon(type);
            item.onclick = () => {
                this.currentShapeType = type;
                this.currentTool = 'shape';
                this._updateHighlight();
                this._togglePanel('shape-panel'); // 选中即关闭，回画布点放
            };
            gridEl.appendChild(item);
        });
    },

    _renderScenePanel() {
        const gridEl = document.getElementById('scene-grid');
        gridEl.innerHTML = '';
        Object.keys(this.scenes).forEach(key => {
            const sc = this.scenes[key];
            const item = document.createElement('button');
            item.className = 'picker-item scene-item' + ((this.canvasScene || 'none') === key ? ' active' : '');
            item.title = sc.label;
            item.innerHTML = `<span class="scene-thumb" style="background:${sc.css}">${sc.emoji}</span><span class="scene-name">${sc.label}</span>`;
            item.onclick = () => {
                this.canvasScene = key === 'none' ? null : key;
                this._cacheDirty = true;
                this.redraw();
                if (key !== 'none' && typeof Missions !== 'undefined') Missions.bump('scene', { key });
                const panel = document.getElementById('scene-panel');
                if (panel) panel.classList.remove('open');
                App.showToast(key === 'none' ? '回到白画布啦' : `欢迎来到${sc.label} 🎨`);
            };
            gridEl.appendChild(item);
        });
    },

    // === 场景底图绘制（视口坐标，不随画布拖动；伪随机保证重绘一致） ===
    _drawScene(ctx, w, h, key) {
        const rnd = (i) => {
            const x = Math.sin(i * 127.1 + key.length * 311.7) * 43758.5453;
            return x - Math.floor(x);
        };
        ctx.save();

        if (key === 'ocean') {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#9BD7FF'); g.addColorStop(1, '#4A90D9');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            // 沙底
            ctx.fillStyle = '#FFE9B3';
            ctx.beginPath(); ctx.moveTo(0, h);
            ctx.quadraticCurveTo(w * 0.5, h - 60, w, h - 20); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
            // 水草
            ctx.strokeStyle = '#6BCB77'; ctx.lineWidth = 7; ctx.lineCap = 'round';
            [0.12, 0.2, 0.78, 0.88].forEach((fx, i) => {
                const bx = w * fx, by = h - 14 - rnd(i) * 16;
                const sway = 16 + rnd(i + 9) * 14;
                ctx.beginPath(); ctx.moveTo(bx, by);
                ctx.quadraticCurveTo(bx - sway, by - 34, bx - sway * 0.4, by - 66 - rnd(i + 5) * 22);
                ctx.stroke();
            });
            // 气泡
            for (let i = 0; i < 12; i++) {
                const bx = rnd(i + 30) * w, by = h * 0.2 + rnd(i + 60) * h * 0.62, br = 3 + rnd(i + 90) * 6;
                ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath(); ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.3, 0, Math.PI * 2); ctx.fill();
            }
        } else if (key === 'space') {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#3D3A8C'); g.addColorStop(1, '#151538');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            // 星星
            for (let i = 0; i < 46; i++) {
                const sx = rnd(i + 1) * w, sy = rnd(i + 50) * h, sr = 1 + rnd(i + 99) * 2.2;
                ctx.fillStyle = i % 5 === 0 ? '#FFE9A0' : 'rgba(255,255,255,0.9)';
                ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
            }
            // 带环行星
            const px = w * 0.82, py = h * 0.24, pr = Math.min(w, h) * 0.085;
            ctx.fillStyle = '#FD79A8';
            ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#E8699C';
            ctx.beginPath(); ctx.arc(px - pr * 0.28, py + pr * 0.2, pr * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFD93D'; ctx.lineWidth = 5;
            ctx.save(); ctx.translate(px, py); ctx.rotate(-0.3);
            ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.75, pr * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            // 小月亮
            const mx = w * 0.14, my = h * 0.7, mr = Math.min(w, h) * 0.05;
            ctx.fillStyle = '#FFE9B3';
            ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ECD39A';
            ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.15, mr * 0.2, 0, Math.PI * 2);
            ctx.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.14, 0, Math.PI * 2); ctx.fill();
        } else if (key === 'meadow') {
            const skyH = h * 0.62;
            const g = ctx.createLinearGradient(0, 0, 0, skyH);
            g.addColorStop(0, '#BEEBFF'); g.addColorStop(1, '#E8F7FF');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, skyH);
            // 太阳
            const sx = w * 0.16, sy = h * 0.16, sr = Math.min(w, h) * 0.06;
            ctx.fillStyle = 'rgba(255,217,61,0.35)';
            ctx.beginPath(); ctx.arc(sx, sy, sr * 1.7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#FFD93D';
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
            // 云
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            [[0.42, 0.12], [0.7, 0.22], [0.9, 0.1]].forEach(([fx, fy], i) => {
                const cx0 = w * fx, cy0 = h * fy + rnd(i) * 10;
                ctx.beginPath();
                ctx.arc(cx0, cy0, 14, 0, Math.PI * 2);
                ctx.arc(cx0 + 18, cy0 + 4, 11, 0, Math.PI * 2);
                ctx.arc(cx0 - 17, cy0 + 5, 10, 0, Math.PI * 2);
                ctx.fill();
            });
            // 草地（两层波浪）
            ctx.fillStyle = '#8ED04B';
            ctx.beginPath(); ctx.moveTo(0, skyH);
            ctx.quadraticCurveTo(w * 0.25, skyH - 26, w * 0.5, skyH + 4);
            ctx.quadraticCurveTo(w * 0.78, skyH + 30, w, skyH - 8);
            ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#A8E063';
            ctx.beginPath(); ctx.moveTo(0, h);
            ctx.quadraticCurveTo(w * 0.3, skyH + 30, w * 0.55, skyH + 60);
            ctx.quadraticCurveTo(w * 0.8, skyH + 86, w, skyH + 50);
            ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
            // 小花
            for (let i = 0; i < 7; i++) {
                const fx0 = 0.06 + rnd(i + 7) * 0.88, fy0 = skyH + 30 + rnd(i + 20) * (h - skyH - 44);
                ctx.fillStyle = ['#FD79A8', '#FF6B6B', '#FFE066', '#A29BFE'][i % 4];
                for (let p = 0; p < 5; p++) {
                    const a = p / 5 * Math.PI * 2;
                    ctx.beginPath();
                    ctx.arc(fx0 * w + Math.cos(a) * 5, fy0 + Math.sin(a) * 5, 3.2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = '#FFD93D';
                ctx.beginPath(); ctx.arc(fx0 * w, fy0, 2.6, 0, Math.PI * 2); ctx.fill();
            }
        } else if (key === 'snow') {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#C9E3F5'); g.addColorStop(1, '#F7FBFF');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            // 远处松树
            [[0.1, 0.52], [0.22, 0.6]].forEach(([fx, fy], i) => {
                const tx = w * fx, ty = h * fy, ts = Math.min(w, h) * (0.07 + i * 0.015);
                ctx.fillStyle = '#5DA98F';
                ctx.beginPath();
                ctx.moveTo(tx, ty - ts * 1.5); ctx.lineTo(tx + ts * 0.7, ty); ctx.lineTo(tx - ts * 0.7, ty);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(tx, ty - ts * 1.5); ctx.lineTo(tx + ts * 0.34, ty - ts * 0.75); ctx.lineTo(tx - ts * 0.34, ty - ts * 0.75);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#8D6E63';
                ctx.fillRect(tx - ts * 0.07, ty, ts * 0.14, ts * 0.28);
            });
            // 雪地
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.moveTo(0, h);
            ctx.quadraticCurveTo(w * 0.3, h * 0.7, w * 0.55, h * 0.8);
            ctx.quadraticCurveTo(w * 0.8, h * 0.9, w, h * 0.74);
            ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
            // 雪花
            for (let i = 0; i < 30; i++) {
                const fx0 = rnd(i + 3) * w, fy0 = rnd(i + 40) * h * 0.85;
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.beginPath(); ctx.arc(fx0, fy0, 1.4 + rnd(i + 80) * 2, 0, Math.PI * 2); ctx.fill();
            }
        }

        ctx.restore();
    },

    // === 历史（快照式撤销） ===
    _pushHistory() {
        this._pushSnapshot(JSON.parse(JSON.stringify(this.objects)));
    },

    _pushSnapshot(snap) {
        this._history.push(snap);
        if (this._history.length > 40) this._history.shift();
        this._updateUndoBtn();
    },

    _updateUndoBtn() {
        const btn = document.getElementById('fc-undo');
        if (btn) btn.disabled = !this._history.length;
    },

    _undo() {
        if (!this._history.length) return;
        this.objects = this._history.pop();
        this._selectedObj = null;
        this._draggingObj = null;
        this._cacheDirty = true;
        this.redraw();
        this._updateUndoBtn();
        this._updateActionBar();
    },

    // === 清空（二次确认防误触） ===
    _handleClear(clearBtn) {
        if (this._clearArmed) {
            this._disarmClear();
            this._pushHistory(); // 清空前入栈，误清空可撤销
            this.objects = [];
            this._selectedObj = null;
            this._draggingObj = null;
            this.canvasScene = null; // 清空 = 回到干净画布（场景一并清掉）
            this.panX = 0; this.panY = 0;
            this._cacheDirty = true;
            this.redraw();
            this._updateActionBar();
            App.showToast('已清空');
            return;
        }
        this._clearArmed = true;
        clearBtn.style.backgroundColor = '#FFCDD2';
        App.showToast('再点一次，清除全部画作');
        clearTimeout(this._clearTimer);
        this._clearTimer = setTimeout(() => this._disarmClear(), 2500);
    },

    _disarmClear() {
        this._clearArmed = false;
        clearTimeout(this._clearTimer);
        const clearBtn = document.querySelector('.action-tools .btn-clear');
        if (clearBtn) clearBtn.style.backgroundColor = '';
    },

    // === 保存作品 ===
    _saveArtwork() {
        if (!this.objects.length) { App.showToast('先画点什么吧～'); return; }
        const record = ArtworkStore.save(this.canvas, { scene: 'freecanvas', name: '自由画作' });
        if (record) {
            App.showToast('作品已保存 🎉');
            if (typeof Missions !== 'undefined') Missions.bump('save');
            if (App.playStickerSound) App.playStickerSound();
        } else {
            App.showToast('保存失败，稍后再试');
        }
    },

    _preloadStickers() {
        if (typeof StickerLibrary === 'undefined') return;
        let pending = 0;
        StickerLibrary.items.forEach(sticker => {
            if (this.stickerImages[sticker.id]) return;
            const img = new Image();
            pending++;
            img.onload = () => { if (--pending === 0) this.redraw(); };
            img.src = sticker.source;
            this.stickerImages[sticker.id] = img;
        });
    },

    _shapeIcon(type) {
        const icons = {
            circle: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
            rect: '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
            triangle: '<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,3 22,21 2,21" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
            star: '<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
            heart: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21C12 21 3 14 3 8.5 3 5.5 5.5 3 8 3c1.5 0 3 1 4 3 1-2 2.5-3 4-3 2.5 0 5 2.5 5 5.5C21 14 12 21 12 21z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
            cat: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 6L6 2 9 6M20 6L18 2 15 6" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="11" r="1" fill="currentColor"/><circle cx="15" cy="11" r="1" fill="currentColor"/><path d="M10 15 Q12 17 14 15" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
            bunny: '<svg viewBox="0 0 24 24" width="18" height="18"><ellipse cx="8" cy="4" rx="3" ry="6" stroke="currentColor" stroke-width="1.5" fill="none"/><ellipse cx="16" cy="4" rx="3" ry="6" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="14" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="10" cy="13" r="1" fill="currentColor"/><circle cx="14" cy="13" r="1" fill="currentColor"/></svg>',
            bear: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="18" cy="6" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><ellipse cx="12" cy="15" rx="2" ry="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
            fish: '<svg viewBox="0 0 24 24" width="18" height="18"><ellipse cx="10" cy="12" rx="8" ry="5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M18 12l4-4v8z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="6" cy="11" r="1" fill="currentColor"/></svg>',
            chick: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M9 16 Q12 18 15 16" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><path d="M11 14l1 2 1-2" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
            sun: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><g stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/></g></svg>',
            cloud: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19a4 4 0 01-.5-7.97A7 7 0 0118 13h1a3 3 0 010 6H6z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
            flower: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="9" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8" cy="7" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="16" cy="7" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="7" cy="11" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="17" cy="11" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="9" r="2" fill="currentColor"/><line x1="12" y1="14" x2="12" y2="22" stroke="currentColor" stroke-width="1.5"/></svg>',
            tree: '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="10" y="18" width="4" height="4" stroke="currentColor" stroke-width="1.2" fill="none"/><polygon points="12,2 4,12 8,12 2,18 22,18 16,12 20,12" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
            mushroom: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 14a8 8 0 0116 0" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="9" y="14" width="6" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="11" r="1" fill="currentColor"/></svg>',
            house: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 12l9-9 9 9" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="5" y="12" width="14" height="9" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="9" y="16" width="3" height="5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
            car: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 14l2-5h10l2 5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="3" y="14" width="18" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="7" cy="19" r="2" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="17" cy="19" r="2" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
            rocket: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2c-2 4-3 8-3 12h6c0-4-1-8-3-12z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M9 14l-3 4h3M15 14l3 4h-3" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="12" cy="10" r="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
            crown: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M2 18l3-10 4 5 3-8 3 8 4-5 3 10z" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="2" y1="18" x2="22" y2="18" stroke="currentColor" stroke-width="1.5"/></svg>',
            balloon: '<svg viewBox="0 0 24 24" width="18" height="18"><ellipse cx="12" cy="9" rx="6" ry="8" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10 17l-1 5M14 17l1 5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M12 17l-1 1h2z" fill="currentColor"/></svg>'
        };
        return icons[type] || icons.circle;
    },

    _updateHighlight() {
        document.querySelectorAll('.fc-toolbar .tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === this.currentTool));
        document.querySelectorAll('.fc-toolbar .brush-type-btn').forEach(b => b.classList.toggle('active', this.currentTool === 'brush' && b.dataset.type === this.brushType));
        // 对称按钮独立高亮（无 data-type，上面会被清掉）
        const symBtn = document.getElementById('fc-symmetry');
        if (symBtn) symBtn.classList.toggle('active', this.symmetry !== 'off');
        this._updateActionBar(); // 切走贴纸工具时收起操作条
    },

    // === 事件 ===
    _addEvents() {
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._handleStart(e); }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._handleMove(e); }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this._handleEnd(); }, { passive: false });
        this.canvas.addEventListener('touchcancel', () => { if (this._pinch) this._pinchEnd(); }, { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this._handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this._handleMove(e));
        this.canvas.addEventListener('mouseup', () => this._handleEnd());
        // 滚轮缩放选中贴纸（桌面端；一次滚动连击合并为一条撤销记录）
        this.canvas.addEventListener('wheel', (e) => {
            const s = this._selectedObj;
            if (this.currentTool !== 'sticker' || !s || s.type !== 'sticker') return;
            e.preventDefault();
            if (!this._wheelSnap) this._wheelSnap = JSON.parse(JSON.stringify(this.objects));
            s.size = Math.min(280, Math.max(24, s.size * (e.deltaY < 0 ? 1.12 : 0.89)));
            this._cacheDirty = true;
            this.redraw();
            clearTimeout(this._wheelTimer);
            this._wheelTimer = setTimeout(() => {
                if (this._wheelSnap) { this._pushSnapshot(this._wheelSnap); this._wheelSnap = null; }
            }, 600);
        }, { passive: false });
        // 同 tracing：拖出画布松开时在 window 兜底，防止悬停继续作画
        window.addEventListener('mouseup', () => { if (this._isDrawing || this._panStart) this._handleEnd(); });
    },

    _wPos(e) {
        const r = this.canvas.getBoundingClientRect();
        const s = e.touches ? e.touches[0] : e;
        return { x: (s.clientX - r.left - this.panX), y: (s.clientY - r.top - this.panY) };
    },

    _handleStart(e) {
        const pos = this._wPos(e);
        if (this.currentTool === 'pan') {
            const s = e.touches ? e.touches[0] : e;
            this._panStart = { x: s.clientX, y: s.clientY };
            this._panPanStart = { x: this.panX, y: this.panY };
            return;
        }
        // 双指落在画布：对选中贴纸捏合缩放+旋转（无选中时不响应，兼防误画）
        if (e.touches && e.touches.length >= 2) { this._pinchStart(e); return; }
        if (this.currentTool === 'fill') { this._doFill(pos); return; }
        if (this.currentTool === 'sticker') { this._stickerStart(pos); return; }
        if (this.currentTool === 'shape') { this._placeShape(pos); return; }
        this._startStroke(pos);
    },

    _handleMove(e) {
        if (this._pinch && e.touches && e.touches.length >= 2) { this._pinchMove(e); return; }
        if (this.currentTool === 'pan' && this._panStart) {
            const s = e.touches ? e.touches[0] : e;
            this.panX = this._panPanStart.x + (s.clientX - this._panStart.x);
            this.panY = this._panPanStart.y + (s.clientY - this._panStart.y);
            this._cacheDirty = true;
            this.redraw(); return;
        }
        if (this.currentTool === 'sticker' && this._draggingObj) {
            // 拖动本手势开始时命中的已选中贴纸
            const pos = this._wPos(e);
            if (!this._dragMoved) {
                const dx = pos.x - this._dragStartPos.x, dy = pos.y - this._dragStartPos.y;
                if (dx * dx + dy * dy < 9) return; // 轻微抖动不算拖动
                this._dragMoved = true;
                this._tapDelete = false; // 有位移就不是删除点按
                this._dragSnapshot = JSON.parse(JSON.stringify(this.objects)); // 移动前快照
            }
            this._draggingObj.x = pos.x;
            this._draggingObj.y = pos.y;
            this._cacheDirty = true;
            if (!this._pending) { this._pending = true; requestAnimationFrame(() => { this.redraw(); this._pending = false; }); }
            return;
        }
        if (this.currentTool === 'brush') this._continueStroke(this._wPos(e));
    },

    _handleEnd() {
        if (this._pinch) { this._pinchEnd(); return; }
        if (this.currentTool === 'pan') { this._panStart = null; return; }
        if (this.currentTool === 'sticker') { this._stickerEnd(); return; }
        this._endStroke();
    },

    // === 双指捏合：选中贴纸缩放 + 旋转 ===
    _pinchStart(e) {
        const s = this._selectedObj;
        if (!s || s.type !== 'sticker') return;
        // 接管手势：取消可能进行中的单指拖动
        this._draggingObj = null;
        this._dragMoved = false;
        this._dragSnapshot = null;
        this._tapDelete = false;
        const [a, b] = [e.touches[0], e.touches[1]];
        this._pinch = {
            snapshot: JSON.parse(JSON.stringify(this.objects)),
            startDist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            startAngle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
            startSize: s.size,
            startRot: s.rotation || 0,
            moved: false
        };
    },

    _pinchMove(e) {
        const s = this._selectedObj;
        if (!s) { this._pinch = null; return; }
        const [a, b] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const angle = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
        const scale = dist / (this._pinch.startDist || 1);
        const next = Math.min(280, Math.max(24, this._pinch.startSize * scale));
        const nextRot = this._pinch.startRot + (angle - this._pinch.startAngle) * 180 / Math.PI;
        if (Math.abs(next - s.size) > 0.5 || Math.abs(nextRot - (s.rotation || 0)) > 0.5) this._pinch.moved = true;
        s.size = next;
        s.rotation = nextRot;
        this._cacheDirty = true;
        if (!this._pending) { this._pending = true; requestAnimationFrame(() => { this.redraw(); this._pending = false; }); }
    },

    _pinchEnd() {
        if (this._pinch && this._pinch.moved) this._pushSnapshot(this._pinch.snapshot); // 整个手势一条撤销记录
        this._pinch = null;
    },

    // === 最近使用的贴纸（Settings 持久化，最多 16 个） ===
    _getRecent() {
        if (!this._recentIds) {
            const saved = (typeof Settings !== 'undefined') ? Settings.get('recentStickers', []) : [];
            this._recentIds = Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
        }
        return this._recentIds;
    },

    _rememberRecent(id) {
        const list = this._getRecent().filter(x => x !== id);
        list.unshift(id);
        if (list.length > 16) list.length = 16;
        this._recentIds = list;
        if (typeof Settings !== 'undefined') Settings.set('recentStickers', list);
    },

    // === 贴纸操作条（选中贴纸后浮现：放大/缩小/旋转/复制/删除） ===
    _updateActionBar() {
        const bar = document.getElementById('sticker-action-bar');
        if (!bar) return;
        const show = !!(this._selectedObj && this._selectedObj.type === 'sticker' && this.currentTool === 'sticker');
        bar.classList.toggle('open', show);
    },

    _stickerAction(act) {
        const s = this._selectedObj;
        if (!s || s.type !== 'sticker') return;
        // 缩放/旋转连按合并为一次撤销（同一对象同一动作 900ms 内不重复入栈）
        const now = Date.now();
        const coalesce = ['zoomin', 'zoomout', 'rotate'].includes(act)
            && this._lastAct && this._lastAct.act === act && this._lastAct.obj === s && (now - this._lastAct.t) < 900;
        if (!coalesce) this._pushHistory();
        this._lastAct = { act, obj: s, t: now };

        if (act === 'delete') {
            const idx = this.objects.indexOf(s);
            if (idx >= 0) this.objects.splice(idx, 1);
            this._selectedObj = null;
        } else if (act === 'zoomin' || act === 'zoomout') {
            s.size = Math.min(280, Math.max(24, s.size * (act === 'zoomin' ? 1.25 : 0.8)));
        } else if (act === 'rotate') {
            s.rotation = ((s.rotation || 0) + 15) % 360;
            if (typeof Missions !== 'undefined') Missions.bump('rotate');
        } else if (act === 'copy') {
            const copy = JSON.parse(JSON.stringify(s));
            copy.x += 28;
            copy.y += 28;
            this.objects.push(copy);
            this._selectedObj = copy; // 复制后选中新副本，可继续摆放
            if (typeof Missions !== 'undefined') Missions.bump('copy');
        }
        this._cacheDirty = true;
        this.redraw();
        this._updateActionBar();
    },

    // === 贴纸选中 / 拖动 / 删除 ===
    _stickerStart(pos) {
        this._draggingObj = null;
        this._dragMoved = false;
        this._dragSnapshot = null;
        this._tapDelete = false;
        this._dragStartPos = pos;
        // 命中测试：从最上层往下找贴纸
        let hit = null;
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const o = this.objects[i];
            if (o.type !== 'sticker') continue;
            const dx = pos.x - o.x, dy = pos.y - o.y;
            if (dx * dx + dy * dy <= o.size * o.size) { hit = o; break; }
        }
        if (hit) {
            if (hit === this._selectedObj) {
                // 已选中：本手势可拖动；若全程无位移，手势结束时按点按删除
                this._draggingObj = hit;
                this._tapDelete = true;
            } else {
                // 未选中：本次手势仅选中，不拖动
                this._selectedObj = hit;
                this.redraw();
            }
            this._updateActionBar();
            return;
        }
        if (this._selectedObj) {
            // 空白处且已有选中 → 仅取消选中
            this._selectedObj = null;
            this.redraw();
            this._updateActionBar();
            return;
        }
        // 空白处且无选中 → 放置新贴纸
        this._pushHistory();
        this._placeSticker(pos);
    },

    _stickerEnd() {
        if (this._draggingObj) {
            if (this._tapDelete) {
                // 点按已选中贴纸 → 删除（删除前入栈）
                this._pushHistory();
                const idx = this.objects.indexOf(this._draggingObj);
                if (idx >= 0) this.objects.splice(idx, 1);
                this._selectedObj = null;
                this._cacheDirty = true;
                this.redraw();
            } else if (this._dragMoved && this._dragSnapshot) {
                // 拖动结束：移动前的快照入栈
                this._pushSnapshot(this._dragSnapshot);
            }
        }
        this._draggingObj = null;
        this._dragMoved = false;
        this._dragSnapshot = null;
        this._tapDelete = false;
        this._updateActionBar();
    },

    // === 笔画 ===
    _startStroke(p) {
        this._isDrawing = true; this._lastPoint = p;
        this.currentStroke = { type: 'stroke', brushType: this.brushType === 'eraser' ? 'eraser' : this.brushType, color: this.currentColor, size: this.brushType === 'eraser' ? this.brushSize * 2 : this.brushSize, points: [p] };
        // 对称画：以落笔时的视口中心为对称轴/对称心（世界坐标），保证所见即所得
        if (this.symmetry !== 'off') {
            const r = this.canvas.getBoundingClientRect();
            this.currentStroke.sym = this.symmetry;
            this.currentStroke.cx = r.width / 2 - this.panX;
            this.currentStroke.cy = r.height / 2 - this.panY;
        }
        // 任务埋点：任何落笔都上报（sym/scene 由任务条件自行过滤）
        if (typeof Missions !== 'undefined') Missions.bump('stroke', { sym: this.symmetry, scene: this.canvasScene });
        if (typeof App !== 'undefined' && App.playDrawSound) App.playDrawSound();
        this.redraw();
    },
    _continueStroke(p) {
        if (!this._isDrawing || !this.currentStroke) return;
        const dx = p.x - this._lastPoint.x, dy = p.y - this._lastPoint.y;
        if (dx * dx + dy * dy < 2) return;
        this.currentStroke.points.push(p); this._lastPoint = p;
        if (typeof App !== 'undefined' && App.playDrawSound) App.playDrawSound();
        if (!this._pending) { this._pending = true; requestAnimationFrame(() => { this.redraw(); this._pending = false; }); }
    },
    _endStroke() {
        if (this.currentStroke && this.currentStroke.points.length) {
            this._pushHistory(); // 快照不含本笔画 → 撤销即删掉本笔画
            this.objects.push(this.currentStroke);
            this._cacheDirty = true;
        }
        this.currentStroke = null; this._isDrawing = false;
    },

    // === 放置图形 ===
    _placeShape(pos) {
        this._pushHistory(); // 放置前快照
        this.objects.push({ type: 'shape', shapeType: this.currentShapeType, x: pos.x, y: pos.y, size: this.shapeSize, fillColor: null, strokeColor: this.currentColor, strokeWidth: 3 });
        this._cacheDirty = true;
        this.redraw();
    },

    _placeSticker(pos) {
        const obj = { type: 'sticker', stickerId: this.currentStickerId, x: pos.x, y: pos.y, size: this.shapeSize * 1.6, rotation: 0 };
        this.objects.push(obj);
        this._selectedObj = obj; // 新贴纸默认选中：再点一下删除，按住可拖动
        this._rememberRecent(this.currentStickerId);
        this._cacheDirty = true;
        this.redraw();
        this._updateActionBar();
        if (typeof Missions !== 'undefined') Missions.bump('sticker', { scene: this.canvasScene });
        if (typeof App !== 'undefined' && App.playStickerSound) App.playStickerSound();
    },

    // === 填充 ===
    _doFill(pos) {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const o = this.objects[i];
            if (o.type === 'shape') {
                const dx = pos.x - o.x, dy = pos.y - o.y;
                if (dx * dx + dy * dy <= o.size * o.size * 1.2) {
                    this._pushHistory(); // 填充前快照
                    o.fillColor = this.currentColor;
                    this._cacheDirty = true;
                    if (typeof App !== 'undefined' && App.playFillSound) App.playFillSound();
                    this.redraw(); return;
                }
            }
        }
    },

    // === 渲染 ===
    redraw() {
        const ctx = this.ctx;
        const r = this.canvas.getBoundingClientRect();
        ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = this.bgColor; ctx.fillRect(0, 0, r.width, r.height);
        ctx.restore();

        // 场景底图：铺满视口、不随画布拖动，画在所有内容之下
        if (this.canvasScene && this.scenes[this.canvasScene]) {
            ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this._drawScene(ctx, r.width, r.height, this.canvasScene);
            ctx.restore();
        }

        if (this._cacheDirty && this._cacheCtx) {
            const cc = this._cacheCtx;
            cc.clearRect(0, 0, this._cacheCanvas.width, this._cacheCanvas.height);
            cc.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * this.panX, this.dpr * this.panY);
            this.objects.forEach(o => this._drawObj(cc, o));
            this._cacheDirty = false;
        }

        if (this._cacheCanvas) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(this._cacheCanvas, 0, 0);
            ctx.restore();
        }

        if (this.currentStroke) {
            if (this.currentStroke.brushType === 'eraser' && this._cacheCtx) {
                // 橡皮实时段：缓存层整体重绘（objects + 当前笔画），避免 destination-out 误伤底色/场景
                const cc = this._cacheCtx;
                cc.setTransform(1, 0, 0, 1, 0, 0);
                cc.clearRect(0, 0, this._cacheCanvas.width, this._cacheCanvas.height);
                cc.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * this.panX, this.dpr * this.panY);
                this.objects.forEach(o => this._drawObj(cc, o));
                this._drawObj(cc, this.currentStroke);
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(this._cacheCanvas, 0, 0);
                ctx.restore();
            } else {
                ctx.save();
                ctx.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * this.panX, this.dpr * this.panY);
                this._drawObj(ctx, this.currentStroke);
                ctx.restore();
            }
        }

        // 选中贴纸的虚线指示圈
        if (this._selectedObj) {
            ctx.save();
            ctx.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * this.panX, this.dpr * this.panY);
            ctx.strokeStyle = '#FFA36C';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 5]);
            ctx.beginPath();
            ctx.arc(this._selectedObj.x, this._selectedObj.y, this._selectedObj.size + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    },

    _drawObj(ctx, o) {
        if (o.type === 'stroke') this._drawStroke(ctx, o);
        else if (o.type === 'shape') this._drawShapeObj(ctx, o);
        else if (o.type === 'sticker') this._drawStickerObj(ctx, o);
    },

    _drawStickerObj(ctx, s) {
        const img = this.stickerImages[s.stickerId];
        const size = s.size;
        if (img && img.complete && img.naturalWidth) {
            ctx.save();
            if (s.rotation) {
                ctx.translate(s.x, s.y);
                ctx.rotate(s.rotation * Math.PI / 180);
                ctx.drawImage(img, -size, -size, size * 2, size * 2);
            } else {
                ctx.drawImage(img, s.x - size, s.y - size, size * 2, size * 2);
            }
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.fillStyle = 'rgba(255,248,231,0.96)';
        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        this._drawHappyFace(ctx, s.x, s.y, size * 0.42);
        ctx.restore();
    },

    // 对称副本点集：mirror=2 份，quad=4 份，kaleido=6 旋转×镜像=12 份
    _symCopies(s) {
        const cx = s.cx, cy = s.cy;
        const rot = (p, a) => {
            const c = Math.cos(a), sn = Math.sin(a);
            const dx = p.x - cx, dy = p.y - cy;
            return { x: cx + dx * c - dy * sn, y: cy + dx * sn + dy * c };
        };
        const mirX = (p) => ({ x: 2 * cx - p.x, y: p.y });
        const mirY = (p) => ({ x: p.x, y: 2 * cy - p.y });
        const pts = s.points;
        if (s.sym === 'mirror') return [pts, pts.map(mirX)];
        if (s.sym === 'quad') return [pts, pts.map(mirX), pts.map(p => mirY(mirX(p))), pts.map(mirY)];
        if (s.sym === 'kaleido') {
            const out = [];
            for (let k = 0; k < 6; k++) {
                const a = k * Math.PI / 3;
                out.push(pts.map(p => rot(p, a)));
                out.push(pts.map(p => mirX(rot(p, a))));
            }
            return out;
        }
        return [pts];
    },

    _drawStroke(ctx, s, ptsOverride) {
        // 对称模式：绘制全部副本（含原笔画本身）
        if (s.sym && !ptsOverride) {
            this._symCopies(s).forEach(tp => this._drawStroke(ctx, s, tp));
            return;
        }
        const pts = ptsOverride || s.points;
        if (!pts.length) return;
        if (s.brushType === 'eraser') {
            ctx.save(); ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
            ctx.restore(); return;
        }
        // 荧光笔：宽扁半透明
        if (s.brushType === 'highlighter') {
            ctx.save();
            ctx.globalAlpha = 0.28;
            ctx.strokeStyle = s.color; ctx.lineWidth = s.size * 2.2;
            ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
            if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size * 1.1, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
            ctx.restore(); return;
        }
        // 彩虹笔：颜色渐变
        if (s.brushType === 'rainbow') {
            const rainbow = ['#FF6B6B','#FFB347','#FFE066','#6BCB77','#74B9FF','#C77DFF','#FD79A8'];
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s.size;
            for (let i = 1; i < pts.length; i++) {
                ctx.strokeStyle = rainbow[i % rainbow.length];
                ctx.beginPath(); ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
            }
            if (pts.length === 1) {
                ctx.fillStyle = rainbow[0];
                ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore(); return;
        }
        // 喷雾：随机散点（对称副本多时减少每点散点数保帧率）
        if (s.brushType === 'spray') {
            const dots = s.sym ? 5 : 12;
            ctx.save(); ctx.fillStyle = s.color;
            pts.forEach(p => {
                for (let i = 0; i < dots; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * s.size * 1.2;
                    const dotR = Math.random() * 2 + 0.5;
                    ctx.globalAlpha = Math.random() * 0.5 + 0.2;
                    ctx.beginPath(); ctx.arc(p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius, dotR, 0, Math.PI * 2); ctx.fill();
                }
            });
            ctx.restore(); return;
        }
        // 发光笔：neon glow 效果
        if (s.brushType === 'glow') {
            ctx.save();
            // 外层光晕
            ctx.shadowColor = s.color; ctx.shadowBlur = s.size * 2;
            ctx.globalAlpha = 0.4; ctx.strokeStyle = s.color; ctx.lineWidth = s.size * 1.5;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
            // 内层亮芯
            ctx.shadowBlur = s.size;
            ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = s.size * 0.4;
            if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size * 0.2, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
            ctx.restore(); return;
        }
        // 虚线笔
        if (s.brushType === 'dotted') {
            ctx.save();
            ctx.strokeStyle = s.color; ctx.lineWidth = s.size * 0.6;
            ctx.setLineDash([s.size * 0.8, s.size * 1.2]);
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.85;
            if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size / 3, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
            ctx.setLineDash([]);
            ctx.restore(); return;
        }
        // 原有画笔：crayon / marker / brush
        ctx.save();
        ctx.globalAlpha = s.brushType === 'marker' ? 0.35 : s.brushType === 'brush' ? 0.88 : 0.85;
        ctx.strokeStyle = s.color; ctx.lineWidth = s.brushType === 'marker' ? s.size * 0.7 : s.size;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
        ctx.restore();
    },

    _path(ctx, pts) {
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
        for (let i = 1; i < pts.length - 1; i++) {
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    },

    // === 图形渲染 ===
    _drawShapeObj(ctx, s) {
        ctx.save();
        ctx.fillStyle = s.fillColor || 'rgba(255,248,231,0.96)';
        this._shapePath(ctx, s.shapeType, s.x, s.y, s.size);
        ctx.fill();
        ctx.strokeStyle = s.strokeColor;
        ctx.lineWidth = s.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        this._shapePath(ctx, s.shapeType, s.x, s.y, s.size);
        ctx.stroke();
        this._drawCartoonDetails(ctx, s);
        ctx.restore();
    },

    _drawCartoonDetails(ctx, s) {
        const type = s.shapeType;
        const x = s.x, y = s.y, r = s.size;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (['circle', 'rect', 'triangle', 'star', 'heart', 'sun', 'cloud', 'flower', 'tree', 'mushroom', 'crown', 'balloon'].includes(type)) {
            this._drawTinyArms(ctx, x, y, r, type);
            this._drawHappyFace(ctx, x, y - r * 0.04, r * 0.52);
        } else if (type === 'cat') {
            this._drawHappyFace(ctx, x, y + r * 0.06, r * 0.62);
            this._drawWhiskers(ctx, x, y + r * 0.08, r);
        } else if (type === 'bunny') {
            this._drawHappyFace(ctx, x, y + r * 0.22, r * 0.5);
        } else if (type === 'bear') {
            this._drawHappyFace(ctx, x, y + r * 0.14, r * 0.58);
            this._drawSnout(ctx, x, y + r * 0.22, r);
        } else if (type === 'fish') {
            this._drawSideFace(ctx, x - r * 0.28, y, r);
            this._drawFins(ctx, x, y, r);
        } else if (type === 'chick') {
            this._drawHappyFace(ctx, x - r * 0.05, y - r * 0.04, r * 0.5);
            this._drawBeak(ctx, x + r * 0.12, y + r * 0.02, r);
        } else if (type === 'house') {
            this._drawHouseFace(ctx, x, y, r);
        } else if (type === 'car') {
            this._drawCarFace(ctx, x, y, r);
        } else if (type === 'rocket') {
            this._drawRocketFace(ctx, x, y, r);
        }

        ctx.restore();
    },

    _drawHappyFace(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = '#3E2723';
        ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.14, Math.max(2, r * 0.08), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + r * 0.28, y - r * 0.14, Math.max(2, r * 0.08), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - r * 0.31, y - r * 0.18, Math.max(1, r * 0.028), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + r * 0.25, y - r * 0.18, Math.max(1, r * 0.028), 0, Math.PI * 2); ctx.fill();
        this._drawCheeks(ctx, x, y, r);
        ctx.strokeStyle = '#3E2723';
        ctx.lineWidth = Math.max(2, r * 0.055);
        ctx.beginPath(); ctx.arc(x, y + r * 0.02, r * 0.28, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
        ctx.restore();
    },

    _drawSideFace(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = '#3E2723';
        ctx.beginPath(); ctx.arc(x - r * 0.16, y - r * 0.13, Math.max(2, r * 0.08), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3E2723';
        ctx.lineWidth = Math.max(2, r * 0.05);
        ctx.beginPath(); ctx.arc(x - r * 0.02, y + r * 0.02, r * 0.22, 0.25 * Math.PI, 0.7 * Math.PI); ctx.stroke();
        ctx.restore();
    },

    _drawCheeks(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(253,121,168,0.55)';
        ctx.beginPath(); ctx.ellipse(x - r * 0.42, y + r * 0.08, r * 0.12, r * 0.07, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + r * 0.42, y + r * 0.08, r * 0.12, r * 0.07, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    _drawTinyArms(ctx, x, y, r, type) {
        const yOffset = type === 'tree' ? r * 0.18 : type === 'balloon' ? r * 0.05 : 0;
        ctx.save();
        ctx.strokeStyle = '#6D4C41';
        ctx.lineWidth = Math.max(2, r * 0.055);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.62, y + yOffset);
        ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.02 + yOffset, x - r * 0.92, y + r * 0.26 + yOffset);
        ctx.moveTo(x + r * 0.62, y + yOffset);
        ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.02 + yOffset, x + r * 0.92, y + r * 0.26 + yOffset);
        ctx.stroke();
        ctx.restore();
    },

    _drawWhiskers(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = '#6D4C41';
        ctx.lineWidth = Math.max(1.5, r * 0.035);
        [-0.08, 0.08].forEach(offset => {
            ctx.beginPath();
            ctx.moveTo(x - r * 0.18, y + r * offset);
            ctx.lineTo(x - r * 0.68, y + r * (offset - 0.08));
            ctx.moveTo(x + r * 0.18, y + r * offset);
            ctx.lineTo(x + r * 0.68, y + r * (offset - 0.08));
            ctx.stroke();
        });
        ctx.restore();
    },

    _drawSnout(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.strokeStyle = '#6D4C41';
        ctx.lineWidth = Math.max(1.5, r * 0.035);
        ctx.beginPath(); ctx.ellipse(x, y, r * 0.2, r * 0.14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3E2723';
        ctx.beginPath(); ctx.ellipse(x, y - r * 0.03, r * 0.055, r * 0.04, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    _drawBeak(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = '#FFA36C';
        ctx.strokeStyle = '#6D4C41';
        ctx.lineWidth = Math.max(1, r * 0.025);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + r * 0.26, y + r * 0.09);
        ctx.lineTo(x, y + r * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },

    _drawFins(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = '#6D4C41';
        ctx.lineWidth = Math.max(1.5, r * 0.035);
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.16);
        ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.42, x + r * 0.36, y - r * 0.14);
        ctx.moveTo(x, y + r * 0.2);
        ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.46, x + r * 0.38, y + r * 0.18);
        ctx.stroke();
        ctx.restore();
    },

    _drawHouseFace(ctx, x, y, r) {
        this._drawHappyFace(ctx, x, y + r * 0.48, r * 0.38);
        ctx.save();
        ctx.fillStyle = 'rgba(116,185,255,0.65)';
        ctx.strokeStyle = '#6D4C41';
        ctx.lineWidth = Math.max(1.5, r * 0.035);
        ctx.beginPath(); ctx.rect(x - r * 0.55, y + r * 0.18, r * 0.24, r * 0.22); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.rect(x + r * 0.31, y + r * 0.18, r * 0.24, r * 0.22); ctx.fill(); ctx.stroke();
        ctx.restore();
    },

    _drawCarFace(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = '#3E2723';
        ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.18, Math.max(2, r * 0.07), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + r * 0.28, y - r * 0.18, Math.max(2, r * 0.07), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3E2723';
        ctx.lineWidth = Math.max(2, r * 0.05);
        ctx.beginPath(); ctx.moveTo(x - r * 0.18, y); ctx.quadraticCurveTo(x, y + r * 0.16, x + r * 0.18, y); ctx.stroke();
        ctx.restore();
    },

    _drawRocketFace(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(116,185,255,0.72)';
        ctx.strokeStyle = '#6D4C41';
        ctx.lineWidth = Math.max(1.5, r * 0.035);
        ctx.beginPath(); ctx.arc(x, y - r * 0.22, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        this._drawHappyFace(ctx, x, y + r * 0.18, r * 0.34);
        ctx.restore();
    },

    _shapePath(ctx, type, x, y, s) {
        ctx.beginPath();
        switch (type) {
            case 'circle': ctx.arc(x, y, s, 0, Math.PI * 2); break;
            case 'rect': ctx.rect(x - s, y - s * 0.75, s * 2, s * 1.5); break;
            case 'triangle': ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * 0.7); ctx.lineTo(x - s, y + s * 0.7); ctx.closePath(); break;
            case 'star': {
                for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2; const r = i % 2 === 0 ? s : s * 0.45; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
                ctx.closePath(); break;
            }
            case 'heart': {
                const sc = s * 0.06;
                for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2; const hx = x + sc * 16 * Math.pow(Math.sin(t), 3); const hy = y - sc * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy); }
                ctx.closePath(); break;
            }
            case 'cat': {
                // 猫脸
                const r = s;
                ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
                // 左耳
                ctx.moveTo(x - r * 0.85, y - r * 0.3); ctx.lineTo(x - r * 0.6, y - r * 1.1); ctx.lineTo(x - r * 0.2, y - r * 0.55);
                // 右耳
                ctx.moveTo(x + r * 0.85, y - r * 0.3); ctx.lineTo(x + r * 0.6, y - r * 1.1); ctx.lineTo(x + r * 0.2, y - r * 0.55);
                break;
            }
            case 'bunny': {
                const r = s;
                ctx.arc(x, y + r * 0.2, r * 0.8, 0, Math.PI * 2); ctx.closePath();
                // 左耳
                ctx.moveTo(x - r * 0.35, y - r * 0.4); ctx.ellipse(x - r * 0.35, y - r * 1, r * 0.18, r * 0.6, 0, 0, Math.PI * 2);
                // 右耳
                ctx.moveTo(x + r * 0.35, y - r * 0.4); ctx.ellipse(x + r * 0.35, y - r * 1, r * 0.18, r * 0.6, 0, 0, Math.PI * 2);
                break;
            }
            case 'bear': {
                const r = s;
                ctx.arc(x, y + r * 0.1, r, 0, Math.PI * 2); ctx.closePath();
                // 左耳
                ctx.moveTo(x - r * 0.8, y - r * 0.5); ctx.arc(x - r * 0.8, y - r * 0.7, r * 0.3, 0, Math.PI * 2);
                // 右耳
                ctx.moveTo(x + r * 0.8, y - r * 0.5); ctx.arc(x + r * 0.8, y - r * 0.7, r * 0.3, 0, Math.PI * 2);
                break;
            }
            case 'fish': {
                ctx.ellipse(x, y, s, s * 0.55, 0, 0, Math.PI * 2); ctx.closePath();
                // 尾巴
                ctx.moveTo(x + s, y); ctx.lineTo(x + s * 1.5, y - s * 0.5); ctx.lineTo(x + s * 1.5, y + s * 0.5); ctx.closePath();
                break;
            }
            case 'chick': {
                ctx.arc(x, y, s * 0.85, 0, Math.PI * 2); ctx.closePath();
                // 小嘴
                ctx.moveTo(x + s * 0.8, y); ctx.lineTo(x + s * 1.3, y + s * 0.1); ctx.lineTo(x + s * 0.8, y + s * 0.2); ctx.closePath();
                break;
            }
            case 'sun': {
                ctx.arc(x, y, s * 0.5, 0, Math.PI * 2); ctx.closePath();
                for (let i = 0; i < 8; i++) {
                    const a = i / 8 * Math.PI * 2;
                    ctx.moveTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6);
                    ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
                }
                break;
            }
            case 'cloud': {
                ctx.arc(x - s * 0.3, y, s * 0.5, 0, Math.PI * 2); ctx.closePath();
                ctx.moveTo(x + s * 0.5, y); ctx.arc(x + s * 0.2, y, s * 0.45, 0, Math.PI * 2); ctx.closePath();
                ctx.moveTo(x + s * 0.1, y + s * 0.1); ctx.arc(x - s * 0.05, y - s * 0.2, s * 0.4, 0, Math.PI * 2);
                break;
            }
            case 'flower': {
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * Math.PI * 2;
                    ctx.moveTo(x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35);
                    ctx.ellipse(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.3, s * 0.2, a, 0, Math.PI * 2);
                }
                ctx.moveTo(x, y); ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
                break;
            }
            case 'tree': {
                ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x + s * 0.2, y); ctx.lineTo(x + s * 0.5, y + s * 0.6);
                ctx.lineTo(x - s * 0.5, y + s * 0.6); ctx.lineTo(x - s * 0.2, y); ctx.lineTo(x - s * 0.7, y); ctx.closePath();
                break;
            }
            case 'mushroom': {
                ctx.arc(x, y - s * 0.2, s * 0.8, Math.PI, 0); ctx.closePath();
                ctx.moveTo(x + s * 0.35, y - s * 0.2); ctx.lineTo(x + s * 0.3, y + s * 0.6);
                ctx.lineTo(x - s * 0.3, y + s * 0.6); ctx.lineTo(x - s * 0.35, y - s * 0.2); ctx.closePath();
                break;
            }
            case 'house': {
                // 墙体
                ctx.rect(x - s * 0.7, y, s * 1.4, s);
                // 屋顶
                ctx.moveTo(x - s, y); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y); ctx.closePath();
                // 门
                ctx.moveTo(x + s * 0.15, y + s); ctx.rect(x - s * 0.15, y + s * 0.4, s * 0.3, s * 0.6);
                break;
            }
            case 'car': {
                // 车身
                ctx.moveTo(x - s, y + s * 0.1); ctx.lineTo(x - s, y - s * 0.3); ctx.lineTo(x - s * 0.5, y - s * 0.3);
                ctx.lineTo(x - s * 0.3, y - s * 0.8); ctx.lineTo(x + s * 0.3, y - s * 0.8);
                ctx.lineTo(x + s * 0.5, y - s * 0.3); ctx.lineTo(x + s, y - s * 0.3);
                ctx.lineTo(x + s, y + s * 0.1); ctx.closePath();
                // 轮子
                ctx.moveTo(x - s * 0.5, y + s * 0.1); ctx.arc(x - s * 0.5, y + s * 0.1, s * 0.2, 0, Math.PI * 2);
                ctx.moveTo(x + s * 0.5, y + s * 0.1); ctx.arc(x + s * 0.5, y + s * 0.1, s * 0.2, 0, Math.PI * 2);
                break;
            }
            case 'rocket': {
                ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.3, x + s * 0.4, y + s * 0.5);
                ctx.lineTo(x - s * 0.4, y + s * 0.5); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.3, x, y - s); ctx.closePath();
                // 翅膀
                ctx.moveTo(x - s * 0.4, y + s * 0.2); ctx.lineTo(x - s * 0.7, y + s * 0.6); ctx.lineTo(x - s * 0.3, y + s * 0.5);
                ctx.moveTo(x + s * 0.4, y + s * 0.2); ctx.lineTo(x + s * 0.7, y + s * 0.6); ctx.lineTo(x + s * 0.3, y + s * 0.5);
                // 窗口
                ctx.moveTo(x + s * 0.15, y - s * 0.2); ctx.arc(x, y - s * 0.2, s * 0.15, 0, Math.PI * 2);
                break;
            }
            case 'crown': {
                ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x - s, y - s * 0.3);
                ctx.lineTo(x - s * 0.5, y + s * 0.1); ctx.lineTo(x, y - s);
                ctx.lineTo(x + s * 0.5, y + s * 0.1); ctx.lineTo(x + s, y - s * 0.3);
                ctx.lineTo(x + s, y + s * 0.5); ctx.closePath();
                break;
            }
            case 'balloon': {
                ctx.ellipse(x, y - s * 0.15, s * 0.55, s * 0.75, 0, 0, Math.PI * 2); ctx.closePath();
                // 底部三角
                ctx.moveTo(x - s * 0.1, y + s * 0.55); ctx.lineTo(x, y + s * 0.4); ctx.lineTo(x + s * 0.1, y + s * 0.55); ctx.closePath();
                // 线
                ctx.moveTo(x, y + s * 0.55); ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.8, x - s * 0.05, y + s);
                break;
            }
            default: ctx.arc(x, y, s, 0, Math.PI * 2);
        }
    }
};
