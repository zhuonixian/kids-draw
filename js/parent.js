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

        // 语音引导开关：不识字的孩子靠它听懂提示
        document.getElementById('parent-voice').addEventListener('click', () => {
            const v = !Settings.get('voice', true);
            Settings.set('voice', v);
            if (typeof App !== 'undefined') App.voiceEnabled = v;
            if (v && typeof App !== 'undefined' && App.say) App.say('语音引导已开启');
            this._syncToggles();
        });

        // 宝贝名字：保存即重建名字描红形状序列
        const nameInput = document.getElementById('parent-child-name');
        if (nameInput) {
            nameInput.addEventListener('change', () => this._saveChildName(nameInput));
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
            });
        }

        // 重看新手引导
        const guideBtn = document.getElementById('parent-guide');
        if (guideBtn) guideBtn.addEventListener('click', () => {
            App.showScene('home');
            setTimeout(() => App.showGuide(true), 300);
        });

        // 关于与隐私
        const privacyBtn = document.getElementById('parent-privacy');
        if (privacyBtn) privacyBtn.addEventListener('click', () => this._showPrivacy());
        const privacyClose = document.getElementById('privacy-close');
        if (privacyClose) privacyClose.addEventListener('click', () => this._hidePrivacy());
        const privacyOverlay = document.getElementById('privacy-overlay');
        if (privacyOverlay) privacyOverlay.addEventListener('click', (e) => {
            if (e.target === privacyOverlay) this._hidePrivacy();
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
            ArtworkStore.clear();
            App.showToast('作品集已清空');
        });
        this._bindDanger('parent-reset-progress', () => {
            ShapeProgress.reset();
            App.showToast('收集进度已重置');
        });

        // 备份全部作品：打包 ZIP 下载到设备
        const backupBtn = document.getElementById('parent-backup');
        if (backupBtn) backupBtn.addEventListener('click', () => this._exportBackup(backupBtn));

        // 从备份恢复：选 ZIP 导入作品（换机/网页版迁移到 APK 的通道）
        const importBtn = document.getElementById('parent-import');
        if (importBtn) importBtn.addEventListener('click', () => {
            const picker = document.getElementById('parent-import-file');
            if (picker) { picker.value = ''; picker.click(); }
        });
        const importPicker = document.getElementById('parent-import-file');
        if (importPicker) importPicker.addEventListener('change', () => this._importBackup(importPicker, importBtn));

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
            const nameInput = document.getElementById('parent-child-name');
            if (nameInput) nameInput.value = Settings.get('childName', '');
            this._renderReport();
            this._syncToggles();
        } else {
            App.showToast('答错了，再试试');
            this._newQuestion();
        }
    },

    // 保存宝贝名字：只留中日韩文字/字母（数字与符号对描红无意义），字库未收录字在重建时自动跳过
    _saveChildName(input) {
        const raw = input.value || '';
        const clean = raw.replace(/[^\u4e00-\u9fff\u3400-\u4dbfA-Za-z]/g, '').slice(0, 6);
        if (clean !== raw) input.value = clean;
        const prev = Settings.get('childName', '');
        if (clean === prev) return;
        Settings.set('childName', clean);
        const apply = () => {
            if (typeof rebuildNameShapes !== 'undefined') {
                const seq = rebuildNameShapes(clean);
                if (clean && !seq.length) {
                    App.showToast('名字已保存，但笔画库暂未收录这些字');
                } else if (seq.length) {
                    App.showToast('已生成 ' + seq.length + ' 个名字描红字 ✍️');
                    if (typeof Tracing !== 'undefined') Tracing._shapePickerCat = 'name';
                } else {
                    App.showToast('名字已清空');
                }
            }
        };
        if (typeof HanziData !== 'undefined' && HanziData.data) apply();
        else if (typeof HanziData !== 'undefined') HanziData.load().then(apply);
        else apply();
    },

    _showPrivacy() {
        const overlay = document.getElementById('privacy-overlay');
        if (!overlay) return;
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
    },

    _hidePrivacy() {
        const overlay = document.getElementById('privacy-overlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
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
        const voiceOn = (typeof App !== 'undefined' && typeof App.voiceEnabled === 'boolean')
            ? App.voiceEnabled
            : Settings.get('voice', true);
        const restOn = Settings.get('rest', true);
        const sound = document.getElementById('parent-sound');
        const voice = document.getElementById('parent-voice');
        const rest = document.getElementById('parent-rest');
        sound.classList.toggle('on', soundOn);
        sound.setAttribute('aria-checked', String(soundOn));
        if (voice) {
            voice.classList.toggle('on', voiceOn);
            voice.setAttribute('aria-checked', String(voiceOn));
        }
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

    // 选中的 ZIP → 导入画廊；完成后按结果提示（恢复数/跳过数/失败原因）
    _importBackup(picker, btn) {
        const file = picker.files && picker.files[0];
        if (!file || (btn && btn.disabled)) return;
        if (btn) { btn.disabled = true; btn.textContent = '恢复中…'; }
        ArtworkStore.importZip(file).then(res => {
            if (res.count) {
                App.showToast('已恢复 ' + res.count + ' 幅作品'
                    + (res.skipped ? '，跳过 ' + res.skipped + ' 幅已存在' : ''));
            } else {
                App.showToast('备份里的作品都已存在，无需恢复');
            }
        }).catch(err => {
            const msg = err && err.message;
            App.showToast(msg === 'notzip' ? '这不是有效的备份包'
                : (msg === 'notours' ? '仅支持画画乐园的备份包'
                : (msg === 'compressed' ? '备份包格式异常，请用「备份全部作品」重新导出'
                : '恢复失败，请重试')));
        }).then(() => {
            if (btn) { btn.disabled = false; btn.textContent = '从备份恢复'; }
        });
    },

    // 打包导出全部作品；过程中按钮置忙，避免重复点击触发多个下载
    _exportBackup(btn) {
        if (btn.disabled) return;
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = '打包中…';
        ArtworkStore.exportAll().then(res => {
            const mb = (res.bytes / 1024 / 1024).toFixed(1);
            App.showToast('已导出 ' + res.count + ' 幅作品（' + mb + 'MB）');
        }).catch(err => {
            App.showToast(err && err.message === 'empty' ? '还没有作品可导出' : '导出失败，请重试');
        }).then(() => {
            btn.disabled = false;
            btn.textContent = label;
        });
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
