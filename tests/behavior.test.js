const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const tracing = fs.readFileSync(path.join(root, 'js', 'tracing.js'), 'utf8');
const freecanvas = fs.readFileSync(path.join(root, 'js', 'freecanvas.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const stickers = fs.existsSync(path.join(root, 'js', 'stickers.js'))
    ? fs.readFileSync(path.join(root, 'js', 'stickers.js'), 'utf8')
    : '';

assert(
    tracing.includes('maskCanvas') && tracing.includes('outlineCanvas'),
    'Tracing should cache mask and outline layers for smooth coloring.'
);
assert(
    !tracing.includes('ctx.setTransform(1, 0, 0, 1, 0, 0);\n        ctx.drawImage(this.fillCanvas, 0, 0);'),
    'Tracing should not draw the DPR-sized fill canvas directly in device-pixel coordinates.'
);
assert(
    freecanvas.includes('_drawCartoonDetails') && freecanvas.includes('_drawHappyFace'),
    'FreeCanvas shapes should render reusable cartoon face details.'
);
assert(
    stickers.includes('const StickerLibrary') && stickers.includes('assetType') && stickers.includes('image/svg+xml'),
    'StickerLibrary should provide SVG stickers through a PNG-ready asset registry.'
);
assert(
    ['ocean', 'dino', 'space', 'music'].every(category => stickers.includes(`${category}:`)),
    'StickerLibrary should include expanded ocean, dino, space, and music categories.'
);
assert(
    stickers.includes('chickteam:') && ['captainchick', 'flowerchick', 'babychick', 'pilotchick'].every(id => stickers.includes(id)),
    'StickerLibrary should include an original chick-team category and variants.'
);
assert(
    (stickers.match(/assetType: 'svg'/g) || []).length >= 38,
    'StickerLibrary should include at least 38 built-in cartoon stickers.'
);
assert(
    index.indexOf('js/stickers.js') > -1 && index.indexOf('js/stickers.js') < index.indexOf('js/freecanvas.js'),
    'StickerLibrary should load before FreeCanvas.'
);
assert(
    freecanvas.includes("currentTool: 'sticker'") && freecanvas.includes('_placeSticker') && freecanvas.includes('_drawStickerObj'),
    'FreeCanvas should support placing and rendering sticker objects.'
);
assert(
    app.includes('playDrawSound') && app.includes('playStickerSound') && app.includes('playFillSound'),
    'App should expose drawing, sticker, and fill sound effects.'
);
assert(
    app.includes('unlockAudio') && app.includes('_noise') && app.includes('createBufferSource'),
    'App should unlock audio from user gestures and use a noise source for audible drawing sounds.'
);
assert(
    freecanvas.includes('_startStroke(p)') && freecanvas.includes('App.playDrawSound'),
    'FreeCanvas should trigger draw sound when a brush stroke starts or moves.'
);

console.log('behavior checks passed');
