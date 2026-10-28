// === 我的作品：本地画廊 ===
// 绘画回放倍速（2 = 2 倍速重看作画过程）
const REPLAY_SPEED = 2;
const Gallery = {
    grid: null,
    empty: null,
    lightbox: null,
    _currentId: null,      // 预览中的作品
    _deleteArmed: false,   // 删除二次确认
    _deleteTimer: null,
    _deleteLabel: '删除',  // 删除按钮原始文字

    // 绘画回放状态（_replayPlaying 兼作防重复启动与 resize 停止依据）
    _replayPlaying: false,
    _replayRaf: null,

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

        // 绘画回放：仅带 replay 数据的作品显示按钮（旧作品/ZIP 恢复无回放属正常态）
        const replayBtn = document.getElementById('lightbox-replay');
        if (replayBtn) {
            replayBtn.addEventListener('click', () => {
                const record = ArtworkStore.list().find(r => r.id === this._currentId);
                if (record) this._startReplay(record);
            });
        }
        this._replayFrameBound = this._replayFrame.bind(this);
        // 转屏/resize 时回放画布与作品图错位：直接停止重开（init 经 DOMContentLoaded 只跑一次，无重复绑定）
        window.addEventListener('resize', () => {
            if (this._replayPlaying) this._stopReplay();
        });

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
        this._stopReplay();
        document.getElementById('lightbox-img').src = record.dataUrl;
        this._currentId = record.id;
        this._resetDelete();
        const replayBtn = document.getElementById('lightbox-replay');
        if (replayBtn) {
            replayBtn.hidden = !record.replay;
            replayBtn.disabled = false;
            replayBtn.classList.remove('replaying');
        }
        this.lightbox.classList.add('open');
    },

    _closeLightbox() {
        this._stopReplay(); // backdrop 点击/删除/做成贺卡/onEnter 所有关闭路径都汇聚于此，rAF 必清防泄漏
        this.lightbox.classList.remove('open');
        this._currentId = null;
        this._resetDelete();
    },

    // === 绘画回放（三层画布：bg 底色+场景/照片层 → ink 已完成累积层 → 可见层每帧合成 + live 笔画切片） ===
    _startReplay(record) {
        if (this._replayPlaying || !record || !record.replay) return;
        const replay = record.replay;
        if (!replay.events || !replay.events.length || typeof FreeCanvas === 'undefined') return;
        const canvas = document.getElementById('lightbox-replay-canvas');
        const img = document.getElementById('lightbox-img');
        const btn = document.getElementById('lightbox-replay');
        if (!canvas || !img || !btn) return;

        clearTimeout(this._replayFadeTimer);
        this._replayFadeTimer = null;

        // 回放会话令牌：等待贴纸/照片期间可能被 _stopReplay + 再次 _startReplay 抢占，旧回调不得再启帧循环
        const session = (this._replaySession = (this._replaySession || 0) + 1);

        // 回放事件里用到的贴纸先开始加载（与照片背景并行）：本会话未进过自由画布时
        // FreeCanvas.stickerImages 为空，直接烤贴纸会全部画成 _drawStickerObj 的笑脸兜底圆
        const stickerIds = [];
        (replay.events || []).forEach(ev => {
            if (ev.o && ev.o.type === 'sticker' && ev.o.stickerId && stickerIds.indexOf(ev.o.stickerId) < 0) {
                stickerIds.push(ev.o.stickerId);
            }
        });
        const stickerReady = FreeCanvas._preloadStickersFor(stickerIds);

        // 回放画布叠到作品图上同尺寸（offset 系布局值，不受弹层 transform 影响）
        canvas.style.left = img.offsetLeft + 'px';
        canvas.style.top = img.offsetTop + 'px';
        canvas.style.width = img.offsetWidth + 'px';
        canvas.style.height = img.offsetHeight + 'px';
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(img.offsetWidth * dpr));
        canvas.height = Math.max(1, Math.round(img.offsetHeight * dpr));

        // 世界坐标（保存时画布）→ 视图：按全部事件包围盒 fit，内容居中充满
        const fit = this._replayFit(replay, canvas.width, canvas.height);
        this._replayScale = fit.scale;
        this._replayOx = fit.ox;
        this._replayOy = fit.oy;

        // ink 离屏层：已完成对象累积（常驻世界变换，橡皮 destination-out 直写）
        const ink = document.createElement('canvas');
        ink.width = canvas.width;
        ink.height = canvas.height;
        this._replayInk = ink;
        this._replayInkCtx = ink.getContext('2d');
        this._replayInkCtx.setTransform(fit.scale, 0, 0, fit.scale, fit.ox, fit.oy);

        this._replayPlaying = true;
        btn.disabled = true;
        btn.classList.add('replaying');
        img.style.visibility = 'hidden';
        canvas.hidden = false;
        canvas.style.opacity = '1';

        // 背景层：底色铺满（世界外兜底）+ 场景/照片画在世界矩形；photo 异步加载完再启帧循环
        const bg = replay.bg || {};
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = canvas.width;
        bgCanvas.height = canvas.height;
        this._replayBg = bgCanvas;
        const rw = replay.w || 1, rh = replay.h || 1;
        const drawBg = (photoImg) => {
            const bctx = bgCanvas.getContext('2d');
            bctx.fillStyle = bg.color || '#FFFFFF';
            bctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
            bctx.setTransform(fit.scale, 0, 0, fit.scale, fit.ox, fit.oy);
            bctx.fillRect(0, 0, rw, rh);
            if (bg.scene && FreeCanvas.scenes[bg.scene]) FreeCanvas._drawScene(bctx, rw, rh, bg.scene);
            if (photoImg) {
                const s = Math.max(rw / photoImg.width, rh / photoImg.height);
                const dw = photoImg.width * s, dh = photoImg.height * s;
                bctx.drawImage(photoImg, (rw - dw) / 2, (rh - dh) / 2, dw, dh);
            }
        };
        const start = () => {
            if (!this._replayPlaying || this._replaySession !== session) return;
            // 贴纸位图就位后再启帧循环（加载失败/超时也放行，失败贴纸维持笑脸兜底与画布内表现一致）
            stickerReady.then(() => {
                if (!this._replayPlaying || this._replaySession !== session) return;
                this._replayEvts = replay.events;
                this._replayIdx = 0;
                this._replayPtBase = 0;
                this._replayStart = performance.now();
                this._replayRaf = requestAnimationFrame(this._replayFrameBound);
            });
        };
        if (bg.photo) {
            const ph = new Image();
            ph.onload = () => { if (this._replayPlaying) { drawBg(ph); start(); } };
            ph.onerror = () => { if (this._replayPlaying) { drawBg(null); start(); } };
            ph.src = bg.photo;
        } else {
            drawBg(null);
            start();
        }
    },

    // 事件包围盒（笔画含对称副本、贴纸/图形含外接范围）→ 世界到视图的 fit 变换；异常退回整幅画布
    _replayFit(replay, vw, vh) {
        const rw = replay.w || 1, rh = replay.h || 1;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const expand = (x, y, r) => {
            if (x - r < minX) minX = x - r;
            if (y - r < minY) minY = y - r;
            if (x + r > maxX) maxX = x + r;
            if (y + r > maxY) maxY = y + r;
        };
        (replay.events || []).forEach(ev => {
            if (ev.k === 's' && ev.pts) {
                const rr = (ev.z || 8) * 1.3 + 6;
                const pts = ev.pts.map(p => ({ x: p[0], y: p[1] }));
                const copies = ev.sym
                    ? FreeCanvas._symCopies({ sym: ev.sym, cx: ev.cx, cy: ev.cy, points: pts })
                    : [pts];
                copies.forEach(cp => cp.forEach(p => expand(p.x, p.y, rr)));
            } else if (ev.o) {
                expand(ev.o.x, ev.o.y, (ev.o.size || 40) * 1.5 + 6);
            }
        });
        if (!isFinite(minX) || !(maxX > minX) || !(maxY > minY)) {
            minX = 0; minY = 0; maxX = rw; maxY = rh;
        }
        const scale = Math.min(vw / (maxX - minX), vh / (maxY - minY));
        return {
            scale: scale,
            ox: (vw - (maxX - minX) * scale) / 2 - minX * scale,
            oy: (vh - (maxY - minY) * scale) / 2 - minY * scale
        };
    },

    _replayStrokeObj(ev, pts) {
        return { brushType: ev.b, color: ev.c, size: ev.z, sym: ev.sym, cx: ev.cx, cy: ev.cy, points: pts };
    },

    // 到期事件整笔烤进 ink：笔画走 _drawStroke（含对称副本），贴纸/图形瞬间出现
    _replayBake(ev) {
        if (ev.k === 's' && ev.pts) {
            FreeCanvas._drawStroke(this._replayInkCtx, this._replayStrokeObj(ev, ev.pts.map(p => ({ x: p[0], y: p[1] }))));
        } else if (ev.o) {
            FreeCanvas._drawObj(this._replayInkCtx, ev.o);
        }
    },

    // 橡皮增量线段直写 ink（destination-out 不透明无叠加问题；对称副本同步擦）
    _replayErase(ev, upto) {
        if (upto <= this._replayPtBase || !ev.pts.length) return;
        const ptsSoFar = ev.pts.slice(0, upto).map(p => ({ x: p[0], y: p[1] }));
        const copies = ev.sym
            ? FreeCanvas._symCopies({ sym: ev.sym, cx: ev.cx, cy: ev.cy, points: ptsSoFar })
            : [ptsSoFar];
        const ctx = this._replayInkCtx;
        ctx.save();
        ctx.setTransform(this._replayScale, 0, 0, this._replayScale, this._replayOx, this._replayOy);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = ev.z;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (this._replayPtBase === 0) {
            copies.forEach(cp => {
                ctx.beginPath();
                ctx.arc(cp[0].x, cp[0].y, ev.z / 2, 0, Math.PI * 2);
                ctx.fill();
            });
            this._replayPtBase = 1;
        }
        while (this._replayPtBase < upto) {
            copies.forEach(cp => {
                const a = cp[this._replayPtBase - 1], b = cp[this._replayPtBase];
                if (!a || !b) return;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });
            this._replayPtBase++;
        }
        ctx.restore();
    },

    _replayFrame(now) {
        if (!this._replayPlaying) return;
        const canvas = document.getElementById('lightbox-replay-canvas');
        if (!canvas) { this._stopReplay(); return; }
        const evts = this._replayEvts;
        const t = (now - this._replayStart) * REPLAY_SPEED;

        // 已完成事件整笔烤进 ink（t 含笔画时长，整笔完成才入层）
        while (this._replayIdx < evts.length) {
            const ev = evts[this._replayIdx];
            const dur = (ev.k === 's' && ev.pts && ev.pts.length) ? ev.pts[ev.pts.length - 1][2] : 0;
            if (t < ev.t + dur) break;
            this._replayBake(ev);
            this._replayIdx++;
            this._replayPtBase = 0;
        }

        // 进行中事件先落层：普通笔画 live 切片待合成时画；橡皮增量直写 ink
        const ev = evts[this._replayIdx];
        let liveDraw = null;
        if (ev && ev.t <= t && ev.k === 's' && ev.pts && ev.pts.length) {
            const elapsed = t - ev.t;
            if (ev.b === 'eraser') {
                let upto = 1;
                while (upto < ev.pts.length && ev.pts[upto][2] <= elapsed) upto++;
                this._replayErase(ev, upto);
            } else {
                const slice = [{ x: ev.pts[0][0], y: ev.pts[0][1] }];
                for (let i = 1; i < ev.pts.length; i++) {
                    if (ev.pts[i][2] <= elapsed) slice.push({ x: ev.pts[i][0], y: ev.pts[i][1] });
                    else break;
                }
                liveDraw = this._replayStrokeObj(ev, slice);
            }
        }

        // 合成：bg → ink → live 当前笔切片
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this._replayBg, 0, 0);
        ctx.drawImage(this._replayInk, 0, 0);
        if (liveDraw) {
            ctx.setTransform(this._replayScale, 0, 0, this._replayScale, this._replayOx, this._replayOy);
            FreeCanvas._drawStroke(ctx, liveDraw);
        }

        if (this._replayIdx >= evts.length) {
            this._finishReplay();
            return;
        }
        this._replayRaf = requestAnimationFrame(this._replayFrameBound);
    },

    _finishReplay() {
        this._replayRaf = null;
        App.showToast('✨ 画完啦', 1600);
        const canvas = document.getElementById('lightbox-replay-canvas');
        if (canvas) canvas.style.opacity = '0'; // 淡出露出底下真实作品图（最终画面以 dataUrl 兑底）
        this._replayFadeTimer = setTimeout(() => this._stopReplay(), 700);
    },

    _stopReplay() {
        if (this._replayRaf) { cancelAnimationFrame(this._replayRaf); this._replayRaf = null; }
        clearTimeout(this._replayFadeTimer);
        this._replayFadeTimer = null;
        if (this._replayPlaying) {
            this._replayPlaying = false;
            const canvas = document.getElementById('lightbox-replay-canvas');
            if (canvas) { canvas.hidden = true; canvas.style.opacity = ''; }
            const img = document.getElementById('lightbox-img');
            if (img) img.style.visibility = '';
            const btn = document.getElementById('lightbox-replay');
            if (btn) { btn.disabled = false; btn.classList.remove('replaying'); }
        }
        this._replayEvts = null;
        this._replayBg = null;
        this._replayInk = null;
        this._replayInkCtx = null;
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
