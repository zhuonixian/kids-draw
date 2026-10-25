#!/usr/bin/env node
// === 生成笔画骨架字库：makemeahanzi graphics.txt → assets/hanzi/hanzi-medians.json ===
// 用法: node tools/build-hanzi-data.mjs [graphics.txt 路径，默认 /tmp/graphics.txt]
// 数据来源: https://github.com/skishore/makemeahanzi （graphics.txt，Arphic Public License，
// 许可全文见 assets/hanzi/APL-LICENSE.txt；仅提取 medians 笔画骨架线，不含字形轮廓路径）
//
// 输出格式: { "字": [笔1, 笔2, ...], 每笔 = [x0,y0,x1,y1,...] 平铺整数数组 }
// 坐标: 归一化 0-1000 整数（千分比），y 轴向下（与 Canvas 一致），按笔顺排列。
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const src = process.argv[2] || '/tmp/graphics.txt';
const outPath = path.resolve('assets/hanzi/hanzi-medians.json');

async function main() {
    if (!fs.existsSync(src)) {
        console.error('找不到 ' + src + '，请先下载 graphics.txt（见 README 数据来源说明）');
        process.exit(1);
    }

    // 坐标系方向探测：'二' 第一笔（短横在上）y 应小于第二笔（长横在下）。
    // 若相反说明 y 轴向上（字体坐标），输出时翻转。
    const rl0 = readline.createInterface({ input: fs.createReadStream(src) });
    let yAxisDown = null;
    for await (const line of rl0) {
        try {
            const g = JSON.parse(line);
            if (g.character === '二' && g.medians.length === 2) {
                const avgY = (m) => m.reduce((s, p) => s + p[1], 0) / m.length;
                yAxisDown = avgY(g.medians[0]) < avgY(g.medians[1]);
                break;
            }
        } catch (e) { /* 跳过坏行 */ }
    }
    rl0.close();
    if (yAxisDown === null) { console.error('探测失败：graphics.txt 中找不到"二"'); process.exit(1); }
    console.log('坐标方向: y 轴' + (yAxisDown ? '向下（无需翻转）' : '向上（输出时翻转）'));

    const result = {};
    let count = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(src) });
    for await (const line of rl) {
        let g;
        try { g = JSON.parse(line); } catch (e) { continue; }
        if (!g.character || !Array.isArray(g.medians) || !g.medians.length) continue;
        // 每笔：平铺 [x,y,...]，去连续重复点，量化到 0-1000
        const strokes = g.medians.map(m => {
            const flat = [];
            let px = -1, py = -1;
            for (const p of m) {
                const x = Math.max(0, Math.min(1000, Math.round(p[0] * 1000 / 1024)));
                const y = Math.max(0, Math.min(1000, Math.round((yAxisDown ? p[1] : 1024 - p[1]) * 1000 / 1024)));
                if (x === px && y === py) continue;
                flat.push(x, y);
                px = x; py = y;
            }
            return flat;
        }).filter(s => s.length >= 2);
        if (strokes.length) {
            result[g.character] = strokes;
            count++;
        }
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result));
    const size = fs.statSync(outPath).size;
    console.log('完成: ' + count + ' 字 → ' + outPath + ' (' + (size / 1024 / 1024).toFixed(1) + 'MB)');
}

main();
