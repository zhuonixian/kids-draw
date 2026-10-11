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
    _lastEncourage: 0,

    // === 形状图鉴弹层 ===
    // Shapes 正在扩充（category: basic/number/letter/animal/vehicle），
    // 未标注 category 的形状一律归入 basic，代码对 Shapes 数量/顺序不做假设
    _SHAPE_CATS: { basic: '基础', number: '数字', letter: '字母', animal: '动物', vehicle: '交通' },
    _SHAPE_CAT_ORDER: ['basic', 'number', 'letter', 'animal', 'vehicle'],
    _shapePickerCat: null,
    _advanceTimer: null,

    onEnter() {
        this.canvas = document.getElementById('tracing-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;

        document.getElementById('tracing-back').onclick = () => App.showScene('home');
        const cc = document.getElementById('tracing-colors');
        if (!cc.children.length) createColorPicker('tracing-colors', (hex) => { this.currentColor = hex; });

        // 进场景先收起工具栏：画布必须在"无工具栏"布局下测量，
        // 否则上一形状填色阶段留下的布局会让位图尺寸偏大
        document.getElementById('tracing-toolbar').classList.remove('visible');

        // 重进场景时确保形状图鉴弹层是收起状态
        const picker = document.getElementById('shape-picker');
        if (picker) picker.classList.remove('open');

        if (!this._eventsBound) { this._addEvents(); this._eventsBound = true; }

        if (!this._onResize) {
            this._onResize = () => { this.resizeCanvas(); this.redraw(); };
        }
        window.removeEventListener('resize', this._onResize);
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

        // 白色蒙版：整面铺白后把图形内部挖空。
        // 不能用 rect + clip('evenodd')：drawFillPath 内部的 beginPath 会清掉 rect 子路径，
        // 蒙版会退化成实心白圆，把填色层整个盖住。
        const outline = this.outlineCtx;
        outline.clearRect(0, 0, this.canvasW, this.canvasH);
        outline.fillStyle = '#fff';
        outline.fillRect(0, 0, this.canvasW, this.canvasH);
        outline.globalCompositeOperation = 'destination-out';
        shape.drawFillPath(outline, this.cx, this.cy, this.size);
        outline.fill();
        outline.globalCompositeOperation = 'source-over';

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
        // 清掉遗留的强制进入填色/自动前进定时器（完成后 400ms/3s 的延迟回调）
        clearTimeout(this._startColoringTimer);
        clearTimeout(this._advanceTimer);
        this.mode = 'tracing';
        this.tracedProgress = 0;
        this.lastFillPos = null;
        const shape = Shapes[this.currentShapeIndex];
        this.pathPoints = shape.getPoints(this.cx, this.cy, this.size);
        this.totalSegments = this.pathPoints.length;
        // 覆盖模型：记录每个采样点是否被描过；完成要求每一笔（部件）覆盖率都达标。
        this._partCounts = shape.partsPointCounts || [this.totalSegments];
        this._partOffsets = [];
        let acc = 0;
        this._partCounts.forEach(c => { this._partOffsets.push(acc); acc += c; });
        this._partCovered = this._partCounts.map(cnt => new Uint8Array(cnt));
        this._partCoveredCount = this._partCounts.map(() => 0);
        this._lastIdx = this._partCounts.map(() => null);
        this._partProgress = this._partCounts.map(() => 0);
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
        else if (this.mode === 'coloring' || this.mode === 'complete') this._drawColoring(ctx);
    },

    _drawTracing(ctx) {
        const pts = this.pathPoints;
        if (!pts.length) return;
        const shape = Shapes[this.currentShapeIndex];
        const counts = shape.partsPointCounts || [pts.length];

        // 虚线轮廓（完整绘制每一笔）
        const drawPerPart = () => {
            let idx = 0;
            counts.forEach(cnt => {
                ctx.beginPath();
                for (let i = idx; i < idx + cnt && i < pts.length; i++) {
                    i === idx ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.closePath();
                ctx.stroke();
                idx += cnt;
            });
        };

        // 内部边界遮盖：用底色重新填充并集，多部件只留外轮廓描边
        const maskInterior = () => {
            ctx.save();
            ctx.setLineDash([]);
            ctx.fillStyle = '#fff';
            shape.drawFillPath(ctx, this.cx, this.cy, this.size);
            ctx.fill();
            ctx.restore();
        };

        // 虚线轮廓
        ctx.save();
        ctx.setLineDash([8, 6]); ctx.lineWidth = 4; ctx.strokeStyle = '#D5C8BE';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        drawPerPart();
        maskInterior();
        ctx.restore();

        // 已描绿色（只画真实覆盖过的轨迹段，跨部件独立）
        if (this.tracedProgress > 0) {
            ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 8; ctx.strokeStyle = '#6BCB77';
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            this._partCounts.forEach((cnt, pIdx) => {
                const covered = this._partCovered[pIdx];
                const start = this._partOffsets[pIdx];
                let runStart = null;
                for (let i = 0; i < cnt; i++) {
                    if (covered[i]) {
                        if (runStart === null) runStart = i;
                    } else if (runStart !== null) {
                        for (let j = runStart; j < i; j++) {
                            const p = this.pathPoints[start + j];
                            j === runStart ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
                        }
                        ctx.closePath(); ctx.stroke();
                        runStart = null;
                    }
                }
                if (runStart !== null) {
                    // 末尾连续段：若首点也被覆盖则沿闭环补齐
                    const wrap = covered[0] && runStart > 0;
                    ctx.beginPath();
                    for (let j = runStart; j < cnt; j++) {
                        const p = this.pathPoints[start + j];
                        j === runStart ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
                    }
                    if (wrap) {
                        for (let j = 0; j <= runStart; j++) {
                            const p = this.pathPoints[start + j];
                            ctx.lineTo(p.x, p.y);
                        }
                    }
                    ctx.stroke();
                }
            });
            maskInterior();
            ctx.restore();
        }

        // 起点
        const p = 1 + 0.1 * Math.sin(Date.now() / 300);
        ctx.save(); ctx.fillStyle = '#FFA36C';
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 12 * p, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // 起点脉冲只在尚未落笔时运行（提示起点），落笔后停止以省电
        if (this.tracedProgress === 0 && !this._animRunning) {
            this._animRunning = true;
            const loop = () => {
                if (this.mode !== 'tracing' || this.tracedProgress > 0) { this._animRunning = false; return; }
                this.redraw();
                setTimeout(() => requestAnimationFrame(loop), 80);
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
        // 全局匹配唯一最近的采样点，只标记它所在的那一笔——
        // 相邻笔画不会因为 35px 容差被顺带覆盖
        let bestD = Infinity, bestP = -1, bestIdx = -1;
        this._partCounts.forEach((cnt, pIdx) => {
            const start = this._partOffsets[pIdx];
            for (let i = 0; i < cnt; i++) {
                const pt = this.pathPoints[start + i];
                const dx = pt.x - x, dy = pt.y - y;
                const d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; bestP = pIdx; bestIdx = i; }
            }
        });
        if (bestP < 0 || Math.sqrt(bestD) > TOL) return;
        const cnt = this._partCounts[bestP];
        const covered = this._partCovered[bestP];
        const mark = (i) => {
            const j = ((i % cnt) + cnt) % cnt;
            if (!covered[j]) { covered[j] = 1; this._partCoveredCount[bestP]++; }
        };
        const last = this._lastIdx[bestP];
        if (last === null || Math.abs(bestIdx - last) > 8) {
            // 新落笔或大幅跳变：只标记命中点附近，不做插值
            mark(bestIdx - 1); mark(bestIdx); mark(bestIdx + 1);
        } else {
            // 连续拖动：命中点之间插值补齐，快描也不会漏
            const lo = Math.min(last, bestIdx), hi = Math.max(last, bestIdx);
            for (let i = lo; i <= hi; i++) mark(i);
        }
        this._lastIdx[bestP] = bestIdx;
        this._partProgress[bestP] = this._partCoveredCount[bestP] / cnt;
        let sum = 0;
        this._partCounts.forEach((c, i) => { sum += c * this._partProgress[i]; });
        this.tracedProgress = sum / this.totalSegments;
    },

    _checkTracingDone() {
        // 覆盖模型：每一笔（部件）的覆盖率都达标才算完成，缺任何一笔都不通过
        const done = this._partProgress.length > 0 && this._partProgress.every(p => p >= 0.9);
        if (done) {
            this.tracedProgress = 1;
            this._partProgress = this._partCounts.map(() => 1);
            this._animRunning = false; this.redraw();
            this._startColoringTimer = setTimeout(() => this._startColoring(), 400);
        } else {
            this._encourage('再多描一点点！');
        }
    },

    _startColoring() {
        document.getElementById('tracing-toolbar').classList.add('visible');
        // 工具栏出现会压缩画布高度，必须按新尺寸重建图层，否则调色盘会被推出屏幕
        this.resizeCanvas();
        this.mode = 'coloring'; this.lastFillPos = null;
        this.fillCtx.clearRect(0, 0, this.canvasW, this.canvasH);
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
        if (!this._rateCanvas) {
            this._rateCanvas = document.createElement('canvas');
        }
        const tmp = this._rateCanvas;
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
            // 收入图鉴（celebrate 前），失败静默不打扰孩子
            const shape = Shapes[this.currentShapeIndex];
            if (shape && typeof ShapeProgress !== 'undefined') ShapeProgress.mark(shape.name);
            this._saveArtwork();
            this.mode = 'complete';
            App.celebrate();
            this._advanceTimer = setTimeout(() => {
                this.currentShapeIndex = (this.currentShapeIndex + 1) % Shapes.length;
                this.onEnter();
            }, 3000);
        } else {
            this._encourage('再多涂一点点！');
        }
    },

    // 完成时自动保存作品（celebrate 前画布还是完整成品）；失败静默，不打扰孩子
    _saveArtwork() {
        const shape = Shapes[this.currentShapeIndex];
        const crop = this._shapeCropArea();
        const rec = ArtworkStore.save(this.canvas, { scene: 'tracing', name: shape.name, crop });
        if (rec) App.showToast('作品已保存 🎉');
    },

    // 成品导出区域：路径包围盒外扩 50px 白边，并收进画布 CSS 尺寸内
    _shapeCropArea() {
        const pts = this.pathPoints;
        if (!pts.length) return null;
        let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y;
        for (let i = 1; i < pts.length; i++) {
            if (pts[i].x < minX) minX = pts[i].x;
            if (pts[i].y < minY) minY = pts[i].y;
            if (pts[i].x > maxX) maxX = pts[i].x;
            if (pts[i].y > maxY) maxY = pts[i].y;
        }
        const M = 50;
        const x = Math.max(0, Math.floor(minX - M));
        const y = Math.max(0, Math.floor(minY - M));
        const w = Math.min(this.canvasW - x, Math.ceil(maxX + M) - x);
        const h = Math.min(this.canvasH - y, Math.ceil(maxY + M) - y);
        return (w >= 1 && h >= 1) ? { x, y, w, h } : null;
    },

    // 未达标鼓励反馈：3 秒节流，避免反复松手刷屏
    _encourage(msg) {
        const now = Date.now();
        if (now - this._lastEncourage < 3000) return;
        this._lastEncourage = now;
        App.showToast(msg);
        if (typeof App.playEncourageSound === 'function') App.playEncourageSound();
    },

    // === 形状图鉴弹层 ===
    _openShapePicker() {
        const panel = document.getElementById('shape-picker');
        if (!panel) return;
        // 默认落在当前形状所在分类，之后记住孩子的选择
        if (!this._shapePickerCat) this._shapePickerCat = this._shapeCategoryOf(Shapes[this.currentShapeIndex]);
        this._renderShapePicker();
        panel.classList.add('open');
    },

    _closeShapePicker() {
        const panel = document.getElementById('shape-picker');
        if (panel) panel.classList.remove('open');
    },

    // 形状分类归一：category 缺失或不在固定顺序里时按 basic 处理
    _shapeCategoryOf(shape) {
        const cat = shape && shape.category;
        return this._SHAPE_CAT_ORDER.indexOf(cat) >= 0 ? cat : 'basic';
    },

    // 渲染 tabs + 当前分类 grid + 收集计数（每次打开/切换 tab 都重渲，直接反映最新 Shapes/进度）
    _renderShapePicker() {
        const countEl = document.getElementById('shape-picker-count');
        const tabsEl = document.getElementById('shape-picker-tabs');
        const gridEl = document.getElementById('shape-picker-grid');
        if (!tabsEl || !gridEl) return;

        const progress = (typeof ShapeProgress !== 'undefined') ? ShapeProgress.list() : {};

        // 按 category 分组，保持 Shapes 原始下标；分类按固定顺序去重排列
        const groups = {};
        Shapes.forEach((shape, i) => {
            const cat = this._shapeCategoryOf(shape);
            (groups[cat] = groups[cat] || []).push(i);
        });
        const cats = Object.keys(groups).sort((a, b) =>
            this._SHAPE_CAT_ORDER.indexOf(a) - this._SHAPE_CAT_ORDER.indexOf(b));

        // 记住的分类可能已不存在（Shapes 并发扩充中），回退到当前形状的分类
        if (!groups[this._shapePickerCat]) {
            this._shapePickerCat = this._shapeCategoryOf(Shapes[this.currentShapeIndex]);
        }

        if (countEl) {
            const done = (typeof ShapeProgress !== 'undefined') ? ShapeProgress.completedCount() : Object.keys(progress).length;
            countEl.textContent = '已收集 ' + done + '/' + Shapes.length;
        }

        tabsEl.innerHTML = '';
        cats.forEach(cat => {
            const tab = document.createElement('button');
            tab.className = 'picker-tab' + (cat === this._shapePickerCat ? ' active' : '');
            tab.textContent = this._SHAPE_CATS[cat] || cat;
            tab.onclick = () => { this._shapePickerCat = cat; this._renderShapePicker(); };
            tabsEl.appendChild(tab);
        });

        gridEl.innerHTML = '';
        (groups[this._shapePickerCat] || []).forEach(idx => {
            const shape = Shapes[idx];
            const item = document.createElement('button');
            item.className = 'picker-item';
            item.dataset.index = String(idx);
            if (idx === this.currentShapeIndex) item.classList.add('active');
            if (progress[shape.name]) {
                item.classList.add('collected');
                item.style.background = '#F1F8E9';
            }

            // 图标渲染一次即缓存（dataURL），避免每次打开图鉴重绘几十个 canvas
            if (!this._iconCache) this._iconCache = {};
            let iconUrl = this._iconCache[shape.name];
            if (!iconUrl && typeof shape.drawFillPath === 'function') {
                const cv = document.createElement('canvas');
                cv.width = 96; cv.height = 96;
                const c = cv.getContext('2d');
                c.lineJoin = 'round';
                // fill → stroke → 再 fill：多部件并集的内部边被二次填充盖掉，只留外轮廓
                shape.drawFillPath(c, 48, 48, 78);
                c.fillStyle = '#FFF8E7';
                c.fill();
                c.lineWidth = 3.5;
                c.strokeStyle = '#8D6E63';
                c.stroke();
                c.fillStyle = '#FFF8E7';
                c.fill();
                iconUrl = cv.toDataURL('image/png');
                this._iconCache[shape.name] = iconUrl;
            }

            const label = document.createElement('span');
            label.className = 'picker-shape-name';
            label.textContent = shape.name;

            if (iconUrl) {
                const icon = document.createElement('img');
                icon.src = iconUrl;
                icon.alt = '';
                item.appendChild(icon);
            }
            item.setAttribute('aria-label', shape.name);
            item.appendChild(label);
            if (progress[shape.name]) {
                const badge = document.createElement('span');
                badge.className = 'picker-shape-badge';
                badge.textContent = '✓';
                item.appendChild(badge);
            }
            item.onclick = () => this._selectShape(idx);
            gridEl.appendChild(item);
        });
    },

    // 选中形状：重建图层（hitMap/蒙版随新形状）后从头开始描边
    _selectShape(index) {
        if (typeof index !== 'number' || index < 0 || index >= Shapes.length) return;
        this.currentShapeIndex = index;
        this._closeShapePicker();
        // 取消待执行的成功自动前进，避免 3 秒后覆盖手动选择
        if (this._advanceTimer) { clearTimeout(this._advanceTimer); this._advanceTimer = null; }
        this.resizeCanvas();
        this.startTracing();
    },

    // === 事件（只绑一次）===
    _addEvents() {
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._onStart(this._pos(e)); }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._onMove(this._pos(e)); }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this._onEnd(); }, { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this._onStart(this._pos(e)));
        this.canvas.addEventListener('mousemove', (e) => this._onMove(this._pos(e)));
        this.canvas.addEventListener('mouseup', () => this._onEnd());
        // 鼠标拖出画布后松开时，mouseup 不会落在画布上——在 window 兜底结束笔画，
        // 否则 _isDrawing 卡死，之后鼠标悬停也会被当成描边（点一下就"铺满"的元凶）
        window.addEventListener('mouseup', () => { if (this._isDrawing) this._onEnd(); });

        // 形状图鉴：头部按钮打开，backdrop / ✕ 关闭
        const shapeBtn = document.getElementById('tracing-shape-btn');
        if (shapeBtn) shapeBtn.addEventListener('click', () => this._openShapePicker());
        document.querySelectorAll('#shape-picker [data-close]').forEach(el => {
            el.addEventListener('click', () => this._closeShapePicker());
        });
    },

    _pos(e) {
        const r = this.canvas.getBoundingClientRect();
        const s = e.touches ? e.touches[0] : e;
        return { x: s.clientX - r.left, y: s.clientY - r.top };
    },

    _onStart(p) {
        this._isDrawing = true;
        if (this.mode === 'tracing') {
            // 每次落笔重置插值链：插值只允许发生在一次连续拖动内部，
            // 否则分散的两次点击会被连线"铺"出大段假覆盖
            if (this._lastIdx) this._lastIdx = this._lastIdx.map(() => null);
            this._updateProgress(p.x, p.y); this.redraw();
        }
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
