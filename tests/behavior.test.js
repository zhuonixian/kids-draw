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
const store = fs.existsSync(path.join(root, 'js', 'store.js'))
    ? fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8')
    : '';
const gallery = fs.existsSync(path.join(root, 'js', 'gallery.js'))
    ? fs.readFileSync(path.join(root, 'js', 'gallery.js'), 'utf8')
    : '';
const parent = fs.existsSync(path.join(root, 'js', 'parent.js'))
    ? fs.readFileSync(path.join(root, 'js', 'parent.js'), 'utf8')
    : '';
const shapesSrc = fs.readFileSync(path.join(root, 'js', 'shapes.js'), 'utf8');

assert(
    tracing.includes('maskCanvas') && tracing.includes('outlineCanvas'),
    'Tracing should cache mask and outline layers for smooth coloring.'
);
assert(
    !tracing.includes('ctx.setTransform(1, 0, 0, 1, 0, 0);\n        ctx.drawImage(this.fillCanvas, 0, 0);'),
    'Tracing should not draw the DPR-sized fill canvas directly in device-pixel coordinates.'
);
assert(
    tracing.includes('destination-out'),
    'Tracing outline mask must punch out the shape interior via compositing: drawFillPath resets the path, so an evenodd rect+shape clip degrades into a solid disc that hides the fill.'
);
assert(
    freecanvas.includes('_drawCartoonDetails') && freecanvas.includes('_drawHappyFace'),
    'FreeCanvas shapes should render reusable cartoon face details.'
);
assert(
    stickers.includes('const StickerLibrary') && stickers.includes('assetType') && stickers.includes('image/svg+xml'),
    'StickerLibrary should provide PNG stickers through the asset registry with SVG fallbacks.'
);
assert(
    ['ocean', 'dinosaurs', 'space', 'music'].every(category => stickers.includes(`${category}:`)),
    'StickerLibrary should include expanded ocean, dinosaurs, space, and music categories.'
);
assert(
    stickers.includes('chicks:') && ['captainchick', 'flowerchick', 'fluffychick', 'pilotchick'].every(id => stickers.includes(id)),
    'StickerLibrary should include an original chick-team category and variants.'
);
assert(
    (stickers.match(/pngSticker\(/g) || []).length >= 100,
    'StickerLibrary should include at least 100 AI-generated PNG stickers.'
);
assert(
    (stickers.match(/assetType: 'svg'/g) || []).length >= 1,
    'StickerLibrary should keep programmatic SVG stickers as offline fallbacks.'
);
assert(
    stickers.includes("pngSticker('friends', 'piggy'") && freecanvas.includes("currentStickerId: 'piggy'"),
    'FreeCanvas default sticker id should exist in the PNG sticker registry.'
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
    index.includes('id="sticker-action-bar"') && freecanvas.includes('_stickerAction')
        && ['zoomin', 'zoomout', 'rotate', 'copy', 'delete'].every(act => freecanvas.includes(`'${act}'`)),
    'FreeCanvas should expose a selected-sticker action bar with zoom, rotate, copy, and delete.'
);
assert(
    freecanvas.includes('_pinchStart') && freecanvas.includes('_pinchMove') && freecanvas.includes('touchcancel'),
    'FreeCanvas should support two-finger pinch-to-scale and pinch-to-rotate on the selected sticker.'
);
assert(
    freecanvas.includes('rotation') && freecanvas.includes('ctx.rotate'),
    'Placed stickers should render with rotation support.'
);
assert(
    freecanvas.includes('_getRecent') && freecanvas.includes("_rememberRecent") && freecanvas.includes("'recent'"),
    'Sticker panel should surface a persistent recent-stickers tab.'
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
assert(
    store.includes('const ArtworkStore') && store.includes('dataUrl') && store.includes('download'),
    'ArtworkStore should persist artworks to localStorage with export helpers.'
);
assert(
    gallery.includes('const Gallery') && gallery.includes('onEnter') && gallery.includes('render'),
    'Gallery should render the artwork shelf scene.'
);
assert(
    freecanvas.includes('_history') && freecanvas.includes('_undo') && freecanvas.includes('_renderStickerPanel')
        && freecanvas.includes('_renderShapePanel') && freecanvas.includes('_saveArtwork'),
    'FreeCanvas should support undo history, picker panels, and artwork saving.'
);
assert(
    tracing.includes('_encourage') && app.includes('playEncourageSound'),
    'Tracing should encourage kids below completion thresholds with a sound cue.'
);
assert(
    index.includes('id="sticker-panel"') && index.includes('id="shape-panel"') && index.includes('id="gallery"')
        && index.includes('btn-gallery') && index.includes('id="fc-undo"') && index.includes('id="fc-save"'),
    'index.html should include picker panels, gallery scene, and undo/save buttons.'
);
assert(
    index.indexOf('js/store.js') > -1 && index.indexOf('js/gallery.js') > index.indexOf('js/freecanvas.js'),
    'Gallery should load after its dependencies.'
);
assert(
    shapesSrc.includes('function polyShape') && shapesSrc.includes("category: 'number'")
        && shapesSrc.includes("category: 'letter'") && shapesSrc.includes("category: 'animal'")
        && shapesSrc.includes("category: 'vehicle'") && shapesSrc.includes('partsPointCounts'),
    'Shape library should provide the polyShape factory and expanded content packs.'
);
try {
    const shapeCount = new Function(shapesSrc + '\nreturn Shapes.length;')();
    assert(shapeCount >= 56, `Shape library should have >= 56 shapes (basic/number/letter/animal/vehicle), got ${shapeCount}.`);
} catch (e) {
    assert(false, 'shapes.js should evaluate in plain Node without DOM dependencies.');
}
assert(
    tracing.includes('_selectShape') && tracing.includes('_renderShapePicker') && tracing.includes('ShapeProgress.mark'),
    'Tracing should wire the shape picker panel and record collection progress.'
);
assert(
    store.includes('const ShapeProgress') && store.includes('const Settings'),
    'Store should provide ShapeProgress and Settings namespaces.'
);
assert(
    parent.includes('const ParentZone') && parent.includes('_startRestTimer') && parent.includes('parent-sound'),
    'ParentZone should expose the parent gate, sound toggle, and rest timer.'
);
assert(
    index.includes('id="shape-picker"') && index.includes('id="btn-parent"') && index.includes('id="rest-overlay"')
        && index.includes('id="parent-gate"'),
    'index.html should include the shape picker, parent entry, gate, and rest overlay.'
);
assert(
    !index.includes('rel="stylesheet" media="all"'),
    'Google Fonts stylesheet should stay non-render-blocking.'
);

console.log('behavior checks passed');
