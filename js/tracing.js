// === 描边填色模块（v6 - CSS 坐标填色 + 静态遮罩缓存）===
const Tracing = {
    canvas: null,
    ctx: null,
    currentShapeIndex: 0,
    mode: 'idle',
    currentColor: '#FF6B6B',
    dpr: 1,
    cx: 0, cy: 0, size: 0,
    canvasW: 0, canvasH: 0,

    pathPoints: [],
    totalSegments: 0,
    tracedProgress: 0,
    _isDrawing: false,
    _animRunning: false,
    _eventsBound: false,

    // 填色层和静态覆盖层都使用 CSS 像素，避免 DPR 坐标错位。
    fillCanvas: null,
    fillCtx: null,
    maskCanvas: null,
    maskCtx: null,
    outlineCanvas: null,
    outlineCtx: null,

    // 碰撞检测
    hitMap: null,
    hitW: 0, hitH: 0,

    lastFillPos: null,
    _pendingFrame: false,

    onEnter() {
        this.canvas = document.getElementById('tracing-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;

        document.getElementById('tracing-back').onclick = () => App.showScene('home');
        const cc = document.getElementById('tracing-colors');
        cc.innerHTML = '';
        createColorPicker('tracing-colors', (hex) => { this.currentColor = hex; });

        if (!this._eventsBound) { this._addEvents(); this._eventsBound = true; }

        window.removeEventListener('resize', this._onResize);
        this._onResize = () => { this.resizeCanvas(); this.redraw(); };
        window.addEventListener('resize', this._onResize);

        requestAnimationFrame(() => { this.resizeCanvas(); this.startTracing(); });
    },

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0) return;
        this.canvasW = rect.width;
        this.canvasH = rect.height;
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        this.cx = rect.width / 2;
        this.cy = rect.height / 2;
        this.size = Math.min(rect.width, rect.height) * 0.78;

        this.fillCanvas = this._makeLayerCanvas();
        this.fillCtx = this.fillCanvas.getContext('2d');
        this.maskCanvas = this._makeLayerCanvas();
        this.maskCtx = this.maskCanvas.getContext('2d');
        this.outlineCanvas = this._makeLayerCanvas();
        this.outlineCtx = this.outlineCanvas.getContext('2d');

        this._buildHitMap();
        this._buildShapeLayers();
    },

    _makeLayerCanvas() {
        const layer = document.createElement('canvas');
        layer.width = Math.ceil(this.canvasW);
        layer.height = Math.ceil(this.canvasH);
        return layer;
    },

    _buildHitMap() {
        const shape = Shapes[this.currentShapeIndex];
        this.hitW = Math.ceil(this.canvasW);
        this.hitH = Math.ceil(this.canvasH);
        this.hitMap = new Uint8Array(this.hitW * this.hitH);
        const off = document.createElement('canvas');
        off.width = this.hitW; off.height = this.hitH;
        const c = off.getContext('2d');
        shape.drawFillPath(c, this.cx, this.cy, this.size);
        c.fillStyle = '#000'; c.fill();
        const d = c.getImageData(0, 0, this.hitW, this.hitH).data;
        for (let i = 0; i < this.hitMap.length; i++) this.hitMap[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    },

    _buildShapeLayers() {
        const shape = Shapes[this.currentShapeIndex];

        const mask = this.maskCtx;
        mask.clearRect(0, 0, this.canvasW, this.canvasH);
        shape.drawFillPath(mask, this.cx, this.cy, this.size);
        mask.fillStyle = '#000';
        mask.fill();

        const outline = this.outlineCtx;
        outline.clearRect(0, 0, this.canvasW, this.canvasH);
        outline.save();
        outline.beginPath();
        outline.rect(0, 0, this.canvasW, this.canvasH);
        shape.drawFillPath(outline, this.cx, this.cy, this.size);
        outline.clip('evenodd');
        outline.fillStyle = '#fff';
        outline.fillRect(0, 0, this.canvasW, this.canvasH);
        outline.restore();

        outline.save();
        outline.lineWidth = 6;
        outline.strokeStyle = '#5D4037';
        outline.lineCap = 'round';
        outline.lineJoin = 'round';
        shape.drawFillPath(outline, this.cx, this.cy, this.size);
        outline.stroke();
        outline.restore();
    },

    _inside(x, y) {
        const ix = ~~x, iy = ~~y;
        if (ix < 0 || ix >= this.hitW || iy < 0 || iy >= this.hitH) return false;
        return this.hitMap[iy * this.hitW + ix] === 1;
    },

    startTracing() {
        this.mode = 'tracing';
        this.tracedProgress = 0;
        this.lastFillPos = null;
        const shape = Shapes[this.currentShapeIndex];
        this.pathPoints = shape.getPoints(this.cx, this.cy, this.size);
        this.totalSegments = this.pathPoints.length;
        document.getElementById('tracing-info').textContent = shape.name;
        document.getElementById('tracing-toolbar').classList.remove('visible');
        this.fillCtx.clearRect(0, 0, this.canvasW, this.canvasH);
        this.redraw();
    },

    // === 渲染 ===
    redraw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvasW, this.canvasH);
        if (this.mode === 'tracing') this._drawTracing(ctx);
        else if (this.mode === 'coloring') this._drawColoring(ctx);
    },

    _drawTracing(ctx) {
        const pts = this.pathPoints;
        if (!pts.length) return;

        // 虚线轮廓
        ctx.save();
        ctx.setLineDash([8, 6]); ctx.lineWidth = 4; ctx.strokeStyle = '#D5C8BE';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) i === 0 ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath(); ctx.stroke(); ctx.restore();

        // 已描绿色
        const n = Math.floor(this.tracedProgress * this.totalSegments);
        if (n > 0) {
            ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 8; ctx.strokeStyle = '#6BCB77';
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let i = 0; i <= n && i < pts.length; i++) i === 0 ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke(); ctx.restore();
        }

        // 起点
        const p = 1 + 0.1 * Math.sin(Date.now() / 300);
        ctx.save(); ctx.fillStyle = '#FFA36C';
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 12 * p, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (this.tracedProgress < 1 && !this._animRunning) {
            this._animRunning = true;
            const loop = () => {
                if (this.mode !== 'tracing') { this._animRunning = false; return; }
                this.redraw(); requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }
    },

    _drawColoring(ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, this.canvasW, this.canvasH);
        ctx.drawImage(this.fillCanvas, 0, 0);
        ctx.drawImage(this.outlineCanvas, 0, 0);
    },

    // === 描边 ===
    _updateProgress(x, y) {
        const TOL = 35;
        let minD = Infinity, idx = 0;
        for (let i = 0; i < this.pathPoints.length; i++) {
            const dx = this.pathPoints[i].x - x, dy = this.pathPoints[i].y - y;
            const d = dx * dx + dy * dy;
            if (d < minD) { minD = d; idx = i; }
        }
        if (Math.sqrt(minD) > TOL) return;
        const p = (idx + 1) / this.totalSegments;
        if (p > this.tracedProgress) this.tracedProgress = p;
    },

    _checkTracingDone() {
        if (this.tracedProgress >= 0.85) {
            this.tracedProgress = 1; this._animRunning = false; this.redraw();
            setTimeout(() => this._startColoring(), 400);
        }
    },

    _startColoring() {
        this.mode = 'coloring'; this.lastFillPos = null;
        this.fillCtx.clearRect(0, 0, this.canvasW, this.canvasH);
        document.getElementById('tracing-toolbar').classList.add('visible');
        this.redraw();
    },

    // === 填色 ===
    // 只在 CSS 像素离屏层上追加笔迹，主画布每帧只合成缓存图层。
    _paintAt(x, y) {
        if (!this._inside(x, y)) { this.lastFillPos = null; return; }
        const ctx = this.fillCtx;
        const r = 18;
        ctx.fillStyle = this.currentColor;
        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = r * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (this.lastFillPos) {
            ctx.beginPath();
            ctx.moveTo(this.lastFillPos.x, this.lastFillPos.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        this.lastFillPos = { x, y };
        if (typeof App !== 'undefined' && App.playDrawSound) App.playDrawSound();

        // rAF 节流：多帧合并一次重绘
        if (!this._pendingFrame) {
            this._pendingFrame = true;
            requestAnimationFrame(() => { this.redraw(); this._pendingFrame = false; });
        }
    },

    // 完成率检测（只在松手时调用一次）
    _getFillRate() {
        const tmp = document.createElement('canvas');
        tmp.width = this.fillCanvas.width; tmp.height = this.fillCanvas.height;
        const tc = tmp.getContext('2d');
        tc.drawImage(this.maskCanvas, 0, 0);
        tc.globalCompositeOperation = 'source-in';
        tc.drawImage(this.fillCanvas, 0, 0);

        const step = 16;
        let total = 0, filled = 0;
        const td = tc.getImageData(0, 0, tmp.width, tmp.height).data;
        for (let y = 0; y < this.hitH; y += step) {
            for (let x = 0; x < this.hitW; x += step) {
                if (this.hitMap[y * this.hitW + x]) {
                    total++;
                    if (td[(y * tmp.width + x) * 4 + 3] > 0) filled++;
                }
            }
        }
        return total ? filled / total : 0;
    },

    _checkColoringDone() {
        if (this._getFillRate() >= 0.70) {
            this.mode = 'complete';
            App.celebrate();
            setTimeout(() => {
                this.currentShapeIndex = (this.currentShapeIndex + 1) % Shapes.length;
                this.onEnter();
            }, 3000);
        }
    },

    // === 事件（只绑一次）===
    _addEvents() {
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._onStart(this._pos(e)); }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._onMove(this._pos(e)); }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this._onEnd(); }, { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this._onStart(this._pos(e)));
        this.canvas.addEventListener('mousemove', (e) => this._onMove(this._pos(e)));
        this.canvas.addEventListener('mouseup', () => this._onEnd());
    },

    _pos(e) {
        const r = this.canvas.getBoundingClientRect();
        const s = e.touches ? e.touches[0] : e;
        return { x: s.clientX - r.left, y: s.clientY - r.top };
    },

    _onStart(p) {
        this._isDrawing = true;
        if (this.mode === 'tracing') { this._updateProgress(p.x, p.y); this.redraw(); }
        else if (this.mode === 'coloring') { this.lastFillPos = null; this._paintAt(p.x, p.y); }
    },
    _onMove(p) {
        if (!this._isDrawing) return;
        if (this.mode === 'tracing') { this._updateProgress(p.x, p.y); this.redraw(); }
        else if (this.mode === 'coloring') { this._paintAt(p.x, p.y); }
    },
    _onEnd() {
        this._isDrawing = false;
        if (this.mode === 'tracing') this._checkTracingDone();
        else if (this.mode === 'coloring') { this.lastFillPos = null; this.redraw(); this._checkColoringDone(); }
    }
};
