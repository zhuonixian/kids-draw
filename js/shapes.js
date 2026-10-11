// === 图形定义 ===
// 每个图形包含路径绘制函数和描边起点
// 路径使用归一化坐标 (0-1)，运行时按 Canvas 尺寸缩放

const Shapes = [
    // === 难度 1: 基础图形 ===
    {
        name: '圆形',
        category: 'basic',
        level: 1,
        // 生成路径采样点
        getPoints(cx, cy, size) {
            const r = size * 0.38;
            const points = [];
            const steps = 60;
            for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2 - Math.PI / 2;
                points.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }
            return points;
        },
        // 绘制填充路径（闭合）
        drawFillPath(ctx, cx, cy, size) {
            const r = size * 0.38;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.closePath();
        },
        // 检查点是否在图形内
        isInside(x, y, cx, cy, size) {
            const r = size * 0.38;
            const dx = x - cx;
            const dy = y - cy;
            return dx * dx + dy * dy <= r * r;
        }
    },
    {
        name: '正方形',
        category: 'basic',
        level: 1,
        getPoints(cx, cy, size) {
            const half = size * 0.32;
            const l = cx - half, t = cy - half, r = cx + half, b = cy + half;
            const pts = [];
            const seg = 15;
            // 上边
            for (let i = 0; i <= seg; i++) pts.push({ x: l + (r - l) * i / seg, y: t });
            // 右边
            for (let i = 0; i <= seg; i++) pts.push({ x: r, y: t + (b - t) * i / seg });
            // 下边
            for (let i = 0; i <= seg; i++) pts.push({ x: r - (r - l) * i / seg, y: b });
            // 左边
            for (let i = 0; i <= seg; i++) pts.push({ x: l, y: b - (b - t) * i / seg });
            return pts;
        },
        drawFillPath(ctx, cx, cy, size) {
            const half = size * 0.32;
            ctx.beginPath();
            ctx.rect(cx - half, cy - half, half * 2, half * 2);
            ctx.closePath();
        },
        isInside(x, y, cx, cy, size) {
            const half = size * 0.32;
            return x >= cx - half && x <= cx + half && y >= cy - half && y <= cy + half;
        }
    },
    {
        name: '三角形',
        category: 'basic',
        level: 1,
        getPoints(cx, cy, size) {
            const r = size * 0.38;
            const pts = [];
            const seg = 15;
            // 等边三角形顶点（顶点朝上）
            const vertices = [];
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                vertices.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }
            // 三条边
            for (let e = 0; e < 3; e++) {
                const a = vertices[e];
                const b = vertices[(e + 1) % 3];
                for (let i = 0; i <= seg; i++) {
                    pts.push({
                        x: a.x + (b.x - a.x) * i / seg,
                        y: a.y + (b.y - a.y) * i / seg
                    });
                }
            }
            return pts;
        },
        drawFillPath(ctx, cx, cy, size) {
            const r = size * 0.38;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        },
        isInside(x, y, cx, cy, size) {
            const r = size * 0.38;
            const vertices = [];
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                vertices.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }
            return pointInTriangle(x, y, vertices[0], vertices[1], vertices[2]);
        }
    },

    // === 难度 2: 进阶图形 ===
    {
        name: '星形',
        category: 'basic',
        level: 2,
        getPoints(cx, cy, size) {
            const outerR = size * 0.38;
            const innerR = size * 0.17;
            const pts = [];
            const steps = 10; // 五角星有 10 个顶点
            const seg = 8;
            for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? outerR : innerR;
                pts.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }
            // 插值增加采样点
            return interpolatePoints(pts, seg);
        },
        drawFillPath(ctx, cx, cy, size) {
            const outerR = size * 0.38;
            const innerR = size * 0.17;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? outerR : innerR;
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        },
        isInside(x, y, cx, cy, size) {
            const outerR = size * 0.38;
            const innerR = size * 0.17;
            const vertices = [];
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? outerR : innerR;
                vertices.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }
            return pointInPolygon(x, y, vertices);
        }
    },
    {
        name: '心形',
        category: 'basic',
        level: 2,
        getPoints(cx, cy, size) {
            const s = size * 0.018;
            const pts = [];
            const steps = 60;
            for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * Math.PI * 2;
                const x = cx + s * 16 * Math.pow(Math.sin(t), 3);
                const y = cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                pts.push({ x, y });
            }
            return pts;
        },
        drawFillPath(ctx, cx, cy, size) {
            const s = size * 0.018;
            ctx.beginPath();
            const steps = 60;
            for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * Math.PI * 2;
                const x = cx + s * 16 * Math.pow(Math.sin(t), 3);
                const y = cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        },
        isInside(x, y, cx, cy, size) {
            // 用离屏 Canvas 做像素级检测
            return false; // tracing.js 中会覆盖
        },
        usePixelHitTest: true
    },
    {
        name: '菱形',
        category: 'basic',
        level: 2,
        getPoints(cx, cy, size) {
            const hw = size * 0.28;
            const hh = size * 0.38;
            const vertices = [
                { x: cx, y: cy - hh },      // 上
                { x: cx + hw, y: cy },       // 右
                { x: cx, y: cy + hh },       // 下
                { x: cx - hw, y: cy }        // 左
            ];
            const pts = [];
            const seg = 15;
            for (let e = 0; e < 4; e++) {
                const a = vertices[e];
                const b = vertices[(e + 1) % 4];
                for (let i = 0; i <= seg; i++) {
                    pts.push({
                        x: a.x + (b.x - a.x) * i / seg,
                        y: a.y + (b.y - a.y) * i / seg
                    });
                }
            }
            return pts;
        },
        drawFillPath(ctx, cx, cy, size) {
            const hw = size * 0.28;
            const hh = size * 0.38;
            ctx.beginPath();
            ctx.moveTo(cx, cy - hh);
            ctx.lineTo(cx + hw, cy);
            ctx.lineTo(cx, cy + hh);
            ctx.lineTo(cx - hw, cy);
            ctx.closePath();
        },
        isInside(x, y, cx, cy, size) {
            const hw = size * 0.28;
            const hh = size * 0.38;
            return pointInPolygon(x, y, [
                { x: cx, y: cy - hh },
                { x: cx + hw, y: cy },
                { x: cx, y: cy + hh },
                { x: cx - hw, y: cy }
            ]);
        }
    },

    // === 难度 3: 挑战图形 ===
    {
        name: '小房子',
        category: 'basic',
        level: 3,
        getPoints(cx, cy, size) {
            const s = size * 0.35;
            // 简化房子形状：方形底部 + 三角屋顶
            const vertices = [
                { x: cx - s * 0.6, y: cy + s * 0.6 },     // 左下
                { x: cx - s * 0.6, y: cy - s * 0.1 },     // 左上（墙体顶部）
                { x: cx - s * 0.8, y: cy - s * 0.1 },     // 屋檐左
                { x: cx, y: cy - s * 0.8 },                // 屋顶尖
                { x: cx + s * 0.8, y: cy - s * 0.1 },     // 屋檐右
                { x: cx + s * 0.6, y: cy - s * 0.1 },     // 右上（墙体顶部）
                { x: cx + s * 0.6, y: cy + s * 0.6 }      // 右下
            ];
            const pts = [];
            const seg = 10;
            for (let e = 0; e < vertices.length; e++) {
                const a = vertices[e];
                const b = vertices[(e + 1) % vertices.length];
                for (let i = 0; i <= seg; i++) {
                    pts.push({
                        x: a.x + (b.x - a.x) * i / seg,
                        y: a.y + (b.y - a.y) * i / seg
                    });
                }
            }
            return pts;
        },
        drawFillPath(ctx, cx, cy, size) {
            const s = size * 0.35;
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.6, cy + s * 0.6);
            ctx.lineTo(cx - s * 0.6, cy - s * 0.1);
            ctx.lineTo(cx - s * 0.8, cy - s * 0.1);
            ctx.lineTo(cx, cy - s * 0.8);
            ctx.lineTo(cx + s * 0.8, cy - s * 0.1);
            ctx.lineTo(cx + s * 0.6, cy - s * 0.1);
            ctx.lineTo(cx + s * 0.6, cy + s * 0.6);
            ctx.closePath();
        },
        isInside(x, y, cx, cy, size) {
            const s = size * 0.35;
            return pointInPolygon(x, y, [
                { x: cx - s * 0.6, y: cy + s * 0.6 },
                { x: cx - s * 0.6, y: cy - s * 0.1 },
                { x: cx - s * 0.8, y: cy - s * 0.1 },
                { x: cx, y: cy - s * 0.8 },
                { x: cx + s * 0.8, y: cy - s * 0.1 },
                { x: cx + s * 0.6, y: cy - s * 0.1 },
                { x: cx + s * 0.6, y: cy + s * 0.6 }
            ]);
        }
    },
    {
        name: '小猫',
        category: 'animal',
        level: 3,
        getPoints(cx, cy, size) {
            const s = size * 0.32;
            // 简化小猫轮廓：圆形脸 + 两个三角耳朵
            const pts = [];
            const steps = 50;
            // 左耳
            pts.push({ x: cx - s * 0.65, y: cy - s * 0.15 });
            pts.push({ x: cx - s * 0.45, y: cy - s * 0.9 });
            pts.push({ x: cx - s * 0.2, y: cy - s * 0.35 });
            // 头部右侧圆弧
            for (let i = 0; i <= steps / 2; i++) {
                const angle = -Math.PI * 0.3 + (Math.PI * 0.3 + Math.PI * 0.5) * i / (steps / 2);
                pts.push({
                    x: cx + s * 0.55 * Math.cos(angle),
                    y: cy + s * 0.5 * Math.sin(angle) - s * 0.05
                });
            }
            // 右耳
            pts.push({ x: cx + s * 0.2, y: cy - s * 0.35 });
            pts.push({ x: cx + s * 0.45, y: cy - s * 0.9 });
            pts.push({ x: cx + s * 0.65, y: cy - s * 0.15 });
            // 头部左侧圆弧（回到起点）
            for (let i = 0; i <= steps / 2; i++) {
                const angle = Math.PI * 0.2 + (Math.PI - Math.PI * 0.2) * i / (steps / 2);
                pts.push({
                    x: cx + s * 0.55 * Math.cos(angle),
                    y: cy + s * 0.5 * Math.sin(angle) - s * 0.05
                });
            }
            return interpolatePoints(pts, 5);
        },
        drawFillPath(ctx, cx, cy, size) {
            const pts = this.getPoints(cx, cy, size);
            ctx.beginPath();
            pts.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
        },
        isInside() { return false; },
        usePixelHitTest: true
    },
    {
        name: '汽车',
        category: 'vehicle',
        level: 3,
        getPoints(cx, cy, size) {
            const s = size * 0.35;
            // 简化汽车轮廓
            const vertices = [
                { x: cx - s * 0.9, y: cy + s * 0.1 },    // 左下角
                { x: cx - s * 0.9, y: cy - s * 0.15 },   // 左侧车身
                { x: cx - s * 0.6, y: cy - s * 0.15 },   // 左车顶起点
                { x: cx - s * 0.45, y: cy - s * 0.6 },   // 车顶左
                { x: cx + s * 0.45, y: cy - s * 0.6 },   // 车顶右
                { x: cx + s * 0.6, y: cy - s * 0.15 },   // 右车顶终点
                { x: cx + s * 0.9, y: cy - s * 0.15 },   // 右侧车身
                { x: cx + s * 0.9, y: cy + s * 0.1 }     // 右下角
            ];
            const pts = [];
            const seg = 10;
            // 底部用两个圆弧（车轮位置）连接
            for (let e = 0; e < vertices.length; e++) {
                const a = vertices[e];
                const b = vertices[(e + 1) % vertices.length];
                for (let i = 0; i <= seg; i++) {
                    pts.push({
                        x: a.x + (b.x - a.x) * i / seg,
                        y: a.y + (b.y - a.y) * i / seg
                    });
                }
            }
            // 底部添加车轮凹槽
            const wheelY = cy + s * 0.1;
            const bottomPts = [
                { x: cx + s * 0.9, y: wheelY },
                { x: cx + s * 0.6, y: wheelY },
                // 右轮凹
                { x: cx + s * 0.6, y: cy + s * 0.4 },
                { x: cx + s * 0.3, y: cy + s * 0.4 },
                { x: cx + s * 0.3, y: wheelY },
                { x: cx - s * 0.3, y: wheelY },
                // 左轮凹
                { x: cx - s * 0.3, y: cy + s * 0.4 },
                { x: cx - s * 0.6, y: cy + s * 0.4 },
                { x: cx - s * 0.6, y: wheelY },
                { x: cx - s * 0.9, y: wheelY }
            ];
            // 替换底部直线段为带车轮凹槽的路径
            return pts;
        },
        drawFillPath(ctx, cx, cy, size) {
            const s = size * 0.35;
            const wheelY = cy + s * 0.1;
            ctx.beginPath();
            // 车身
            ctx.moveTo(cx - s * 0.9, wheelY);
            ctx.lineTo(cx - s * 0.9, cy - s * 0.15);
            ctx.lineTo(cx - s * 0.6, cy - s * 0.15);
            ctx.lineTo(cx - s * 0.45, cy - s * 0.6);
            ctx.lineTo(cx + s * 0.45, cy - s * 0.6);
            ctx.lineTo(cx + s * 0.6, cy - s * 0.15);
            ctx.lineTo(cx + s * 0.9, cy - s * 0.15);
            ctx.lineTo(cx + s * 0.9, wheelY);
            // 右轮凹
            ctx.lineTo(cx + s * 0.6, wheelY);
            ctx.arc(cx + s * 0.45, cy + s * 0.25, s * 0.15, -Math.PI * 0.1, Math.PI * 1.1, true);
            ctx.lineTo(cx + s * 0.3, wheelY);
            ctx.lineTo(cx - s * 0.3, wheelY);
            // 左轮凹
            ctx.lineTo(cx - s * 0.3, wheelY);
            ctx.arc(cx - s * 0.45, cy + s * 0.25, s * 0.15, -Math.PI * 0.1, Math.PI * 1.1, true);
            ctx.lineTo(cx - s * 0.6, wheelY);
            ctx.closePath();
        },
        // 轮廓含圆弧，描边填色命中由 hitMap 覆盖，无需 isInside
        isInside() { return false; }
    }
];

