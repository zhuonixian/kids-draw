# 安卓壳（Capacitor）

把主仓库的纯静态 Web 应用打进 APK：资源全部随包分发，**完全离线**，不依赖 Cloudflare Pages。
主仓库根目录保持零依赖零构建，所有安卓相关内容都在本目录。

## 目录结构

```
android-app/
├── package.json          # Capacitor 依赖（独立于主仓库）
├── capacitor.config.ts   # appId / appName / webDir
├── env.sh                # JAVA_HOME / ANDROID_HOME（构建前 source）
├── sync-web.sh           # 主仓库资源 → www/（排除 sw.js/manifest.json，注入 native-bridge.js）
├── native-bridge.js      # 返回键拦截（非首页先回首页）+ 状态栏配色，仅 APK 内生效
├── assets/               # 图标源图（capacitor-assets 用）
├── android/              # Gradle 工程（cap add android 生成，已入库）
├── keystore/             # 签名密钥（不入库！）keystore.properties 同级亦不入库
└── www/                  # sync-web.sh 生成（不入库）
```

## 环境要求（一次性安装）

- JDK 21（本机装在 `~/tools/jdk-21`，Temurin）
- Android SDK（本机在 `~/Android/Sdk`：platform-tools、platforms;android-35、build-tools）

## 常用命令

```bash
source env.sh
npm run build:debug     # 同步 www + gradle debug 包（试用）
npm run build:release   # 同步 www + gradle 正式签名包
```

产物：`android/app/build/outputs/apk/{debug,release}/`。

## 首次配置（已完成则跳过）

```bash
npm install
./sync-web.sh
npx cap add android
npx capacitor-assets generate --android          # 由 assets/logo.png 生成各密度图标
# 签名密钥（一次性，见下节）
```

## 签名纪律（重要）

- **同一签名才能覆盖升级**：手机上已装的 APK，后续更新必须用同一把 keystore 签名，否则只能卸载重装（WebView 数据会清空，孩子作品丢失）。
- keystore 与密码**务必离线备份**（网盘/密码管理器各一份）。丢失 = 永远无法给已装用户推更新。
- 密钥位置：`keystore/kidsdraw-release.jks` + `keystore.properties`（含密码，两者都已被 .gitignore 排除）。
- CI（.github/workflows/android.yml）只出 **debug** 包，密钥永不上传。

## 版本升级流程

1. 主仓库改完代码并提交
2. 改 `android/app/build.gradle` 的 `versionCode`（+1）与 `versionName`
3. `npm run build:release` 出新包，发给手机覆盖安装

## 数据说明

APK 的 WebView 存储与浏览器完全隔离。孩子在网页版/主屏 PWA 里的作品，
用家长中心「备份全部作品 (ZIP)」导出，再在 APK 里「从备份恢复」导入。
