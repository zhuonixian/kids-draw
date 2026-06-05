# 画画乐园

一个专为儿童设计的趣味绘画 Web 应用，支持描边填色和自由画布两种模式，内置丰富的卡通贴纸和创意画笔。

## 功能特色

### 描边填色
- 沿着虚线描绘形状轮廓
- 完成后触发庆祝动画
- 多种颜色可选

### 自由画布
- **8 种创意画笔**：彩笔、马克笔、毛笔、荧光笔、彩虹笔、喷雾、发光笔、虚线笔
- **13 类贴纸主题**：伙伴、萌鸡、童话、玩具、甜点、海洋、恐龙、太空、音乐、水果、天气、运动、节日
- **贴纸支持小/中/大三种尺寸**
- **形状绘制**：三角形、圆形、方形等基本图形
- **橡皮擦 & 填充工具**
- **画布底色切换**
- **可拖动画布**

## 技术栈

- 纯前端实现：HTML5 Canvas + CSS3 + Vanilla JavaScript
- Node.js 静态文件服务器（可选，用于局域网访问）
- SVG 矢量贴纸，缩放不失真
- 响应式设计，适配 iPad / 触屏设备

## 快速开始

### 方式一：直接打开

双击 `index.html` 即可在浏览器中使用。

### 方式二：本地服务器（推荐用于 iPad）

```bash
# 启动服务
./kids-draw.sh start

# 查看状态
./kids-draw.sh status

# 停止服务
./kids-draw.sh stop

# 重启服务
./kids-draw.sh restart
```

启动后访问 `http://localhost:3000`，iPad 等设备通过 `http://<本机IP>:3000` 访问。

## 项目结构

```
kids-draw/
├── index.html          # 主页面
├── server.js           # Node.js 静态文件服务器
├── kids-draw.sh        # 服务启停脚本
├── css/
│   └── style.css       # 样式
├── js/
│   ├── app.js          # 应用入口 & 场景管理
│   ├── tracing.js      # 描边填色模块
│   ├── freecanvas.js   # 自由画布模块
│   ├── shapes.js       # 描边形状定义
│   └── stickers.js     # 贴纸数据
├── assets/
│   └── sounds/         # 音效资源
└── tests/
    └── behavior.test.js
```

## 运行环境

- 现代浏览器（Chrome / Safari / Firefox）
- Node.js >= 12（仅服务器模式需要）

## License

MIT