// === 辅助函数 ===

// 判断点是否在三角形内
function pointInTriangle(px, py, v1, v2, v3) {
    const d1 = sign(px, py, v1.x, v1.y, v2.x, v2.y);
    const d2 = sign(px, py, v2.x, v2.y, v3.x, v3.y);
    const d3 = sign(px, py, v3.x, v3.y, v1.x, v1.y);
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(hasNeg && hasPos);
}

function sign(px, py, x1, y1, x2, y2) {
    return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
}

// 判断点是否在多边形内（射线法）
function pointInPolygon(px, py, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

// 在点之间插值，增加采样密度
function interpolatePoints(points, segmentsPerPair) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        for (let j = 0; j < segmentsPerPair; j++) {
            const t = j / segmentsPerPair;
            result.push({
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t
            });
        }
    }
    return result;
}

// === 多部件形状工厂（内容包） ===
// parts: [ [[nx,ny],...], ... ] 归一化坐标 (0-1) 的部件多边形。
// 所有部件统一为同一绕向后，nonzero 填充天然做并集——
// 字母/数字用"笔画分解"表达（横竖撇捺各一笔），无需镂空运算。
function _signedArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
}

function _normalizeWinding(parts) {
    return parts.map(p => (_signedArea(p) < 0 ? [...p].reverse() : p));
}

