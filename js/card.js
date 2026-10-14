// === 作品贺卡工坊 ===
// 从画廊预览进入：作品图 + 程序化贴纸风边框 + 祝福语 → 合成贺卡，可存回作品集或保存图片。
const CardMaker = {
    // 边框目录：label 面板用，draw 在 (0,0,w,h) 卡纸上绘制装饰
    frames: {
        confetti: { label: '🎂 彩旗', draw: CardFrame_confetti },
        love:     { label: '❤️ 爱心', draw: CardFrame_love },
        star:     { label: '⭐ 星空', draw: CardFrame_star },
        flower:   { label: '🌼 花环', draw: CardFrame_flower },
        snow:     { label: '⛄ 雪花', draw: CardFrame_snow }
    },

    greetings: ['生日快乐 🎂', '我爱你 ❤️', '母亲节快乐 🌷', '父亲节快乐 🎁', '教师节快乐 🌻', '新年快乐 🎆', '谢谢你 ⭐', '你好棒 👏', '不要文字'],

    frame: 'confetti',
    greeting: '生日快乐 🎂',
    img: null,        // 已加载的作品图
    _lastFrame: null, // chips 重建检测

    open(record) {
        if (!record) return;
        const img = new Image();
        img.onload = () => {
            this.img = img;
            this._renderChips();
            this.render();
            const panel = document.getElementById('card-panel');
            if (panel) panel.classList.add('open');
        };
        img.onerror = () => App.showToast('作品图加载失败');
        img.src = record.dataUrl;
    },

    _renderChips() {
        if (this._lastFrame === this.frame + '|' + this.greeting) return;
        this._lastFrame = this.frame + '|' + this.greeting;
        const fEl = document.getElementById('card-frames');
        fEl.innerHTML = '';
        Object.keys(this.frames).forEach(id => {
            const b = document.createElement('button');
            b.className = 'card-chip' + (id === this.frame ? ' active' : '');
            b.textContent = this.frames[id].label;
            b.onclick = () => { this.frame = id; this._renderChips(); this.render(); };
            fEl.appendChild(b);
        });
        const gEl = document.getElementById('card-greetings');
        gEl.innerHTML = '';
        this.greetings.forEach(g => {
            const b = document.createElement('button');
            b.className = 'card-chip' + (g === this.greeting ? ' active' : '');
            b.textContent = g;
            b.onclick = () => { this.greeting = g; this._renderChips(); this.render(); };
            gEl.appendChild(b);
        });
    },

    render() {
        const cv = document.getElementById('card-preview');
        if (!cv || !this.img) return;
        const out = this.compose(720, 960);
        cv.width = 720; cv.height = 960;
        cv.getContext('2d').drawImage(out, 0, 0);
    },

    // 合成完整贺卡（720×960 竖版）
    compose(w, h) {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');

        // 卡纸底色 + 淡波点纹理
        ctx.fillStyle = '#FFF8E7';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255, 214, 102, 0.18)';
        for (let y = 30; y < h; y += 44) {
            for (let x = ((y / 44) % 2) * 22 + 24; x < w; x += 44) {
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
            }
        }

        // 边框装饰
        (this.frames[this.frame] || this.frames.confetti).draw(ctx, w, h);

        // 作品图：居中圆角相框（正方形裁剪）
        const size = w - 190; // 550
        const ix = (w - size) / 2, iy = 108;
        const side = Math.min(this.img.naturalWidth, this.img.naturalHeight);
        const sx = (this.img.naturalWidth - side) / 2, sy = (this.img.naturalHeight - side) / 2;
        ctx.save();
        this._roundRect(ctx, ix - 14, iy - 14, size + 28, size + 28, 30);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(93, 64, 55, 0.25)';
        ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
        ctx.fill();
        ctx.restore();
        ctx.save();
        this._roundRect(ctx, ix, iy, size, size, 20);
        ctx.clip();
        ctx.drawImage(this.img, sx, sy, side, side, ix, iy, size, size);
        ctx.restore();

        // 祝福语
        if (this.greeting !== '不要文字') {
            ctx.save();
            ctx.font = 'bold 54px "ZCOOL KuaiLe", "Comic Sans MS", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const gy = iy + size + 78;
            ctx.fillStyle = '#5D4037';
            ctx.fillText(this.greeting, w / 2, gy);
            ctx.restore();
        }

        // 落款
        ctx.save();
        ctx.font = '26px "ZCOOL KuaiLe", "Comic Sans MS", sans-serif';
        ctx.fillStyle = '#BCAAA4';
        ctx.textAlign = 'right';
        ctx.fillText('画画乐园 ✨', w - 34, h - 30);
        ctx.restore();

        return cv;
    },

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },

    save() {
        if (!this.img) return;
        const record = ArtworkStore.save(this.compose(720, 960), { scene: 'card', name: '贺卡 ' + this.greeting.replace('不要文字', '') });
        if (record) {
            App.showToast('贺卡已存进作品集 🎀');
            if (typeof Missions !== 'undefined') Missions.bump('card');
        } else {
            App.showToast('保存失败，稍后再试');
        }
    },

    download() {
        if (!this.img) return;
        const cv = this.compose(720, 960);
        ArtworkStore.download({ dataUrl: cv.toDataURL('image/png'), name: '我的贺卡', createdAt: Date.now() });
        App.showToast('贺卡图片已保存 🎀');
    }
};

