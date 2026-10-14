// === 家长中心：算术门 + 音效/护眼/数据管理 ===
const ParentZone = {
    _answer: 0,
    _input: '',
    _unlocked: false,
    _playSeconds: 0,      // 护眼计时累计（秒）
    _restTimer: null,     // 护眼累计计时器
    _countdownTimer: null,// 休息倒计时计时器

    init() {
        // 首页入口：长按 800ms 才进入，避免小朋友误触
        App.longPress(document.getElementById('btn-parent'), () => App.showScene('parent'), 800);
        document.getElementById('parent-back').addEventListener('click', () => App.showScene('home'));

        // 算术门键盘（动态生成，补 aria-label）
        const keys = document.getElementById('parent-gate-keys');
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach(k => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'parent-key';
            btn.dataset.key = k;
            btn.textContent = k === 'del' ? '⌫' : (k === 'ok' ? 'OK' : k);
            btn.setAttribute('aria-label', k === 'del' ? '删除' : (k === 'ok' ? '确认' : '数字' + k));
            btn.addEventListener('click', () => this._pressKey(k));
            keys.appendChild(btn);
        });

        // 音效开关：翻转运行时状态 + 持久化
        document.getElementById('parent-sound').addEventListener('click', () => {
            const v = !App.soundEnabled;
            App.soundEnabled = v;
            Settings.set('sound', v);
            this._syncToggles();
        });

        // 护眼开关：关闭时收起浮层、清零累计，重新计时
        document.getElementById('parent-rest').addEventListener('click', () => {
            const v = !Settings.get('rest', true);
            Settings.set('rest', v);
            if (!v) {
                this._hideRest();
                this._playSeconds = 0;
            }
            this._syncToggles();
        });

        // 危险操作：两段确认
        this._bindDanger('parent-clear-gallery', () => {
            ArtworkStore.list().forEach(r => ArtworkStore.remove(r.id));
            App.showToast('作品集已清空');
        });
        this._bindDanger('parent-reset-progress', () => {
            ShapeProgress.reset();
            App.showToast('收集进度已重置');
        });

        this._startRestTimer();
    },

    // 每次进入都回到"未解锁"，防止退出后小朋友直接翻进来
    onEnter() {
        this._unlocked = false;
        document.getElementById('parent-gate').hidden = false;
        const panel = document.getElementById('parent-panel');
        panel.hidden = true;
        // .parent-panel 的 display:flex 会覆盖 [hidden] 的 UA 样式，补内联兜底
        panel.style.display = 'none';
        this._newQuestion();
    },

    // 出题：两个 2-9 随机数相加
    _newQuestion() {
        const a = 2 + Math.floor(Math.random() * 8);
        const b = 2 + Math.floor(Math.random() * 8);
        this._answer = a + b;
        this._input = '';
        document.getElementById('parent-gate-q').textContent = a + ' + ' + b + ' = ?';
        document.getElementById('parent-gate-input').innerHTML = '&nbsp;';
    },

    _pressKey(k) {
        if (k === 'ok') {
            this._check();
            return;
        }
        if (k === 'del') {
            this._input = this._input.slice(0, -1);
        } else if (this._input.length < 2) {
            this._input += k;
        }
        document.getElementById('parent-gate-input').textContent = this._input || '\u00A0';
    },

    _check() {
        if (parseInt(this._input, 10) === this._answer) {
            this._unlocked = true;
            document.getElementById('parent-gate').hidden = true;
            const panel = document.getElementById('parent-panel');
            panel.hidden = false;
            panel.style.display = '';
            this._renderReport();
            this._syncToggles();
        } else {
            App.showToast('答错了，再试试');
            this._newQuestion();
        }
    },

    // 创作小报告：本地数据聚合，让家长看到孩子的成长记录
    _renderReport() {
        const el = document.getElementById('parent-report');
        if (!el) return;
        const artworks = ArtworkStore.list().length;
        const traced = ShapeProgress.completedCount();
        const missionsDone = (typeof Missions !== 'undefined') ? Missions.state.done.length : 0;
        const missionsTotal = (typeof Missions !== 'undefined') ? Missions.list.length : 0;
        el.innerHTML = `
            <div class="report-title">🎨 宝贝的创作小报告</div>
            <div class="report-grid">
                <div class="report-cell"><b>${artworks}</b><span>保存的作品</span></div>
                <div class="report-cell"><b>${traced}</b><span>描红完成</span></div>
                <div class="report-cell"><b>${missionsDone}<i>/${missionsTotal}</i></b><span>小任务达成</span></div>
            </div>`;
    },

    // 从 Settings 读取开关状态，同步滑块样式与 aria-checked
    _syncToggles() {
        const soundOn = (typeof App !== 'undefined' && typeof App.soundEnabled === 'boolean')
            ? App.soundEnabled
            : Settings.get('sound', true);
        const restOn = Settings.get('rest', true);
        const sound = document.getElementById('parent-sound');
        const rest = document.getElementById('parent-rest');
        sound.classList.toggle('on', soundOn);
        sound.setAttribute('aria-checked', String(soundOn));
        rest.classList.toggle('on', restOn);
        rest.setAttribute('aria-checked', String(restOn));
    },

    // 护眼计时：每秒累计，满 20 分钟且开关打开时弹休息层
    _startRestTimer() {
        this._restTimer = setInterval(() => {
            this._playSeconds++;
            const overlay = document.getElementById('rest-overlay');
            if (this._playSeconds >= 20 * 60
                && Settings.get('rest', true)
                && !overlay.classList.contains('open')) {
                this._playSeconds = 0;
                this._showRest();
            }
        }, 1000);
    },

    // 显示 20 秒休息倒计时，到 0 自动收起
    _showRest() {
        const overlay = document.getElementById('rest-overlay');
        const num = document.getElementById('rest-countdown');
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        let n = 20;
        num.textContent = n;
        clearInterval(this._countdownTimer);
        this._countdownTimer = setInterval(() => {
            n--;
            if (n <= 0) {
                this._hideRest();
                return;
            }
            num.textContent = n;
        }, 1000);
    },

    _hideRest() {
        const overlay = document.getElementById('rest-overlay');
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        clearInterval(this._countdownTimer);
        this._countdownTimer = null;
    },

    // 危险操作通用绑定：首点变「确认？」+ 警示样式，2.5s 未确认还原
    _bindDanger(id, action) {
        const btn = document.getElementById(id);
        const label = btn.textContent;
        let timer = null;
        const reset = () => {
            btn.dataset.confirm = '';
            btn.textContent = label;
            btn.style.background = '';
            btn.style.color = '';
        };
        btn.addEventListener('click', () => {
            if (btn.dataset.confirm === '1') {
                clearTimeout(timer);
                reset();
                action();
            } else {
                btn.dataset.confirm = '1';
                btn.textContent = '确认？';
                // 内联警示样式（不改 CSS 文件）
                btn.style.background = '#D32F2F';
                btn.style.color = '#fff';
                timer = setTimeout(reset, 2500);
            }
        });
    },
};

document.addEventListener('DOMContentLoaded', () => ParentZone.init());
