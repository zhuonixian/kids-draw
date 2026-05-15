// === 自由画布模块（v4 - 主题图形 + 大小选择）===
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
    currentStickerId: 'piglet',
    currentStickerCategory: 'friends',
    stickerImages: {},

    objects: [],
    currentStroke: null,
    _isDrawing: false,
    _lastPoint: null,

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
        this._resizeCanvas();
        this._preloadStickers();
        this._initUI();
        if (!this._eventsBound) { this._addEvents(); this._eventsBound = true; }
        window.removeEventListener('resize', this._onResize);
        this._onResize = () => { this._resizeCanvas(); this.redraw(); };
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
    },

    // === UI 初始化 ===
    _initUI() {
        // 颜色
        const cc = document.getElementById('freecanvas-colors');
        cc.innerHTML = '';
        createColorPicker('freecanvas-colors', (hex) => { this.currentColor = hex; });

        // 工具按钮
        document.querySelectorAll('.fc-toolbar .tool-btn').forEach(btn => {
            btn.onclick = () => {
                this.currentTool = btn.dataset.tool;
                if (btn.dataset.type === 'eraser') this.brushType = 'eraser';
                this._updateHighlight();
            };
        });

        // 画笔类型
        document.querySelectorAll('.fc-toolbar .brush-type-btn').forEach(btn => {
            btn.onclick = () => {
                this.brushType = btn.dataset.type;
                this.currentTool = 'brush';
                this._updateHighlight();
            };
        });

        // 图形大小
        document.querySelectorAll('.shape-size-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.shape-size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.shapeSize = parseInt(btn.dataset.size);
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

        // 贴纸分类 tab
        document.querySelectorAll('.shape-cat-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.shape-cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentStickerCategory = btn.dataset.cat;
                this._renderShapeButtons();
            };
        });

        // 初始渲染贴纸按钮
        this._renderShapeButtons();

        // 底色
        const bg = document.getElementById('bg-colors');
        bg.innerHTML = '';
        this.bgColors.forEach((c, i) => {
            const d = document.createElement('div');
            d.className = 'bg-dot' + (i === 0 ? ' active' : '');
            d.style.backgroundColor = c;
            if (c === '#FFFFFF') d.style.border = '2px solid #ddd';
            d.onclick = () => { bg.querySelectorAll('.bg-dot').forEach(x => x.classList.remove('active')); d.classList.add('active'); this.bgColor = c; this.redraw(); };
            bg.appendChild(d);
        });

        // 功能按钮
        const clearBtn = document.querySelector('.action-tools .btn-clear');
        if (clearBtn) clearBtn.onclick = () => { this.objects = []; this.panX = 0; this.panY = 0; this.redraw(); };
        const backBtn = document.querySelector('.action-tools .btn-back');
        if (backBtn) App.longPress(backBtn, () => App.showScene('home'));
    },

    _renderShapeButtons() {
        const container = document.getElementById('shape-buttons');
        if (!container) return;
        container.innerHTML = '';
        const stickers = typeof StickerLibrary !== 'undefined'
            ? StickerLibrary.byCategory(this.currentStickerCategory)
            : [];
        stickers.forEach(sticker => {
            const btn = document.createElement('button');
            btn.className = 'shape-btn sticker-btn' + (sticker.id === this.currentStickerId ? ' active' : '');
            btn.dataset.sticker = sticker.id;
            btn.title = sticker.name;
            btn.innerHTML = `<img src="${sticker.source}" alt="${sticker.name}">`;
            btn.onclick = () => {
                container.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentStickerId = sticker.id;
                this.currentTool = 'sticker';
                this._updateHighlight();
            };
            container.appendChild(btn);
        });
    },

    _preloadStickers() {
        if (typeof StickerLibrary === 'undefined') return;
        StickerLibrary.items.forEach(sticker => {
            if (this.stickerImages[sticker.id]) return;
            const img = new Image();
            img.onload = () => this.redraw();
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
    },

    // === 事件 ===
    _addEvents() {
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._handleStart(e); }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._handleMove(e); }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this._handleEnd(); }, { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this._handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this._handleMove(e));
        this.canvas.addEventListener('mouseup', () => this._handleEnd());
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
        if (this.currentTool === 'fill') { this._doFill(pos); return; }
        if (this.currentTool === 'sticker') { this._placeSticker(pos); return; }
        if (this.currentTool === 'shape') { this._placeShape(pos); return; }
        this._startStroke(pos);
    },

    _handleMove(e) {
        if (this.currentTool === 'pan' && this._panStart) {
            const s = e.touches ? e.touches[0] : e;
            this.panX = this._panPanStart.x + (s.clientX - this._panStart.x);
            this.panY = this._panPanStart.y + (s.clientY - this._panStart.y);
            this.redraw(); return;
        }
        if (this.currentTool === 'brush') this._continueStroke(this._wPos(e));
    },

    _handleEnd() {
        if (this.currentTool === 'pan') { this._panStart = null; return; }
        this._endStroke();
    },

    // === 笔画 ===
    _startStroke(p) {
        this._isDrawing = true; this._lastPoint = p;
        this.currentStroke = { type: 'stroke', brushType: this.brushType === 'eraser' ? 'eraser' : this.brushType, color: this.currentColor, size: this.brushType === 'eraser' ? this.brushSize * 2 : this.brushSize, points: [p] };
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
        if (this.currentStroke && this.currentStroke.points.length) this.objects.push(this.currentStroke);
        this.currentStroke = null; this._isDrawing = false;
    },

    // === 放置图形 ===
    _placeShape(pos) {
        this.objects.push({ type: 'shape', shapeType: this.currentShapeType, x: pos.x, y: pos.y, size: this.shapeSize, fillColor: null, strokeColor: this.currentColor, strokeWidth: 3 });
        this.redraw();
    },

    _placeSticker(pos) {
        this.objects.push({ type: 'sticker', stickerId: this.currentStickerId, x: pos.x, y: pos.y, size: this.shapeSize * 1.6 });
        this.redraw();
        if (typeof App !== 'undefined' && App.playStickerSound) App.playStickerSound();
    },

    // === 填充 ===
    _doFill(pos) {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const o = this.objects[i];
            if (o.type === 'shape') {
                const dx = pos.x - o.x, dy = pos.y - o.y;
                if (dx * dx + dy * dy <= o.size * o.size * 1.2) {
                    o.fillColor = this.currentColor;
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

        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * this.panX, this.dpr * this.panY);
        this.objects.forEach(o => this._drawObj(ctx, o));
        if (this.currentStroke) this._drawObj(ctx, this.currentStroke);
        ctx.restore();
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
            ctx.drawImage(img, s.x - size, s.y - size, size * 2, size * 2);
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

    _drawStroke(ctx, s) {
        const pts = s.points;
        if (!pts.length) return;
        if (s.brushType === 'eraser') {
            ctx.save(); ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
            ctx.restore(); return;
        }
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