// === 边框绘制（贴纸风，均带深棕描边与 App 画风一致） ===

function CardFrame_confetti(ctx, w, h) {
    // 顶部彩旗串
    const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#74B9FF', '#FD79A8', '#A29BFE'];
    ctx.save();
    ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(20, 56); ctx.quadraticCurveTo(w / 2, 100, w - 20, 56); ctx.stroke();
    const n = 9;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const bx = 20 + (w - 40) * t;
        const by = 56 + Math.sin(Math.PI * t) * 30 + 8;
        ctx.fillStyle = colors[i % colors.length];
        ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx - 24, by); ctx.lineTo(bx + 24, by); ctx.lineTo(bx, by + 40);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 四周彩屑
    const rnd = (i) => { const x = Math.sin(i * 91.7) * 43758.5; return x - Math.floor(x); };
    for (let i = 0; i < 34; i++) {
        const side = i % 4;
        let cx, cy;
        if (side === 0) { cx = 30 + rnd(i) * (w - 60); cy = 130 + rnd(i + 50) * 26; }
        else if (side === 1) { cx = 30 + rnd(i) * (w - 60); cy = h - 130 + rnd(i + 50) * 26; }
        else if (side === 2) { cx = 20 + rnd(i) * 26; cy = 130 + rnd(i + 50) * (h - 260); }
        else { cx = w - 46 + rnd(i) * 26; cy = 130 + rnd(i + 50) * (h - 260); }
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(rnd(i + 99) * Math.PI);
        ctx.fillStyle = colors[(i + 2) % colors.length];
        ctx.fillRect(-5, -8, 10, 16);
        ctx.restore();
    }
    ctx.restore();
}

function CardFrame_love(ctx, w, h) {
    const heart = (cx, cy, s, fill) => {
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(s / 24, s / 24);
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.bezierCurveTo(-2, 2, -12, -2, -12, -10);
        ctx.bezierCurveTo(-12, -18, -4, -20, 0, -13);
        ctx.bezierCurveTo(4, -20, 12, -18, 12, -10);
        ctx.bezierCurveTo(12, -2, 2, 2, 0, 8);
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    };
    const corners = [[70, 88, 44], [w - 70, 88, 44], [70, h - 96, 44], [w - 70, h - 96, 44]];
    corners.forEach(([x, y, s]) => heart(x, y, s, '#FF6B6B'));
    const rnd = (i) => { const x = Math.sin(i * 127.3) * 19933.1; return x - Math.floor(x); };
    for (let i = 0; i < 22; i++) {
        const side = i % 4;
        const x = side < 2 ? 28 + rnd(i) * 34 : w - 34 - rnd(i) * 34;
        const y = side % 2 === 0 ? 120 + rnd(i + 40) * (h - 240) : 120 + rnd(i + 70) * (h - 240);
        heart(x, y, 13 + rnd(i + 9) * 10, i % 3 === 0 ? '#FFB6C1' : '#FFD1DC');
    }
}

