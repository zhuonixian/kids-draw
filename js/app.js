// === 应用主控 ===
const App = {
    currentScene: 'home',
    scenes: ['home', 'tracing', 'freecanvas'],
    audioCtx: null,
    _lastDrawSound: 0,
    _audioUnlocked: false,

    init() {
        this.preventGestures();
        this.bindAudioUnlock();
        this.bindHomeButtons();
    },

    // 场景切换
    showScene(name) {
        this.scenes.forEach(id => {
            const el = document.getElementById(id);
            if (id === name) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        this.currentScene = name;

        // 触发场景激活回调
        if (name === 'tracing') {
            if (typeof Tracing !== 'undefined') Tracing.onEnter();
        } else if (name === 'freecanvas') {
            if (typeof FreeCanvas !== 'undefined') FreeCanvas.onEnter();
        }
    },

    bindAudioUnlock() {
        const unlock = () => this.unlockAudio();
        document.addEventListener('touchstart', unlock, { passive: true });
        document.addEventListener('pointerdown', unlock, { passive: true });
    },

    // 绑定首页按钮
    bindHomeButtons() {
        document.getElementById('btn-tracing').addEventListener('click', () => {
            this.showScene('tracing');
        });
        document.getElementById('btn-freecanvas').addEventListener('click', () => {
            this.showScene('freecanvas');
        });
    },

    // 禁止浏览器默认手势
    preventGestures() {
        // 禁止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        // 禁止 pinch 缩放
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        // 禁止右键菜单
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    // 长按检测工具
    longPress(element, callback, duration = 1000) {
        let timer = null;
        let triggered = false;

        const start = (e) => {
            triggered = false;
            timer = setTimeout(() => {
                triggered = true;
                callback(e);
            }, duration);
        };

        const cancel = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('touchend', (e) => {
            cancel();
            if (!triggered) e.preventDefault();
        });
        element.addEventListener('touchmove', cancel, { passive: true });
        element.addEventListener('mousedown', start);
        element.addEventListener('mouseup', cancel);
        element.addEventListener('mouseleave', cancel);
    },

    // 播放鼓励音效
    playCelebrateSound() {
        try {
            const ctx = this._getAudioCtx();
            const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.15);
                osc.stop(ctx.currentTime + i * 0.15 + 0.4);
            });
        } catch (e) {
            // 静默失败，音效不是必须的
        }
    },

    _getAudioCtx() {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        return this.audioCtx;
    },

    unlockAudio() {
        if (this._audioUnlocked) return;
        try {
            const ctx = this._getAudioCtx();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001;
            const osc = ctx.createOscillator();
            osc.frequency.value = 440;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.02);
            this._audioUnlocked = true;
        } catch (e) {
            // 等下一次用户手势再试。
        }
    },

    _tone(freq, duration = 0.08, type = 'sine', volume = 0.12, delay = 0) {
        try {
            const ctx = this._getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + duration);
        } catch (e) {
            // 音效失败不影响绘画。
        }
    },

    _noise(duration = 0.055, volume = 0.12) {
        try {
            const ctx = this._getAudioCtx();
            const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
            const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < frameCount; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
            const source = ctx.createBufferSource();
            const filter = ctx.createBiquadFilter();
            const gain = ctx.createGain();
            filter.type = 'bandpass';
            filter.frequency.value = 900;
            filter.Q.value = 0.8;
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            source.buffer = buffer;
            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            source.start();
        } catch (e) {
            // 音效失败不影响绘画。
        }
    },

    playDrawSound() {
        const now = Date.now();
        if (now - this._lastDrawSound < 70) return;
        this._lastDrawSound = now;
        this._noise(0.05, 0.11);
        this._tone(260 + Math.random() * 90, 0.035, 'triangle', 0.045);
    },

    playStickerSound() {
        this._tone(392, 0.055, 'sine', 0.12);
        this._tone(784, 0.11, 'sine', 0.10, 0.045);
    },

    playFillSound() {
        this._tone(523, 0.06, 'sine', 0.10);
        this._tone(659, 0.08, 'sine', 0.09, 0.04);
    },

    // 庆祝动画（撒花/星星）
    celebrate() {
        this.playCelebrateSound();
        const container = document.getElementById('celebration');
        container.classList.add('active');
        const emojis = ['⭐', '🌟', '✨', '💫', '🎉', '🎊', '❤️', '🌈'];
        for (let i = 0; i < 30; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            star.style.left = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 0.8 + 's';
            star.style.fontSize = (1.2 + Math.random() * 1.5) + 'rem';
            container.appendChild(star);
        }
        setTimeout(() => {
            container.innerHTML = '';
            container.classList.remove('active');
        }, 2500);
    }
};

// 蜡笔色盘配置 - 鲜艳、饱和、像真实蜡笔
const COLORS = [
    { name: '红', hex: '#FF6B6B' },
    { name: '橙', hex: '#FFA36C' },
    { name: '黄', hex: '#FFD93D' },
    { name: '绿', hex: '#6BCB77' },
    { name: '蓝', hex: '#74B9FF' },
    { name: '紫', hex: '#A29BFE' },
    { name: '粉', hex: '#FD79A8' },
    { name: '棕', hex: '#C08552' }
];

// 创建颜色选择器
function createColorPicker(containerId, onSelect) {
    const container = document.getElementById(containerId);
    COLORS.forEach((color, i) => {
        const dot = document.createElement('div');
        dot.className = 'color-dot' + (i === 0 ? ' active' : '');
        dot.style.backgroundColor = color.hex;
        dot.dataset.color = color.hex;
        dot.addEventListener('click', () => {
            container.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            if (onSelect) onSelect(color.hex);
        });
        container.appendChild(dot);
    });
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