// 字形便捷部件：矩形 [x0, y0, x1, y1]（归一化）
function R(x0, y0, x1, y1) {
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

// cfg: { name, level, category, parts, w, h }（w/h 为 0-1 盒子映射到 size 的宽高比，默认 0.72/0.92）
function polyShape(cfg) {
    const parts = _normalizeWinding(cfg.parts);
    const W = cfg.w || 0.72, H = cfg.h || 0.92;
    const shape = {
        name: cfg.name,
        level: cfg.level,
        category: cfg.category,
        partsCount: parts.length,
        drawFillPath(ctx, cx, cy, size) {
            ctx.beginPath();
            parts.forEach(p => {
                p.forEach(([nx, ny], i) => {
                    const x = cx + (nx - 0.5) * size * W;
                    const y = cy + (ny - 0.5) * size * H;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.closePath();
            });
        },
        isInside(x, y, cx, cy, size) {
            const px = (x - cx) / (size * W) + 0.5;
            const py = (y - cy) / (size * H) + 0.5;
            return parts.some(p => pointInPolygon(px, py, p.map(([nx, ny]) => ({ x: nx, y: ny }))));
        },
    };
    // 描边采样：逐部件沿边采样；partsPointCounts 供描边渲染按部件分段
    shape.getPoints = function (cx, cy, size) {
        const pts = [];
        const counts = [];
        parts.forEach(p => {
            let n = 0;
            for (let i = 0; i < p.length; i++) {
                const a = p[i], b = p[(i + 1) % p.length];
                const seg = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 26));
                for (let j = 0; j < seg; j++) {
                    pts.push({
                        x: cx + (a[0] + (b[0] - a[0]) * j / seg - 0.5) * size * W,
                        y: cy + (a[1] + (b[1] - a[1]) * j / seg - 0.5) * size * H,
                    });
                    n++;
                }
            }
            counts.push(n);
        });
        shape.partsPointCounts = counts;
        return pts;
    };
    return shape;
}

// === 内容包：数字 0-9 ===
const DIGIT_PARTS = {
    '0': [R(0.25, 0.05, 0.42, 0.95), R(0.58, 0.05, 0.75, 0.95), R(0.25, 0.05, 0.75, 0.20), R(0.25, 0.80, 0.75, 0.95)],
    '1': [[[0.34, 0.05], [0.52, 0.05], [0.68, 0.18], [0.68, 0.95], [0.50, 0.95], [0.50, 0.36], [0.34, 0.46]]],
    '2': [R(0.28, 0.05, 0.72, 0.18), R(0.58, 0.05, 0.72, 0.30), [[0.58, 0.28], [0.72, 0.40], [0.40, 0.80], [0.28, 0.80], [0.28, 0.66]], R(0.28, 0.82, 0.72, 0.95)],
    '3': [R(0.28, 0.05, 0.72, 0.18), R(0.58, 0.05, 0.72, 0.95), R(0.42, 0.42, 0.72, 0.58), R(0.28, 0.82, 0.72, 0.95)],
    '4': [R(0.24, 0.05, 0.40, 0.55), R(0.24, 0.42, 0.76, 0.58), R(0.60, 0.05, 0.76, 0.95)],
    '5': [R(0.28, 0.05, 0.72, 0.18), R(0.28, 0.05, 0.44, 0.52), R(0.28, 0.42, 0.72, 0.58), R(0.58, 0.42, 0.72, 0.95), R(0.28, 0.82, 0.72, 0.95)],
    '6': [R(0.28, 0.05, 0.44, 0.95), R(0.28, 0.05, 0.72, 0.18), R(0.28, 0.42, 0.72, 0.58), R(0.58, 0.42, 0.72, 0.95), R(0.28, 0.82, 0.72, 0.95)],
    '7': [R(0.25, 0.05, 0.75, 0.18), [[0.60, 0.18], [0.75, 0.18], [0.48, 0.95], [0.34, 0.95]]],
    '8': [R(0.32, 0.05, 0.68, 0.18), R(0.25, 0.05, 0.42, 0.52), R(0.58, 0.05, 0.75, 0.52), R(0.25, 0.42, 0.75, 0.58), R(0.25, 0.48, 0.42, 0.95), R(0.58, 0.48, 0.75, 0.95), R(0.25, 0.82, 0.75, 0.95)],
    '9': [R(0.25, 0.05, 0.75, 0.18), R(0.25, 0.05, 0.42, 0.52), R(0.25, 0.42, 0.75, 0.58), R(0.58, 0.05, 0.75, 0.95)],
};
Object.keys(DIGIT_PARTS).forEach(k => {
    Shapes.push(polyShape({ name: '数字 ' + k, level: 1, category: 'number', parts: DIGIT_PARTS[k] }));
});

// === 内容包：字母 A-Z ===
const LETTER_PARTS = {
    A: [[[0.16, 0.95], [0.42, 0.05], [0.58, 0.05], [0.36, 0.95]], [[0.64, 0.95], [0.42, 0.05], [0.58, 0.05], [0.84, 0.95]], R(0.28, 0.58, 0.72, 0.72)],
    B: [R(0.18, 0.05, 0.33, 0.95), R(0.33, 0.05, 0.62, 0.18), R(0.62, 0.05, 0.78, 0.42), R(0.33, 0.40, 0.78, 0.56), R(0.62, 0.40, 0.78, 0.95), R(0.33, 0.82, 0.78, 0.95)],
    C: [[[0.30, 0.05], [0.76, 0.05], [0.76, 0.18], [0.34, 0.18], [0.34, 0.82], [0.76, 0.82], [0.76, 0.95], [0.30, 0.95], [0.18, 0.82], [0.18, 0.18]]],
    D: [R(0.18, 0.05, 0.33, 0.95), R(0.33, 0.05, 0.62, 0.18), R(0.62, 0.05, 0.78, 0.95), R(0.33, 0.82, 0.62, 0.95)],
    E: [R(0.18, 0.05, 0.33, 0.95), R(0.33, 0.05, 0.78, 0.18), R(0.33, 0.42, 0.70, 0.58), R(0.33, 0.82, 0.78, 0.95)],
    F: [R(0.18, 0.05, 0.33, 0.95), R(0.33, 0.05, 0.78, 0.18), R(0.33, 0.42, 0.70, 0.58)],
    G: [R(0.18, 0.05, 0.34, 0.95), R(0.18, 0.05, 0.78, 0.18), R(0.18, 0.82, 0.78, 0.95), R(0.62, 0.44, 0.78, 0.95), R(0.48, 0.44, 0.78, 0.58)],
    H: [R(0.18, 0.05, 0.33, 0.95), R(0.67, 0.05, 0.82, 0.95), R(0.18, 0.42, 0.82, 0.58)],
    I: [R(0.30, 0.05, 0.70, 0.18), R(0.42, 0.05, 0.58, 0.95), R(0.30, 0.82, 0.70, 0.95)],
    J: [R(0.40, 0.05, 0.82, 0.18), R(0.68, 0.05, 0.82, 0.82), R(0.38, 0.68, 0.82, 0.95)],
    K: [R(0.18, 0.05, 0.33, 0.95), [[0.36, 0.48], [0.70, 0.05], [0.84, 0.05], [0.50, 0.48]], [[0.50, 0.52], [0.84, 0.95], [0.70, 0.95], [0.36, 0.52]]],
    L: [R(0.18, 0.05, 0.33, 0.95), R(0.18, 0.82, 0.78, 0.95)],
    M: [R(0.18, 0.05, 0.32, 0.95), R(0.68, 0.05, 0.82, 0.95), [[0.32, 0.05], [0.46, 0.05], [0.56, 0.58], [0.50, 0.68]], [[0.54, 0.05], [0.68, 0.05], [0.60, 0.68], [0.50, 0.58]]],
    N: [R(0.18, 0.05, 0.32, 0.95), R(0.68, 0.05, 0.82, 0.95), [[0.32, 0.05], [0.46, 0.05], [0.82, 0.78], [0.82, 0.95], [0.68, 0.95], [0.32, 0.22]]],
    O: [R(0.26, 0.05, 0.74, 0.20), R(0.18, 0.10, 0.34, 0.90), R(0.66, 0.10, 0.82, 0.90), R(0.26, 0.80, 0.74, 0.95)],
    P: [R(0.18, 0.05, 0.33, 0.95), R(0.33, 0.05, 0.62, 0.18), R(0.62, 0.05, 0.78, 0.52), R(0.33, 0.40, 0.78, 0.56)],
    Q: [R(0.26, 0.05, 0.74, 0.20), R(0.18, 0.10, 0.34, 0.90), R(0.66, 0.10, 0.82, 0.90), R(0.26, 0.80, 0.74, 0.95), [[0.58, 0.68], [0.70, 0.68], [0.86, 0.95], [0.74, 0.95]]],
    R: [R(0.18, 0.05, 0.33, 0.95), R(0.33, 0.05, 0.62, 0.18), R(0.62, 0.05, 0.78, 0.52), R(0.33, 0.40, 0.78, 0.56), [[0.50, 0.52], [0.62, 0.52], [0.84, 0.95], [0.70, 0.95]]],
    S: [R(0.24, 0.05, 0.76, 0.18), R(0.24, 0.05, 0.40, 0.50), R(0.24, 0.42, 0.76, 0.58), R(0.60, 0.50, 0.76, 0.95), R(0.24, 0.82, 0.76, 0.95)],
    T: [R(0.20, 0.05, 0.80, 0.18), R(0.42, 0.05, 0.58, 0.95)],
    U: [R(0.18, 0.05, 0.33, 0.80), R(0.67, 0.05, 0.82, 0.80), R(0.18, 0.68, 0.82, 0.95)],
    V: [[[0.20, 0.05], [0.36, 0.05], [0.50, 0.75], [0.64, 0.05], [0.80, 0.05], [0.58, 0.95], [0.42, 0.95]]],
    W: [[[0.14, 0.05], [0.28, 0.05], [0.38, 0.66], [0.47, 0.18], [0.53, 0.18], [0.62, 0.66], [0.72, 0.05], [0.86, 0.05], [0.70, 0.95], [0.58, 0.95], [0.50, 0.52], [0.42, 0.95], [0.30, 0.95]]],
    X: [[[0.20, 0.05], [0.34, 0.05], [0.80, 0.95], [0.66, 0.95]], [[0.66, 0.05], [0.80, 0.05], [0.34, 0.95], [0.20, 0.95]]],
    Y: [[[0.20, 0.05], [0.34, 0.05], [0.54, 0.46], [0.66, 0.05], [0.80, 0.05], [0.58, 0.54]], R(0.42, 0.50, 0.58, 0.95)],
    Z: [R(0.20, 0.05, 0.80, 0.18), [[0.66, 0.18], [0.80, 0.18], [0.34, 0.82], [0.20, 0.82]], R(0.20, 0.82, 0.80, 0.95)],
};
Object.keys(LETTER_PARTS).forEach(k => {
    Shapes.push(polyShape({ name: '字母 ' + k, level: 2, category: 'letter', parts: LETTER_PARTS[k] }));
});

// === 内容包：动物 ===
Shapes.push(polyShape({
    name: '蝴蝶', level: 2, category: 'animal', w: 1.0, h: 0.8,
    parts: [R(0.46, 0.22, 0.54, 0.78),
        [[0.44, 0.30], [0.20, 0.08], [0.05, 0.28], [0.09, 0.60], [0.44, 0.70]],
        [[0.56, 0.30], [0.80, 0.08], [0.95, 0.28], [0.91, 0.60], [0.56, 0.70]]],
}));
Shapes.push(polyShape({
    name: '企鹅', level: 2, category: 'animal', w: 0.8, h: 1.0,
    parts: [[[0.30, 0.08], [0.70, 0.08], [0.83, 0.40], [0.76, 0.80], [0.62, 0.93], [0.38, 0.93], [0.24, 0.80], [0.17, 0.40]],
        [[0.42, 0.16], [0.58, 0.16], [0.50, 0.26]]],
}));
Shapes.push(polyShape({
    name: '螃蟹', level: 3, category: 'animal', w: 1.0, h: 0.72,
    parts: [[[0.26, 0.38], [0.42, 0.26], [0.58, 0.26], [0.74, 0.38], [0.74, 0.64], [0.58, 0.76], [0.42, 0.76], [0.26, 0.64]],
        [[0.02, 0.18], [0.20, 0.10], [0.27, 0.30], [0.12, 0.40]],
        [[0.98, 0.18], [0.80, 0.10], [0.73, 0.30], [0.88, 0.40]]],
}));
Shapes.push(polyShape({
    name: '刺猬', level: 3, category: 'animal', w: 1.0, h: 0.78,
    parts: [[[0.08, 0.72], [0.15, 0.48], [0.23, 0.60], [0.30, 0.32], [0.38, 0.50], [0.46, 0.20], [0.54, 0.46], [0.62, 0.24], [0.68, 0.50], [0.76, 0.32], [0.81, 0.56], [0.89, 0.46], [0.92, 0.74], [0.78, 0.90], [0.24, 0.90]]],
}));
Shapes.push(polyShape({
    name: '猫头鹰', level: 3, category: 'animal', w: 0.85, h: 1.0,
    parts: [[[0.28, 0.10], [0.38, 0.03], [0.46, 0.12], [0.54, 0.12], [0.62, 0.03], [0.72, 0.10], [0.83, 0.45], [0.72, 0.92], [0.28, 0.92], [0.17, 0.45]]],
}));
Shapes.push(polyShape({
    name: '小鸭', level: 2, category: 'animal', w: 1.0, h: 0.85,
    parts: [[[0.18, 0.58], [0.34, 0.40], [0.54, 0.38], [0.64, 0.46], [0.76, 0.42], [0.84, 0.54], [0.79, 0.84], [0.28, 0.88]],
        [[0.38, 0.10], [0.58, 0.10], [0.66, 0.32], [0.42, 0.38]],
        [[0.58, 0.18], [0.78, 0.23], [0.58, 0.31]]],
}));

// === 内容包：交通工具 ===
Shapes.push(polyShape({
    name: '火箭', level: 3, category: 'vehicle', w: 0.8, h: 1.0,
    parts: [[[0.38, 0.04], [0.62, 0.04], [0.70, 0.35], [0.66, 0.72], [0.34, 0.72], [0.30, 0.35]],
        [[0.30, 0.52], [0.38, 0.52], [0.30, 0.90], [0.18, 0.90]],
        [[0.62, 0.52], [0.70, 0.52], [0.82, 0.90], [0.70, 0.90]]],
}));
Shapes.push(polyShape({
    name: '轮船', level: 3, category: 'vehicle', w: 1.0, h: 0.85,
    parts: [[[0.06, 0.58], [0.94, 0.58], [0.80, 0.92], [0.20, 0.92]],
        R(0.30, 0.28, 0.68, 0.56),
        R(0.44, 0.04, 0.56, 0.26)],
}));
Shapes.push(polyShape({
    name: '飞机', level: 3, category: 'vehicle', w: 1.0, h: 1.0,
    parts: [[[0.44, 0.02], [0.58, 0.02], [0.64, 0.45], [0.58, 0.86], [0.51, 0.96], [0.44, 0.86], [0.38, 0.45]],
        [[0.08, 0.40], [0.44, 0.36], [0.46, 0.56], [0.10, 0.62]],
        [[0.92, 0.40], [0.56, 0.36], [0.54, 0.56], [0.90, 0.62]],
        [[0.36, 0.76], [0.64, 0.76], [0.66, 0.90], [0.34, 0.90]]],
}));
Shapes.push(polyShape({
    name: '火车', level: 3, category: 'vehicle', w: 1.0, h: 0.8,
    parts: [R(0.08, 0.38, 0.92, 0.82), R(0.58, 0.08, 0.92, 0.42), R(0.20, 0.06, 0.34, 0.42)],
}));
Shapes.push(polyShape({
    name: '校车', level: 3, category: 'vehicle', w: 1.0, h: 0.7,
    parts: [[[0.06, 0.34], [0.76, 0.34], [0.94, 0.50], [0.94, 0.86], [0.06, 0.86]],
        R(0.12, 0.18, 0.70, 0.34)],
}));
