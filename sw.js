// === 画画乐园 Service Worker：离线缓存应用壳 ===
// 版本号递增即可触发旧缓存清理
const CACHE = 'kids-draw-v4';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/shapes.js',
    './js/app.js',
    './js/store.js',
    './js/stickers.js',
    './js/missions.js',
    './js/tracing.js',
    './js/freecanvas.js',
    './js/gallery.js',
    './js/parent.js',
    './assets/fonts/zcool-kuaile-subset.woff2',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    // 贴纸 PNG（约 3.7MB）：预缓存保证离线可用的贴纸架
    // --- birthday ---
    './assets/stickers/birthday/balloons.png',
    './assets/stickers/birthday/birthdaycake.png',
    './assets/stickers/birthday/bunting.png',
    './assets/stickers/birthday/candle.png',
    './assets/stickers/birthday/giftbox.png',
    './assets/stickers/birthday/horn.png',
    './assets/stickers/birthday/lollipop.png',
    './assets/stickers/birthday/partyhat.png',
    // --- careers ---
    './assets/stickers/careers/astronaut.png',
    './assets/stickers/careers/champion.png',
    './assets/stickers/careers/chef.png',
    './assets/stickers/careers/doctor.png',
    './assets/stickers/careers/firefighter.png',
    './assets/stickers/careers/painter.png',
    './assets/stickers/careers/police.png',
    './assets/stickers/careers/teacher.png',
    // --- chicks ---
    './assets/stickers/chicks/captainchick.png',
    './assets/stickers/chicks/flowerchick.png',
    './assets/stickers/chicks/fluffychick.png',
    './assets/stickers/chicks/pilotchick.png',
    // --- desserts ---
    './assets/stickers/desserts/donut.png',
    './assets/stickers/desserts/icecream.png',
    './assets/stickers/desserts/macarons.png',
    './assets/stickers/desserts/strawberrycake.png',
    // --- dinosaurs ---
    './assets/stickers/dinosaurs/bowdino.png',
    './assets/stickers/dinosaurs/greendino.png',
    './assets/stickers/dinosaurs/hatchling.png',
    './assets/stickers/dinosaurs/volcanodino.png',
    // --- emotions ---
    './assets/stickers/emotions/angry.png',
    './assets/stickers/emotions/cry.png',
    './assets/stickers/emotions/laugh.png',
    './assets/stickers/emotions/love.png',
    './assets/stickers/emotions/proud.png',
    './assets/stickers/emotions/shy.png',
    './assets/stickers/emotions/sleepy.png',
    './assets/stickers/emotions/surprised.png',
    // --- fairytale ---
    './assets/stickers/fairytale/boy.png',
    './assets/stickers/fairytale/cloudbaby.png',
    './assets/stickers/fairytale/girl.png',
    './assets/stickers/fairytale/leafelf.png',
    // --- festivals ---
    './assets/stickers/festivals/christmastree.png',
    './assets/stickers/festivals/lanternbunny.png',
    './assets/stickers/festivals/mooncake.png',
    './assets/stickers/festivals/ribbonpresent.png',
    './assets/stickers/festivals/tangyuan.png',
    './assets/stickers/festivals/witchpumpkin.png',
    // --- friends ---
    './assets/stickers/friends/bunny.png',
    './assets/stickers/friends/honeybear.png',
    './assets/stickers/friends/piggy.png',
    './assets/stickers/friends/puppy.png',
    './assets/stickers/friends/scarfpig.png',
    './assets/stickers/friends/starcat.png',
    // --- fruits ---
    './assets/stickers/fruits/apple.png',
    './assets/stickers/fruits/banana.png',
    './assets/stickers/fruits/grapes.png',
    './assets/stickers/fruits/lemon.png',
    './assets/stickers/fruits/orange.png',
    './assets/stickers/fruits/watermelon.png',
    // --- garden ---
    './assets/stickers/garden/ants.png',
    './assets/stickers/garden/bee.png',
    './assets/stickers/garden/cactus.png',
    './assets/stickers/garden/caterpillar.png',
    './assets/stickers/garden/dandelion.png',
    './assets/stickers/garden/dragonfly.png',
    './assets/stickers/garden/ladybug.png',
    './assets/stickers/garden/mushroomhouse.png',
    './assets/stickers/garden/snail.png',
    './assets/stickers/garden/sunflower.png',
    // --- meals ---
    './assets/stickers/meals/burger.png',
    './assets/stickers/meals/corn.png',
    './assets/stickers/meals/dango.png',
    './assets/stickers/meals/dumplings.png',
    './assets/stickers/meals/friedegg.png',
    './assets/stickers/meals/milk.png',
    './assets/stickers/meals/noodles.png',
    './assets/stickers/meals/riceball.png',
    './assets/stickers/meals/sushi.png',
    './assets/stickers/meals/toast.png',
    // --- monsters ---
    './assets/stickers/monsters/cloudmonster.png',
    './assets/stickers/monsters/jellymonster.png',
    './assets/stickers/monsters/longneckmonster.png',
    './assets/stickers/monsters/oneeyemonster.png',
    './assets/stickers/monsters/squaremonster.png',
    './assets/stickers/monsters/threeeyemonster.png',
    // --- music ---
    './assets/stickers/music/drumbear.png',
    './assets/stickers/music/notecloud.png',
    './assets/stickers/music/pianocat.png',
    './assets/stickers/music/songbird.png',
    // --- ocean ---
    './assets/stickers/ocean/bluewhale.png',
    './assets/stickers/ocean/crab.png',
    './assets/stickers/ocean/dolphinkid.png',
    './assets/stickers/ocean/jellyfish.png',
    './assets/stickers/ocean/octopus.png',
    './assets/stickers/ocean/pufferfish.png',
    // --- space ---
    './assets/stickers/space/alien.png',
    './assets/stickers/space/moonbaby.png',
    './assets/stickers/space/planetkid.png',
    './assets/stickers/space/starfairy.png',
    // --- sports ---
    './assets/stickers/sports/basketballfawn.png',
    './assets/stickers/sports/footballkid.png',
    './assets/stickers/sports/skateboardbear.png',
    './assets/stickers/sports/swimfish.png',
    './assets/stickers/sports/tennisbunny.png',
    './assets/stickers/sports/trophycat.png',
    // --- toys ---
    './assets/stickers/toys/balloonbear.png',
    './assets/stickers/toys/dinorocket.png',
    './assets/stickers/toys/hearttrain.png',
    './assets/stickers/toys/smilecar.png',
    // --- vehicles ---
    './assets/stickers/vehicles/ambulance.png',
    './assets/stickers/vehicles/bicycle.png',
    './assets/stickers/vehicles/bus.png',
    './assets/stickers/vehicles/firetruck.png',
    './assets/stickers/vehicles/helicopter.png',
    './assets/stickers/vehicles/hotairballoon.png',
    './assets/stickers/vehicles/sailboat.png',
    './assets/stickers/vehicles/steamtrain.png',
    './assets/stickers/vehicles/submarine.png',
    './assets/stickers/vehicles/tractor.png',
    // --- weather ---
    './assets/stickers/weather/fogkid.png',
    './assets/stickers/weather/lightning.png',
    './assets/stickers/weather/rainbowcloud.png',
    './assets/stickers/weather/raindrop.png',
    './assets/stickers/weather/snowflake.png',
    './assets/stickers/weather/windbaby.png',
    // --- wildlife ---
    './assets/stickers/wildlife/elephant.png',
    './assets/stickers/wildlife/fox.png',
    './assets/stickers/wildlife/giraffe.png',
    './assets/stickers/wildlife/kangaroo.png',
    './assets/stickers/wildlife/lion.png',
    './assets/stickers/wildlife/monkey.png',
    './assets/stickers/wildlife/owl.png',
    './assets/stickers/wildlife/panda.png',
    './assets/stickers/wildlife/raccoon.png',
    './assets/stickers/wildlife/sloth.png',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;

    // HTML/JS/CSS 走 network-first：代码更新后用户立即可见，离线时回退缓存
    const isAppShell = url.pathname.endsWith('.html')
        || url.pathname.endsWith('.js')
        || url.pathname.endsWith('.css')
        || url.pathname === '/' ;

    e.respondWith(
        (isAppShell
            ? fetch(e.request).then(resp => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return resp;
            }).catch(() => caches.match(e.request))
            : caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return resp;
            }))
        ).then(resp => resp || caches.match('./index.html'))
    );
});