function CardFrame_star(ctx, w, h) {
    const star5 = (cx, cy, r, fill) => {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = i * Math.PI / 5 - Math.PI / 2;
            const rr = i % 2 === 0 ? r : r * 0.45;
            const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    };
    const corners = [[66, 84, 38], [w - 66, 84, 38], [66, h - 92, 38], [w - 66, h - 92, 38]];
    corners.forEach(([x, y, r]) => star5(x, y, r, '#FFD93D'));
    const rnd = (i) => { const x = Math.sin(i * 211.9) * 12543.7; return x - Math.floor(x); };
    for (let i = 0; i < 20; i++) {
        const side = i % 4;
        const x = side < 2 ? 30 + rnd(i) * 30 : w - 30 - rnd(i) * 30;
        const y = 130 + rnd(i + 33) * (h - 250);
        star5(x, y, 8 + rnd(i + 7) * 9, i % 4 === 0 ? '#FFE9A0' : '#FFC94D');
    }
    // 一颗流星
    ctx.save();
    ctx.strokeStyle = '#FFD93D'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w - 140, 140); ctx.lineTo(w - 88, 192); ctx.stroke();
    star5(w - 82, 198, 18, '#FFD93D');
    ctx.restore();
}

function CardFrame_flower(ctx, w, h) {
    const flower = (cx, cy, r, petal, center) => {
        ctx.save();
        for (let p = 0; p < 5; p++) {
            const a = p / 5 * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.62, 0, Math.PI * 2);
            ctx.fillStyle = petal; ctx.fill();
            ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 1.6; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = center; ctx.fill();
        ctx.strokeStyle = '#5D4037'; ctx.stroke();
        ctx.restore();
    };
    const petals = ['#FD79A8', '#FFB347', '#C77DFF'];
    const centers = ['#FFE066', '#FF6B6B', '#FFE066'];
    // 四角大花
    [[74, 92, 30], [w - 74, 92, 30], [74, h - 100, 30], [w - 74, h - 100, 30]].forEach(([x, y, r], i) => flower(x, y, r, petals[i % 3], centers[i % 3]));
    // 四边花链
    const step = 108;
    for (let x = 74 + step; x < w - 90; x += step) {
        flower(x, 74, 15, '#FF8FAB', '#FFE066');
        flower(x, h - 78, 15, '#FF8FAB', '#FFE066');
    }
    for (let y = 92 + step; y < h - 110; y += step) {
        flower(56, y, 15, '#FFB347', '#FFE066');
        flower(w - 56, y, 15, '#FFB347', '#FFE066');
    }
    // 小叶子点缀
    const leaf = (x, y, rot) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 5.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#81C784'; ctx.fill();
        ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
    };
    leaf(130, 84, 0.4); leaf(w - 130, 84, -0.4);
    leaf(130, h - 86, -0.4); leaf(w - 130, h - 86, 0.4);
}

function CardFrame_snow(ctx, w, h) {
    const flake = (cx, cy, r, color) => {
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r * 0.16); ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
            ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
            const bx = cx + dx * 0.62, by = cy + dy * 0.62;
            const tx = cx + dx, ty = cy + dy;
            [[0.6, -0.35], [0.6, 0.35]].forEach(([u, v]) => {
                const px = bx + (tx - bx) * u - (ty - by) * v;
                const py = by + (ty - by) * u + (tx - bx) * v;
                ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(px, py); ctx.stroke();
            });
        }
        ctx.restore();
    };
    const corners = [[70, 86, 32], [w - 70, 86, 32], [70, h - 94, 32], [w - 70, h - 94, 32]];
    corners.forEach(([x, y, r]) => flake(x, y, r, '#74B9FF'));
    const rnd = (i) => { const x = Math.sin(i * 173.1) * 31337.7; return x - Math.floor(x); };
    for (let i = 0; i < 18; i++) {
        const side = i % 4;
        const x = side < 2 ? 32 + rnd(i) * 28 : w - 32 - rnd(i) * 28;
        const y = 130 + rnd(i + 21) * (h - 250);
        flake(x, y, 7 + rnd(i + 5) * 8, i % 3 === 0 ? '#A29BFE' : '#9BD7FF');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('card-save');
    if (saveBtn) saveBtn.addEventListener('click', () => CardMaker.save());
    const dlBtn = document.getElementById('card-download');
    if (dlBtn) dlBtn.addEventListener('click', () => CardMaker.download());
    const panel = document.getElementById('card-panel');
    if (panel) {
        panel.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => panel.classList.remove('open'));
        });
    }
});
