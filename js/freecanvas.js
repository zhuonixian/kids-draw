// === 自由画布模块（v5 - 快照撤销 + 贴纸/图形选择弹层 + 贴纸选中拖动）===
// 照片导入：源图长边上限（1536×1152×4B≈6.75MiB，防大图撑爆 WebView 堆）
const PHOTO_MAX_EDGE = 1536;
// 撤销历史最多保留的非空照片引用条数：更早背景条目 photo 置 null（撤销时 objects/场景照常恢复，仅照片缺失回底色）
const PHOTO_HISTORY_KEEP = 5;
// 绘画回放：单幅 record.replay 的 JSON 体积预算（超限逐级：6px 重抽稀→丢照片背景→加大抽稀距离→
// 压单笔点数上限→丢最早事件；任何作品最终 ≤ 该预算，极端情况放弃回放数据返回 null）
const REPLAY_MAX_JSON = 100 * 1024;

const FreeCanvas = {
    canvas: null,
    ctx: null,
    dpr: 1,

    currentColor: '#FF6B6B',
    brushSize: 16,
    brushType: 'crayon',
    _lastPaintBrush: 'crayon', // 橡皮擦切回画笔时恢复的最近画笔类型
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
    // 照片背景（内存态，不持久化）：_photoSrc=降采样源图 canvas；_photoCanvas=按画布设备像素尺寸 cover 裁好的层
    _photoSrc: null,
    _photoCanvas: null,
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

    // 图形分类：几何/符号类程序化绘制精确可控、可填色，与贴纸 PNG 差异化；
    // 抽象的动物/自然/卡通简笔画已移除（贴纸库 21 类 PNG 全面覆盖）
    shapeCategories: {
        basic:  { label: '基础', shapes: ['circle', 'ellipse', 'square', 'rect', 'triangle', 'pentagon', 'hexagon', 'octagon', 'diamond', 'parallelogram', 'trapezoid', 'semicircle'] },
        fun:    { label: '趣味', shapes: ['star', 'fourstar', 'heart', 'crescent', 'drop', 'sun', 'cloud', 'flower', 'snowflake', 'gem'] },
        symbol: { label: '符号', shapes: ['arrow', 'bubble', 'note', 'bolt', 'plus'] }
    },

    bgColors: ['#FFFFFF', '#FFF8E7', '#F0F4FF', '#FDE8E8', '#E8F5E9', '#FFF3E0', '#F3E5F5', '#E0F7FA'],

    // 灵感骰子点子池（场景 × 贴纸 × 画笔 × 对称 的组合灵感）
    ideas: [
        '在海底场景放一群小鱼贴纸 🐟',
        '用万花筒画一朵大花 🌸',
        '给小粉猪画一栋房子 🏠',
        '用荧光笔在太空画星星 ✨',
        '画一场彩虹色的雨 🌈',
        '在草地场景放 5 只小动物 🐰',
        '用左右对称画一只蝴蝶 🦋',
        '画一个大太阳和向日葵贴纸 🌻',
        '在雪地场景画一个雪人 ⛄',
        '用喷雾笔画一场烟火 🎆',
        '给妈妈画一串爱心 ❤️',
        '画一辆会飞的小汽车 🚗',
        '用彩虹笔写自己的名字 ✏️',
        '在海底放一只戴帽子的章鱼 🐙',
        '画一只长颈鹿在吃云朵 🦒',
        '用发光笔画夜晚的萤火虫 🌟',
        '给恐龙贴纸画一座火山 🌋',
        '在太空放一队小外星人 👽'
    ],
    _lastIdea: null,

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
        this._renderPhotoCover(); // 有照片时按新画布尺寸从源图重渲 cover 层（window resize 自动覆盖）
    },

    // === UI 初始化 ===
    _initUI() {
        // 颜色（只构建一次，避免重进场景时圆钮颜色与实际选色脱节）
        const cc = document.getElementById('freecanvas-colors');
        if (!cc.children.length) createColorPicker('freecanvas-colors', (hex) => { this.currentColor = hex; });

        // 工具按钮（贴纸/图形工具额外打开对应选择弹层；场景只开面板不切工具）
        // 点击时 toast 名称+用法说明
        document.querySelectorAll('.fc-toolbar .tool-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.dataset.tool === 'scene') {
                    App.showToast('🏞 场景：换一个画画的背景，海底太空任你选', 1600);
                    this._togglePanel('scene-panel');
                    return;
                }
                if (btn.dataset.tool === 'photo') {
                    // 照片是一次性导入动作，不切换画布工具（保持当前笔/贴纸继续涂）
                    App.showToast('📷 照片：选一张照片当背景涂鸦', 1600);
                    const photoFile = document.getElementById('fc-photo-file');
                    if (photoFile) photoFile.click();
                    return;
                }
                this.currentTool = btn.dataset.tool;
                if (btn.dataset.type === 'eraser') {
                    this.brushType = 'eraser';
                } else if (btn.dataset.tool === 'brush' && this.brushType === 'eraser') {
                    this.brushType = this._lastPaintBrush || 'crayon'; // 从橡皮切回画笔：恢复上次画笔，不再粘连
                }
                if (this.currentTool !== 'sticker' && this._selectedObj) {
                    this._selectedObj = null; // 切走贴纸工具：清掉选中虚线圈
                    this._cacheDirty = true;
                    this.redraw();
                }
                this._updateHighlight();
                const tips = {
                    brush: '✏️ 画笔：在画布上拖动画画',
                    eraser: '🧽 橡皮擦：擦掉画错的地方',
                    shape: '⬠ 图形：选一个图形放到画布上，再用填充涂色',
                    sticker: '⭐ 贴纸：选一个贴纸，回到画布点一下放下',
                    fill: '🎨 填充：点一下图形，给它涂上颜色',
                    pan: '🖐 拖动画布：移动画布，看其他地方'
                };
                App.showToast(tips[btn.dataset.type === 'eraser' ? 'eraser' : btn.dataset.tool] || '', 1600);
                App.say(btn.dataset.type === 'eraser' ? '橡皮擦' : '');
                if (btn.dataset.tool === 'sticker') this._togglePanel('sticker-panel');
                else if (btn.dataset.tool === 'shape') this._togglePanel('shape-panel');
            };
        });

        // 画笔类型
        document.querySelectorAll('.fc-toolbar .brush-type-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.id === 'fc-symmetry') return; // 对称按钮走独立循环切换
                this.brushType = btn.dataset.type;
                this._lastPaintBrush = btn.dataset.type;
                this.currentTool = 'brush';
                this._updateHighlight();
                const brushTips = {
                    crayon: '🖍 彩笔：经典蜡笔质感',
                    marker: '🖊 马克笔：半透明宽笔触',
                    brush: '🖌 毛笔：柔软书法笔',
                    highlighter: '🖍 荧光笔：宽扁半透明，涂重点',
                    rainbow: '🌈 彩虹笔：一笔画出七彩颜色',
                    spray: '💨 喷雾：喷出彩色小点点',
                    glow: '✨ 发光笔：夜晚霓虹光效果',
                    dotted: '▪️ 虚线笔：可爱的虚线条'
                };
                App.showToast(brushTips[btn.dataset.type] || '', 1600);
                const brushSpeech = { crayon: '彩笔', marker: '马克笔', brush: '毛笔', highlighter: '荧光笔', rainbow: '彩虹笔', spray: '喷雾', glow: '发光笔', dotted: '虚线笔' };
                App.say(brushSpeech[btn.dataset.type] || '');
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

        // 灵感骰子：随机一条创作点子（避免连续重复）
        const ideaBtn = document.getElementById('fc-idea');
        if (ideaBtn) {
            ideaBtn.onclick = () => {
                const pool = this.ideas.filter(i => i !== this._lastIdea);
                const idea = pool[Math.floor(Math.random() * pool.length)];
                this._lastIdea = idea;
                App.showToast('🎲 ' + idea, 3400);
            };
        }

        // 照片文件选择：赋值式绑定（_initUI 每次进场景重跑，addEventListener 会随重进次数叠加触发）
        const photoInput = document.getElementById('fc-photo-file');
        if (photoInput) {
            photoInput.onchange = (e) => {
                const f = e.target.files && e.target.files[0];
                e.target.value = ''; // 先取 File 再清 value，连续选同一张照片也能触发
                if (f) this._onPhotoFile(f);
            };
        }
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
                this._photoSrc = null; // 场景与照片互斥：选场景即替换照片（不入栈，与换场景不可撤销一致）
                this._renderPhotoCover();
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
    // 普通快照：仅 objects，不带背景键 → 撤销不动场景/照片（笔画/贴纸/图形/填充/拖动全走这条）
    _pushHistory() {
        this._pushSnapshot(JSON.parse(JSON.stringify(this.objects)));
    },

    // 背景快照：清空/放照片两个背景动作专用，携带旧背景；photo 可为 null = 撤销回「无背景」
    _pushBgHistory() {
        this._pushSnapshot({
            objects: JSON.parse(JSON.stringify(this.objects)),
            scene: this.canvasScene,
            photo: this._photoSrc // canvas 存引用不深拷贝，驻留量由 _trimPhotoHistory 定界
        });
    },

    _pushSnapshot(snap) {
        // 裸数组 = 普通快照，统一包装成 {objects}；背景条目已是 {objects, scene, photo} 直接入栈
        const entry = Array.isArray(snap) ? { objects: snap } : snap;
        this._history.push(entry);
        if (this._history.length > 40) this._history.shift();
        if (entry.photo) this._trimPhotoHistory();
        this._updateUndoBtn();
    },

    // 从新到旧仅保留最近 PHOTO_HISTORY_KEEP 条非空照片引用、更早置 null：
    // 防 40 条历史各持一张大图（40×7.1MB≈284MB）撑爆 WebView 堆；被裁条目撤销时仅照片缺失
    _trimPhotoHistory() {
        let keep = 0;
        for (let i = this._history.length - 1; i >= 0; i--) {
            const e = this._history[i];
            if (e.photo) {
                if (keep < PHOTO_HISTORY_KEEP) keep++;
                else e.photo = null;
            }
        }
    },

    _updateUndoBtn() {
        const btn = document.getElementById('fc-undo');
        if (btn) btn.disabled = !this._history.length;
    },

    _undo() {
        if (!this._history.length) return;
        const e = this._history.pop();
        this.objects = e.objects;
        // 背景条目才带 scene 键：连背景一起恢复；普通撤销不碰背景，避免撤销笔画时背景跳变
        if ('scene' in e) {
            this.canvasScene = e.scene;
            this._photoSrc = e.photo || null;
            this._renderPhotoCover();
        }
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
            this._pushBgHistory(); // 清空是背景动作：旧场景/照片随笔迹入栈，误清空可撤销
            this.objects = [];
            this._selectedObj = null;
            this._draggingObj = null;
            this.canvasScene = null; // 清空 = 回到干净画布（场景一并清掉）
            this._photoSrc = null; // 照片一并清掉，回用户所选底色（不重置 bgColor，沿用现有语义）
            this._photoCanvas = null;
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

    // === 照片导入涂鸦 ===
    _onPhotoFile(file) {
        // createImageBitmap 优先：按 EXIF 方向摆正（安卓相机竖拍）；不支持/失败回退 ObjectURL + Image
        const fallback = () => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); this._placePhoto(img); };
            img.onerror = () => URL.revokeObjectURL(url); // 解码失败静默，不打扰孩子
            img.src = url;
        };
        if (window.createImageBitmap) {
            createImageBitmap(file, { imageOrientation: 'from-image' })
                .then(bmp => this._placePhoto(bmp))
                .catch(fallback);
        } else {
            fallback();
        }
    },

    _placePhoto(bitmap) {
        this._pushBgHistory(); // 旧背景（场景/照片）入栈，放错可撤销回去
        this.canvasScene = null; // 照片与场景互斥
        // 源图降采样到长边 PHOTO_MAX_EDGE 再存引用：撤销历史与 cover 层都从这张小图重渲
        const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        const src = document.createElement('canvas');
        src.width = Math.max(1, Math.round(bitmap.width * scale));
        src.height = Math.max(1, Math.round(bitmap.height * scale));
        src.getContext('2d').drawImage(bitmap, 0, 0, src.width, src.height);
        if (bitmap.close) bitmap.close(); // ImageBitmap 用后释放原生位图（HTMLImageElement 兜底无此方法）
        this._photoSrc = src;
        this._renderPhotoCover();
        this._cacheDirty = true;
        this.redraw();
        App.showToast('照片放好啦，开始涂鸦 🖍', 1600);
        App.say('照片');
    },

    // 按当前画布设备像素尺寸把 _photoSrc cover 裁好（等比铺满、居中裁掉超出的边）；无照片则清空该层
    _renderPhotoCover() {
        if (!this._photoSrc || !this.canvas) { this._photoCanvas = null; return; }
        const c = document.createElement('canvas');
        c.width = this.canvas.width;
        c.height = this.canvas.height;
        const scale = Math.max(c.width / this._photoSrc.width, c.height / this._photoSrc.height);
        const dw = this._photoSrc.width * scale, dh = this._photoSrc.height * scale;
        c.getContext('2d').drawImage(this._photoSrc, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
        this._photoCanvas = c;
    },

    // === 保存作品 ===
    _saveArtwork() {
        if (!this.objects.length) { App.showToast('先画点什么吧～'); return; }
        const record = ArtworkStore.save(this.canvas, { scene: 'freecanvas', name: '自由画作', replay: this._buildReplayData() });
        if (record) {
            App.showToast('作品已保存 🎉');
            if (typeof Missions !== 'undefined') Missions.bump('save');
            if (App.playStickerSound) App.playStickerSound();
        } else {
            App.showToast('保存失败，稍后再试');
        }
    },

    // === 绘画回放数据（保存时按 objects 快照构建，撤销/删除自动反映） ===
    // 抽稀：距上一保留点不足 minDist 且时间差不足 200ms 的点丢弃，首末点恒保留。
    // 毛笔传 1.5（宽度由相邻点距决定，抽稀变大点距会让回放笔锋偏细，低阈值保真）；普通笔型 3px / 重抽稀 6px
    _thinPoints(points, minDist) {
        if (points.length <= 2) return points.slice();
        const out = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const last = out[out.length - 1];
            const dx = points[i].x - last.x, dy = points[i].y - last.y;
            if (dx * dx + dy * dy >= minDist * minDist || (points[i].t - last.t) >= 200) out.push(points[i]);
        }
        out.push(points[points.length - 1]);
        return out;
    },

    // 照片背景压 480px JPEG（回放只需认得出底图，约 25-45KB）
    _photoReplayDataUrl() {
        if (!this._photoSrc) return null;
        const scale = Math.min(1, 480 / Math.max(this._photoSrc.width, this._photoSrc.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(this._photoSrc.width * scale));
        c.height = Math.max(1, Math.round(this._photoSrc.height * scale));
        c.getContext('2d').drawImage(this._photoSrc, 0, 0, c.width, c.height);
        try { return c.toDataURL('image/jpeg', 0.55); } catch (e) { return null; }
    },

    _buildReplayData() {
        const r = this.canvas.getBoundingClientRect();
        const buildEvents = (normalMin, brushMin) => {
            const evts = [];
            this.objects.forEach(o => {
                if (o.type === 'stroke') {
                    if (!o.points || !o.points.length) return;
                    const thinned = this._thinPoints(o.points, o.brushType === 'brush' ? (brushMin || 1.5) : normalMin);
                    const ev = {
                        k: 's',
                        t: o.st || 0,
                        b: o.brushType,
                        c: o.color,
                        z: o.size,
                        pts: thinned.map(p => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round((p.t || 0) / 20) * 20])
                    };
                    if (o.sym) { ev.sym = o.sym; ev.cx = o.cx; ev.cy = o.cy; }
                    evts.push(ev);
                } else {
                    const copy = JSON.parse(JSON.stringify(o));
                    delete copy.st; // 出现时刻记在事件 t 上，对象小拷贝里不重复
                    evts.push({ k: 'o', t: o.st || 0, o: copy });
                }
            });
            // t 稳定排序兑底（复制/拖动会改写 st）；再压缩跨会话空闲：相邻事件间隔 >2s 压到 2s
            evts.sort((a, b) => a.t - b.t);
            let prev = 0;
            evts.forEach(ev => {
                if (ev.t - prev > 2000) ev.t = prev + 2000;
                prev = ev.t;
            });
            return evts;
        };
        const replay = {
            v: 1,
            w: Math.round(r.width),
            h: Math.round(r.height),
            bg: { color: this.bgColor, scene: this.canvasScene || null, photo: this._photoReplayDataUrl() },
            events: buildEvents(3)
        };
        // 体积梯子（逐级升级直到装进预算，任何作品最终 ≤ REPLAY_MAX_JSON）：
        // ① >90KB 先 6px 距离重抽稀一次（毛笔仍 1.5px）；② 仍超预算丢照片背景退化纯底色；
        // ③ 距离抽稀对快笔无效（相邻点距本已 >6px）→ 逐级加大抽稀距离，毛笔阈值同步放宽但封顶 6px 保笔锋；
        // ④ 仍超限 → 逐级压单笔点数上限（均匀抽点保首末点，末点 t 保住整笔时长）；
        // ⑤ 极端笔画数量 → 按事件体积从最新往回保留直到装进预算、丢最早事件并归零起始时刻；
        //    连一个事件都装不下则返回 null（作品图照常保存，仅无回放）
        const jsonLen = () => JSON.stringify(replay).length;
        if (jsonLen() > REPLAY_MAX_JSON * 0.9) {
            replay.events = buildEvents(6);
        }
        if (jsonLen() > REPLAY_MAX_JSON) {
            replay.bg.photo = null;
        }
        let minDist = 6;
        while (jsonLen() > REPLAY_MAX_JSON && minDist < 100) {
            minDist = Math.round(minDist * 1.6);
            replay.events = buildEvents(minDist, Math.min(minDist, 6));
        }
        const capStrokePoints = (cap) => {
            replay.events.forEach(ev => {
                if (ev.k !== 's' || !ev.pts || ev.pts.length <= cap) return;
                const step = (ev.pts.length - 1) / (cap - 1);
                const kept = [];
                for (let i = 0; i < cap - 1; i++) kept.push(ev.pts[Math.round(i * step)]);
                kept.push(ev.pts[ev.pts.length - 1]);
                ev.pts = kept;
            });
        };
        let cap = 500;
        while (jsonLen() > REPLAY_MAX_JSON && cap > 25) {
            cap = Math.max(25, Math.round(cap * 0.7));
            capStrokePoints(cap);
        }
        if (jsonLen() > REPLAY_MAX_JSON) {
            const sizes = replay.events.map(ev => JSON.stringify(ev).length + 1);
            const overhead = jsonLen() - sizes.reduce((a, b) => a + b, 0);
            let total = overhead, keep = 0;
            for (let i = sizes.length - 1; i >= 0; i--) {
                if (total + sizes[i] > REPLAY_MAX_JSON) break;
                total += sizes[i];
                keep++;
            }
            if (!keep) return null;
            if (keep < replay.events.length) {
                replay.events = replay.events.slice(-keep);
                const t0 = replay.events[0].t || 0;
                replay.events.forEach(ev => { ev.t = Math.max(0, ev.t - t0); });
            }
        }
        return replay;
    },

    _preloadStickers() {
        if (typeof StickerLibrary === 'undefined') return;
        let pending = 0;
        StickerLibrary.items.forEach(sticker => {
            if (this.stickerImages[sticker.id]) return;
            const img = new Image();
            pending++;
            img.onload = () => { if (--pending === 0 && this.canvas) this.redraw(); };
            img.src = sticker.source;
            this.stickerImages[sticker.id] = img;
        });
    },

    // 按需预加载指定位图的贴纸（画廊回放烤贴纸用）：本会话未进过自由画布时 stickerImages 为空，
    // _drawStickerObj 会全部落到笑脸兜底圆。返回 Promise，加载完成/失败/超时均 resolve（失败仍走兜底，不阻塞回放）。
    // 与 _preloadStickers 共用 stickerImages 缓存，幂等可重入。
    _preloadStickersFor(ids, timeoutMs) {
        if (typeof StickerLibrary === 'undefined' || !ids || !ids.length) return Promise.resolve();
        const waits = [];
        ids.forEach(id => {
            let img = this.stickerImages[id];
            if (!img) {
                const sticker = StickerLibrary.items.find(it => it.id === id);
                if (!sticker) return;
                img = new Image();
                img.src = sticker.source;
                this.stickerImages[id] = img;
            }
            if (img.complete) return;
            waits.push(new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            }));
        });
        if (!waits.length) return Promise.resolve();
        const timeout = new Promise(resolve => setTimeout(resolve, timeoutMs || 3000));
        return Promise.race([Promise.all(waits), timeout]);
    },

    _shapeIcon(type) {
        // 24px 线框小图标：几何 path 与 _shapePath 形状一致（stroke 显示）
        const poly = (n, r, rot) => {
            const pts = [];
            for (let i = 0; i < n; i++) {
                const a = rot + i / n * Math.PI * 2;
                pts.push((12 + Math.cos(a) * r * 9.5).toFixed(1) + ',' + (12 + Math.sin(a) * r * 9.5).toFixed(1));
            }
            return '<polygon points="' + pts.join(' ') + '" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>';
        };
        const icons = {
            circle: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
            ellipse: '<ellipse cx="12" cy="12" rx="9.5" ry="7" stroke="currentColor" stroke-width="1.6" fill="none"/>',
            square: '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
            rect: '<rect x="3" y="6.5" width="18" height="11" rx="1.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
            triangle: poly(3, 0.85, -Math.PI / 2),
            pentagon: poly(5, 0.85, -Math.PI / 2),
            hexagon: poly(6, 0.85, -Math.PI / 2),
            octagon: poly(8, 0.85, -Math.PI / 2 + Math.PI / 8),
            diamond: '<polygon points="12,3.5 19,12 12,20.5 5,12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
            parallelogram: '<polygon points="7,18 10,6 21,6 18,18" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
            trapezoid: '<polygon points="8,7 16,7 20,17 4,17" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
            semicircle: '<path d="M3.5 15 A8.5 8.5 0 0 1 20.5 15 Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
            star: '<polygon points="12,3 14.6,8.7 20.8,9.4 16.2,13.6 17.5,19.7 12,16.6 6.5,19.7 7.8,13.6 3.2,9.4 9.4,8.7" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
            fourstar: '<polygon points="12,3 14,10 21,12 14,14 12,21 10,14 3,12 10,10" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
            heart: '<path d="M12 20C12 20 4 14.5 4 9.5 4 6.5 6.2 4.5 8.5 4.5c1.4 0 2.7 1 3.5 2.5.8-1.5 2.1-2.5 3.5-2.5 2.3 0 4.5 2 4.5 5 0 5-8 10.5-8 10.5z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
            crescent: '<path d="M14.5 3.5 A9 9 0 1 0 14.5 20.5 A7 7 0 1 1 14.5 3.5 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
            drop: '<path d="M12 3 C16 8 17.5 11 17.5 14 A5.5 5.5 0 0 1 6.5 14 C6.5 11 8 8 12 3 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
            sun: '<circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.6" fill="none"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.9 1.9M17.1 17.1L19 19M5 19l1.9-1.9M17.1 6.9L19 5"/></g>',
            cloud: '<path d="M6.5 17.5a3.6 3.6 0 01-.5-7.2A6 6 0 0117.6 11h.9a3.3 3.3 0 010 6.5z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
            flower: '<g stroke="currentColor" stroke-width="1.4" fill="none"><ellipse cx="12" cy="7" rx="2.6" ry="3.4"/><ellipse cx="12" cy="17" rx="2.6" ry="3.4"/><ellipse cx="7" cy="12" rx="3.4" ry="2.6"/><ellipse cx="17" cy="12" rx="3.4" ry="2.6"/><circle cx="12" cy="12" r="2"/></g>',
            snowflake: '<g stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"><polygon points="12,4 19,16 5,16"/><polygon points="12,20 5,8 19,8"/></g>',
            gem: '<polygon points="5,8.5 8,4.5 16,4.5 19,8.5 12,19.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
            arrow: '<polygon points="12,3 17.5,9 14.2,9 14.2,21 9.8,21 9.8,9 6.5,9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
            bubble: '<path d="M4 10.5 A8 6 0 0 1 20 10.5 A8 6 0 0 1 4 10.5 Z M8.5 15.5 L6.5 20 L11.5 16.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
            note: '<g stroke="currentColor" stroke-width="1.5" fill="none"><ellipse cx="8.5" cy="16.5" rx="3.2" ry="2.4" transform="rotate(-18 8.5 16.5)"/><path d="M11.5 16V4.5h4 c-0.5 2.5 1.5 4 2.5 5.5"/></g>',
            bolt: '<polygon points="13.5,3 6.5,13 10,13 8.5,21 15.5,11 12,11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
            plus: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>'
        };
        return '<svg viewBox="0 0 24 24" width="18" height="18">' + (icons[type] || icons.circle) + '</svg>';
    },

    _updateHighlight() {
        document.querySelectorAll('.fc-toolbar .tool-btn').forEach(b => {
            let on = b.dataset.tool === this.currentTool;
            // 画笔/橡皮擦同 data-tool=brush：按 brushType 互斥高亮，避免两钮同时亮
            if (b.dataset.tool === 'brush') on = this.currentTool === 'brush' && (b.dataset.type === 'eraser') === (this.brushType === 'eraser');
            b.classList.toggle('active', on);
        });
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
            copy.st = Math.round(this._nowRel() / 20) * 20; // 副本按当下时刻作为回放"瞬间出现"事件
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
    // 回放时间基：惰性初始化一次、永不重置（objects 跨场景保留，onEnter/_handleClear/_undo 一律不触碰，
    // 重置会让跨场景保留的旧对象混入新时间基，回放顺序颠倒）
    _nowRel() {
        if (this._drawT0 == null) this._drawT0 = performance.now();
        return performance.now() - this._drawT0;
    },

    _startStroke(p) {
        this._isDrawing = true; this._lastPoint = p;
        this._strokeT0Abs = performance.now(); // 本笔绝对起点：points[].t 相对它取 20ms 网格
        this.currentStroke = { type: 'stroke', brushType: this.brushType === 'eraser' ? 'eraser' : this.brushType, color: this.currentColor, size: this.brushType === 'eraser' ? this.brushSize * 2 : this.brushSize, st: Math.round(this._nowRel() / 20) * 20, points: [{ x: p.x, y: p.y, t: 0 }] };
        // 对称画：以落笔时的视口中心为对称轴/对称心（世界坐标），保证所见即所得
        if (this.symmetry !== 'off') {
            const r = this.canvas.getBoundingClientRect();
            this.currentStroke.sym = this.symmetry;
            this.currentStroke.cx = r.width / 2 - this.panX;
            this.currentStroke.cy = r.height / 2 - this.panY;
        }
        // 任务埋点：任何落笔都上报（sym/scene 由任务条件自行过滤）
        if (typeof Missions !== 'undefined') Missions.bump('stroke', { sym: this.symmetry, scene: this.canvasScene });
        if (typeof App !== 'undefined' && App.playDrawSound) App.playDrawSound(this.brushType);
        this.redraw();
    },
    _continueStroke(p) {
        if (!this._isDrawing || !this.currentStroke) return;
        const dx = p.x - this._lastPoint.x, dy = p.y - this._lastPoint.y;
        if (dx * dx + dy * dy < 2) return;
        this.currentStroke.points.push({ x: p.x, y: p.y, t: Math.round((performance.now() - this._strokeT0Abs) / 20) * 20 }); this._lastPoint = p;
        if (typeof App !== 'undefined' && App.playDrawSound) App.playDrawSound(this.brushType);
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
        this.objects.push({ type: 'shape', shapeType: this.currentShapeType, x: pos.x, y: pos.y, size: this.shapeSize, fillColor: null, strokeColor: this.currentColor, strokeWidth: 3, st: Math.round(this._nowRel() / 20) * 20 }); // st = 回放"瞬间出现"时刻
        this._cacheDirty = true;
        this.redraw();
    },

    _placeSticker(pos) {
        const obj = { type: 'sticker', stickerId: this.currentStickerId, x: pos.x, y: pos.y, size: this.shapeSize * 1.6, rotation: 0, st: Math.round(this._nowRel() / 20) * 20 };
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

        // 照片背景：视口坐标不随画布拖动（与场景互斥），画在笔迹缓存层之下——橡皮只擦笔迹不伤照片
        if (this._photoCanvas) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(this._photoCanvas, 0, 0);
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
        // 荧光笔：宽扁半透明（低 alpha 叠涂自然加深）
        if (s.brushType === 'highlighter') {
            ctx.save();
            ctx.globalAlpha = 0.32;
            ctx.strokeStyle = s.color; ctx.lineWidth = s.size * 2.5;
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
        // 蜡笔：纸面颗粒质感（确定性随机保证撤销/重绘不闪变）
        if (s.brushType === 'crayon') {
            ctx.save();
            ctx.strokeStyle = s.color;
            ctx.lineCap = 'round';
            const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
            if (pts.length === 1) {
                for (let k = 0; k < 5; k++) {
                    const a = rnd(k * 3 + 1) * Math.PI * 2, rr = rnd(k * 5 + 2) * s.size * 0.4;
                    ctx.globalAlpha = 0.4 + rnd(k + 9) * 0.4;
                    ctx.lineWidth = s.size * (0.25 + rnd(k * 7) * 0.3);
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x + Math.cos(a) * rr - 1, pts[0].y + Math.sin(a) * rr);
                    ctx.lineTo(pts[0].x + Math.cos(a) * rr + 1, pts[0].y + Math.sin(a) * rr);
                    ctx.stroke();
                }
            } else {
                for (let i = 1; i < pts.length; i++) {
                    const p0 = pts[i - 1], p1 = pts[i];
                    const dx = p1.x - p0.x, dy = p1.y - p0.y;
                    const len = Math.hypot(dx, dy) || 1;
                    const nx = -dy / len, ny = dx / len;
                    for (let k = 0; k < 3; k++) {
                        const r1 = rnd(i * 7 + k), r2 = rnd(i * 13 + k + 41);
                        const off = (r1 - 0.5) * s.size * 0.6;
                        const shrink = 0.3 + r2 * 0.55;
                        ctx.globalAlpha = 0.32 + r2 * 0.46;
                        ctx.lineWidth = s.size * (0.26 + r1 * 0.3);
                        ctx.beginPath();
                        ctx.moveTo(p0.x + dx * (0.5 - shrink / 2) + nx * off, p0.y + dy * (0.5 - shrink / 2) + ny * off);
                        ctx.lineTo(p0.x + dx * (0.5 + shrink / 2) + nx * off, p0.y + dy * (0.5 + shrink / 2) + ny * off);
                        ctx.stroke();
                    }
                }
            }
            ctx.restore(); return;
        }
        // 马克笔：方头宽笔，均匀半透明，重复涂自然加深
        if (s.brushType === 'marker') {
            ctx.save();
            ctx.globalAlpha = 0.38;
            ctx.strokeStyle = s.color; ctx.lineWidth = s.size * 0.95;
            ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
            if (pts.length === 1) { ctx.fillRect(pts[0].x - s.size * 0.48, pts[0].y - s.size * 0.2, s.size * 0.95, s.size * 0.4); }
            else { ctx.beginPath(); this._path(ctx, pts); ctx.stroke(); }
            ctx.restore(); return;
        }
        // 毛笔：笔锋随速度变化（慢粗快细，起收笔渐尖），多边形带宽填充
        if (s.brushType === 'brush') {
            ctx.save();
            ctx.fillStyle = s.color;
            ctx.globalAlpha = 0.95;
            if (pts.length < 3) {
                ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s.size * 0.45, 0, Math.PI * 2); ctx.fill();
            } else {
                // 每点局部速度 → 目标宽度（越快越细）
                const w = [];
                for (let i = 0; i < pts.length; i++) {
                    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
                    const v = Math.hypot(b.x - a.x, b.y - a.y);
                    const t = Math.max(0, Math.min(1, (v - 2) / 26));
                    w.push(s.size * 0.62 * (1.05 - t * 0.75));
                }
                // 三点平滑，笔锋自然
                const sm = w.map((_, i) => (w[Math.max(0, i - 1)] + w[i] + w[Math.min(w.length - 1, i + 1)]) / 3);
                // 端点渐尖（起笔收笔）
                sm[0] *= 0.45; sm[sm.length - 1] *= 0.45;
                sm[1] *= 0.8; sm[sm.length - 2] *= 0.8;
                const up = [], dn = [];
                for (let i = 0; i < pts.length; i++) {
                    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const len = Math.hypot(dx, dy) || 1;
                    const nx = -dy / len, ny = dx / len, hw = sm[i] / 2;
                    up.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
                    dn.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
                }
                ctx.beginPath();
                ctx.moveTo(up[0].x, up[0].y);
                for (let i = 1; i < up.length; i++) ctx.lineTo(up[i].x, up[i].y);
                for (let i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i].x, dn[i].y);
                ctx.closePath(); ctx.fill();
            }
            ctx.restore(); return;
        }
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

        // 友好圆润的图形加笑脸+小手；细长/尖锐/符号类不加，保持形状语义
        if (['circle', 'ellipse', 'square', 'rect', 'triangle', 'pentagon', 'hexagon', 'octagon', 'semicircle', 'heart', 'drop', 'cloud', 'flower'].includes(type)) {
            this._drawTinyArms(ctx, x, y, r, type);
            this._drawHappyFace(ctx, x, y - r * 0.04, r * 0.52);
        } else if (type === 'sun') {
            this._drawHappyFace(ctx, x, y, r * 0.44);
        } else if (type === 'gem') {
            this._drawHappyFace(ctx, x, y + r * 0.05, r * 0.38);
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


    _drawCheeks(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(253,121,168,0.55)';
        ctx.beginPath(); ctx.ellipse(x - r * 0.42, y + r * 0.08, r * 0.12, r * 0.07, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + r * 0.42, y + r * 0.08, r * 0.12, r * 0.07, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    _drawTinyArms(ctx, x, y, r, type) {
        const yOffset = type === 'cloud' || type === 'flower' ? r * 0.05 : 0;
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








    _shapePath(ctx, type, x, y, s) {
        ctx.beginPath();
        // 正多边形辅助
        const poly = (n, r, rot) => {
            for (let i = 0; i < n; i++) {
                const a = rot + i / n * Math.PI * 2;
                const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
        };
        // 尖角星辅助（2n 个点，外内半径交替）
        const spike = (n, rOuter, rInner, rot) => {
            for (let i = 0; i < n * 2; i++) {
                const a = rot + i * Math.PI / n;
                const r = i % 2 === 0 ? rOuter : rInner;
                const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
        };
        switch (type) {
            // === 基础几何 ===
            case 'circle': ctx.arc(x, y, s, 0, Math.PI * 2); break;
            case 'ellipse': ctx.ellipse(x, y, s, s * 0.72, 0, 0, Math.PI * 2); break;
            case 'square': ctx.rect(x - s * 0.82, y - s * 0.82, s * 1.64, s * 1.64); break;
            case 'rect': ctx.rect(x - s, y - s * 0.68, s * 2, s * 1.36); break;
            case 'triangle': poly(3, s, -Math.PI / 2); break;
            case 'pentagon': poly(5, s, -Math.PI / 2); break;
            case 'hexagon': poly(6, s, -Math.PI / 2); break;
            case 'octagon': poly(8, s, -Math.PI / 2 + Math.PI / 8); break;
            case 'diamond':
                ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.72, y);
                ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.72, y); ctx.closePath(); break;
            case 'parallelogram':
                ctx.moveTo(x - s * 0.95, y + s * 0.6); ctx.lineTo(x - s * 0.45, y - s * 0.6);
                ctx.lineTo(x + s * 0.95, y - s * 0.6); ctx.lineTo(x + s * 0.45, y + s * 0.6); ctx.closePath(); break;
            case 'trapezoid':
                ctx.moveTo(x - s * 0.6, y - s * 0.62); ctx.lineTo(x + s * 0.6, y - s * 0.62);
                ctx.lineTo(x + s, y + s * 0.62); ctx.lineTo(x - s, y + s * 0.62); ctx.closePath(); break;
            case 'semicircle':
                ctx.arc(x, y + s * 0.35, s * 0.92, Math.PI, 0); ctx.closePath(); break;
            // === 趣味图形 ===
            case 'star': spike(5, s, s * 0.45, -Math.PI / 2); break;
            case 'fourstar': spike(4, s, s * 0.4, -Math.PI / 2); break;
            case 'heart': {
                const sc = s * 0.062;
                for (let i = 0; i <= 40; i++) {
                    const t = i / 40 * Math.PI * 2;
                    const hx = x + sc * 16 * Math.pow(Math.sin(t), 3);
                    const hy = y - sc * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                    i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
                }
                ctx.closePath(); break;
            }
            case 'crescent':
                ctx.arc(x + s * 0.3, y, s, Math.PI * 1.5, Math.PI * 0.5, true);
                ctx.arc(x - s * 0.14, y, s * 0.74, Math.PI * 0.5, Math.PI * 1.5, true);
                ctx.closePath(); break;
            case 'drop':
                ctx.moveTo(x, y - s);
                ctx.bezierCurveTo(x + s * 0.78, y - s * 0.12, x + s * 0.64, y + s * 0.58, x, y + s * 0.8);
                ctx.bezierCurveTo(x - s * 0.64, y + s * 0.58, x - s * 0.78, y - s * 0.12, x, y - s);
                ctx.closePath(); break;
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
            case 'snowflake':
                poly(3, s, -Math.PI / 2);
                poly(3, s, Math.PI / 2);
                break;
            case 'gem':
                ctx.moveTo(x - s * 0.85, y - s * 0.32);
                ctx.lineTo(x - s * 0.45, y - s * 0.78);
                ctx.lineTo(x + s * 0.45, y - s * 0.78);
                ctx.lineTo(x + s * 0.85, y - s * 0.32);
                ctx.lineTo(x, y + s * 0.85);
                ctx.closePath(); break;
            // === 符号 ===
            case 'arrow':
                ctx.moveTo(x, y - s);
                ctx.lineTo(x + s * 0.65, y - s * 0.28);
                ctx.lineTo(x + s * 0.3, y - s * 0.28);
                ctx.lineTo(x + s * 0.3, y + s);
                ctx.lineTo(x - s * 0.3, y + s);
                ctx.lineTo(x - s * 0.3, y - s * 0.28);
                ctx.lineTo(x - s * 0.65, y - s * 0.28);
                ctx.closePath(); break;
            case 'bubble': {
                ctx.ellipse(x, y - s * 0.12, s * 0.95, s * 0.68, 0, 0, Math.PI * 2);
                ctx.moveTo(x - s * 0.28, y + s * 0.5);
                ctx.lineTo(x - s * 0.5, y + s * 0.88);
                ctx.lineTo(x + s * 0.16, y + s * 0.52);
                ctx.closePath(); break;
            }
            case 'note':
                ctx.ellipse(x - s * 0.28, y + s * 0.55, s * 0.44, s * 0.32, -0.35, 0, Math.PI * 2);
                ctx.moveTo(x + s * 0.1, y - s * 0.85);
                ctx.rect(x + s * 0.1, y - s * 0.85, s * 0.16, s * 1.4);
                ctx.moveTo(x + s * 0.26, y - s * 0.85);
                ctx.quadraticCurveTo(x + s * 0.85, y - s * 0.55, x + s * 0.62, y + s * 0.05);
                ctx.lineTo(x + s * 0.26, y - s * 0.2);
                ctx.closePath(); break;
            case 'bolt':
                ctx.moveTo(x + s * 0.28, y - s);
                ctx.lineTo(x - s * 0.55, y + s * 0.12);
                ctx.lineTo(x - s * 0.05, y + s * 0.12);
                ctx.lineTo(x - s * 0.28, y + s);
                ctx.lineTo(x + s * 0.55, y - s * 0.12);
                ctx.lineTo(x + s * 0.05, y - s * 0.12);
                ctx.closePath(); break;
            case 'plus': {
                const a = s * 0.34;
                ctx.moveTo(x - a, y - s); ctx.lineTo(x + a, y - s);
                ctx.lineTo(x + a, y - a); ctx.lineTo(x + s, y - a);
                ctx.lineTo(x + s, y + a); ctx.lineTo(x + a, y + a);
                ctx.lineTo(x + a, y + s); ctx.lineTo(x - a, y + s);
                ctx.lineTo(x - a, y + a); ctx.lineTo(x - s, y + a);
                ctx.lineTo(x - s, y - a); ctx.lineTo(x - a, y - a);
                ctx.closePath(); break;
            }
            default: ctx.arc(x, y, s, 0, Math.PI * 2);
        }
    }
};
