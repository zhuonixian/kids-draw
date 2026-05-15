// === 图形定义 ===
// 每个图形包含路径绘制函数和描边起点
// 路径使用归一化坐标 (0-1)，运行时按 Canvas 尺寸缩放

const Shapes = [
    // === 难度 1: 基础图形 ===
    {
        name: '圆形',
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
        isInside() { return false; },
        usePixelHitTest: true
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
