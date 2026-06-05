// === 原创卡通贴图库 ===
// 本文件所有贴纸图形均由程序化 SVG 生成，为项目原创内容。
// 角色设计为通用卡通风格，不引用或模仿任何已知商业 IP。
// source 支持 SVG data URI，也可以替换为 assets/stickers/*.png。
const StickerLibrary = {
    categories: {
        friends: { label: '伙伴', stickers: ['pinkypig', 'chickhero', 'bunnykid', 'bearbuddy', 'catstar', 'puppy'] },
        chickteam: { label: '小鸡一家', stickers: ['captainchick', 'flowerchick', 'babychick', 'pilotchick'] },
        magic: { label: '童话', stickers: ['girlbuddy', 'boybuddy', 'leafsprite', 'cloudbaby'] },
        toys: { label: '玩具', stickers: ['smilecar', 'rocketpal', 'trainkid', 'balloonpal'] },
        snacks: { label: '甜点', stickers: ['strawberry', 'sunny', 'mushroomkid', 'flowerkid'] },
        ocean: { label: '海洋', stickers: ['dolphinkid', 'whalebaby', 'octopal', 'jellystar'] },
        dino: { label: '恐龙', stickers: ['greendino', 'pinkdino', 'eggdragon', 'volcanobaby'] },
        space: { label: '太空', stickers: ['moonbaby', 'starbuddy', 'planetpal', 'alienkid'] },
        music: { label: '音乐', stickers: ['drumbear', 'singbird', 'pianocat', 'notecloud'] },
        fruits: { label: '水果', stickers: ['applekid', 'bananabro', 'grapesis', 'watermelon', 'orangekid', 'lemonkid'] },
        weather: { label: '天气', stickers: ['rainbowpal', 'raindrop', 'snowflake', 'windbaby', 'thundypal', 'foggykid'] },
        sports: { label: '运动', stickers: ['soccerkid', 'basketpal', 'swimfish', 'runbuddy', 'bikehero', 'skatepal'] },
        holiday: { label: '节日', stickers: ['christmastree', 'giftbox', 'lanternbaby', 'dumpling', 'mooncake', 'pumpkinpal'] }
    },

    items: [
        { id: 'pinkypig', name: '小粉猪', assetType: 'svg', source: makeStickerSvg('#FF9BB3', 'pig') },
        { id: 'chickhero', name: '元气小鸡', assetType: 'svg', source: makeStickerSvg('#FFD94A', 'chick') },
        { id: 'bunnykid', name: '跳跳兔', assetType: 'svg', source: makeStickerSvg('#FFFFFF', 'bunny') },
        { id: 'bearbuddy', name: '抱抱熊', assetType: 'svg', source: makeStickerSvg('#C98A54', 'bear') },
        { id: 'catstar', name: '星星猫', assetType: 'svg', source: makeStickerSvg('#FFB6D5', 'cat') },
        { id: 'puppy', name: '圆耳狗', assetType: 'svg', source: makeStickerSvg('#F2B872', 'puppy') },
        { id: 'captainchick', name: '队长小鸡', assetType: 'svg', source: makeStickerSvg('#FFD94A', 'captainchick') },
        { id: 'flowerchick', name: '花花小鸡', assetType: 'svg', source: makeStickerSvg('#FFE066', 'flowerchick') },
        { id: 'babychick', name: '宝宝小鸡', assetType: 'svg', source: makeStickerSvg('#FFF08A', 'babychick') },
        { id: 'pilotchick', name: '飞飞小鸡', assetType: 'svg', source: makeStickerSvg('#FFD15C', 'pilotchick') },
        { id: 'girlbuddy', name: '笑笑女孩', assetType: 'svg', source: makeStickerSvg('#FFB7A8', 'girl') },
        { id: 'boybuddy', name: '太阳男孩', assetType: 'svg', source: makeStickerSvg('#8FD3FF', 'boy') },
        { id: 'leafsprite', name: '叶子精灵', assetType: 'svg', source: makeStickerSvg('#78D98B', 'sprite') },
        { id: 'cloudbaby', name: '云朵宝宝', assetType: 'svg', source: makeStickerSvg('#BEEBFF', 'cloud') },
        { id: 'smilecar', name: '笑脸小车', assetType: 'svg', source: makeStickerSvg('#74B9FF', 'car') },
        { id: 'rocketpal', name: '火箭伙伴', assetType: 'svg', source: makeStickerSvg('#FF8A80', 'rocket') },
        { id: 'trainkid', name: '彩虹火车', assetType: 'svg', source: makeStickerSvg('#A29BFE', 'train') },
        { id: 'balloonpal', name: '气球朋友', assetType: 'svg', source: makeStickerSvg('#FD79A8', 'balloon') },
        { id: 'strawberry', name: '草莓宝宝', assetType: 'svg', source: makeStickerSvg('#FF5C7A', 'berry') },
        { id: 'sunny', name: '太阳哥哥', assetType: 'svg', source: makeStickerSvg('#FFD93D', 'sun') },
        { id: 'mushroomkid', name: '蘑菇仔', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'mushroom') },
        { id: 'flowerkid', name: '花朵妹妹', assetType: 'svg', source: makeStickerSvg('#FDCB6E', 'flower') },
        { id: 'dolphinkid', name: '海豚宝宝', assetType: 'svg', source: makeStickerSvg('#6EC6FF', 'dolphin') },
        { id: 'whalebaby', name: '鲸鱼船长', assetType: 'svg', source: makeStickerSvg('#74B9FF', 'whale') },
        { id: 'octopal', name: '章鱼朋友', assetType: 'svg', source: makeStickerSvg('#C77DFF', 'octopus') },
        { id: 'jellystar', name: '水母星星', assetType: 'svg', source: makeStickerSvg('#FFB6D5', 'jelly') },
        { id: 'greendino', name: '绿恐龙', assetType: 'svg', source: makeStickerSvg('#6BCB77', 'dino') },
        { id: 'pinkdino', name: '粉恐龙', assetType: 'svg', source: makeStickerSvg('#FF9BB3', 'dino') },
        { id: 'eggdragon', name: '蛋壳龙', assetType: 'svg', source: makeStickerSvg('#FFE066', 'eggdragon') },
        { id: 'volcanobaby', name: '火山宝宝', assetType: 'svg', source: makeStickerSvg('#FF8A65', 'volcano') },
        { id: 'moonbaby', name: '月亮宝宝', assetType: 'svg', source: makeStickerSvg('#F6E58D', 'moon') },
        { id: 'starbuddy', name: '星星伙伴', assetType: 'svg', source: makeStickerSvg('#FFD93D', 'bigstar') },
        { id: 'planetpal', name: '行星朋友', assetType: 'svg', source: makeStickerSvg('#A29BFE', 'planet') },
        { id: 'alienkid', name: '小外星人', assetType: 'svg', source: makeStickerSvg('#55EFC4', 'alien') },
        { id: 'drumbear', name: '鼓鼓熊', assetType: 'svg', source: makeStickerSvg('#D4A373', 'drum') },
        { id: 'singbird', name: '唱歌小鸟', assetType: 'svg', source: makeStickerSvg('#74D3AE', 'bird') },
        { id: 'pianocat', name: '钢琴猫', assetType: 'svg', source: makeStickerSvg('#FFB6D5', 'piano') },
        { id: 'notecloud', name: '音符云', assetType: 'svg', source: makeStickerSvg('#BEEBFF', 'notecloud') },
        // --- 水果 ---
        { id: 'applekid', name: '苹果宝宝', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'apple') },
        { id: 'bananabro', name: '香蕉弟弟', assetType: 'svg', source: makeStickerSvg('#FFE066', 'banana') },
        { id: 'grapesis', name: '葡萄姐妹', assetType: 'svg', source: makeStickerSvg('#C77DFF', 'grape') },
        { id: 'watermelon', name: '西瓜胖胖', assetType: 'svg', source: makeStickerSvg('#6BCB77', 'watermelon') },
        { id: 'orangekid', name: '橙子圆圆', assetType: 'svg', source: makeStickerSvg('#FFB347', 'orange') },
        { id: 'lemonkid', name: '柠檬酸酸', assetType: 'svg', source: makeStickerSvg('#FFF176', 'lemon') },
        // --- 天气 ---
        { id: 'rainbowpal', name: '彩虹桥', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'rainbow') },
        { id: 'raindrop', name: '小雨滴', assetType: 'svg', source: makeStickerSvg('#74B9FF', 'raindrop') },
        { id: 'snowflake', name: '雪花仙子', assetType: 'svg', source: makeStickerSvg('#BEEBFF', 'snowflake') },
        { id: 'windbaby', name: '风宝宝', assetType: 'svg', source: makeStickerSvg('#DFE6E9', 'wind') },
        { id: 'thundypal', name: '闪电伙伴', assetType: 'svg', source: makeStickerSvg('#FFD93D', 'thundy') },
        { id: 'foggykid', name: '雾雾精灵', assetType: 'svg', source: makeStickerSvg('#B2BEC3', 'foggy') },
        // --- 运动 ---
        { id: 'soccerkid', name: '足球小子', assetType: 'svg', source: makeStickerSvg('#6BCB77', 'soccer') },
        { id: 'basketpal', name: '篮球伙伴', assetType: 'svg', source: makeStickerSvg('#FF8A65', 'basketball') },
        { id: 'swimfish', name: '游泳小鱼', assetType: 'svg', source: makeStickerSvg('#74B9FF', 'swimring') },
        { id: 'runbuddy', name: '跑步伙伴', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'runshoe') },
        { id: 'bikehero', name: '骑车英雄', assetType: 'svg', source: makeStickerSvg('#A29BFE', 'bike') },
        { id: 'skatepal', name: '滑板朋友', assetType: 'svg', source: makeStickerSvg('#FD79A8', 'skate') },
        // --- 节日 ---
        { id: 'christmastree', name: '圣诞树', assetType: 'svg', source: makeStickerSvg('#6BCB77', 'xmastree') },
        { id: 'giftbox', name: '礼物盒', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'giftbox') },
        { id: 'lanternbaby', name: '灯笼宝宝', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'lantern') },
        { id: 'dumpling', name: '饺子团团', assetType: 'svg', source: makeStickerSvg('#FFF8E7', 'dumpling') },
        { id: 'mooncake', name: '月饼圆圆', assetType: 'svg', source: makeStickerSvg('#D4A373', 'mooncake') },
        { id: 'pumpkinpal', name: '南瓜灯', assetType: 'svg', source: makeStickerSvg('#FF8A65', 'pumpkin') }
    ],

    get(id) {
        return this.items.find(item => item.id === id) || this.items[0];
    },

    byCategory(category) {
        const group = this.categories[category] || this.categories.friends;
        return group.stickers.map(id => this.get(id));
    }
};

function makeStickerSvg(color, kind) {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#5D4037" flood-opacity=".20"/>
  </filter>
  <g filter="url(#s)">
    ${bodyShape(kind, color)}
    ${extras(kind)}
    ${face(kind)}
    <ellipse cx="56" cy="88" rx="10" ry="6" fill="#FF8FB3" opacity=".65"/>
    <ellipse cx="104" cy="88" rx="10" ry="6" fill="#FF8FB3" opacity=".65"/>
  </g>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
}

function bodyShape(kind, color) {
    if (kind === 'car') return `<rect x="26" y="62" width="108" height="48" rx="22" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M52 64 L68 43 H101 L116 64" fill="${light(color)}" stroke="#5D4037" stroke-width="5"/><circle cx="55" cy="112" r="13" fill="#4E342E"/><circle cx="106" cy="112" r="13" fill="#4E342E"/>`;
    if (kind === 'rocket') return `<path d="M80 20 C108 50 111 92 95 122 H65 C49 92 52 50 80 20Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M64 104 L40 132 L67 124" fill="#FFD93D" stroke="#5D4037" stroke-width="5"/><path d="M96 104 L120 132 L93 124" fill="#FFD93D" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'train') return `<rect x="28" y="58" width="104" height="52" rx="16" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="42" y="38" width="40" height="30" rx="8" fill="#74B9FF" stroke="#5D4037" stroke-width="5"/><circle cx="55" cy="116" r="12" fill="#4E342E"/><circle cx="105" cy="116" r="12" fill="#4E342E"/>`;
    if (kind === 'balloon') return `<ellipse cx="80" cy="62" rx="42" ry="50" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M72 111 L80 124 L88 111Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M80 124 C70 140 95 143 82 154" fill="none" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'berry') return `<path d="M80 30 C122 45 130 95 80 132 C30 95 38 45 80 30Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M58 38 C66 20 76 31 80 18 C84 31 96 20 103 39" fill="#6BCB77" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'sun') return `<g stroke="#5D4037" stroke-width="5" stroke-linecap="round">${Array.from({length: 10}, (_, i) => { const a = i * Math.PI / 5; const x1 = 80 + Math.cos(a) * 50; const y1 = 80 + Math.sin(a) * 50; const x2 = 80 + Math.cos(a) * 68; const y2 = 80 + Math.sin(a) * 68; return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }).join('')}</g><circle cx="80" cy="80" r="48" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'mushroom') return `<path d="M33 75 C42 34 118 34 127 75 Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="59" y="72" width="42" height="56" rx="18" fill="#FFF8E7" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'flower') return `<g fill="${color}" stroke="#5D4037" stroke-width="5">${[0,1,2,3,4,5].map(i => { const a = i * Math.PI / 3; return `<ellipse cx="${80 + Math.cos(a) * 30}" cy="${74 + Math.sin(a) * 30}" rx="22" ry="30" transform="rotate(${i * 60} ${80 + Math.cos(a) * 30} ${74 + Math.sin(a) * 30})"/>`; }).join('')}</g><circle cx="80" cy="74" r="25" fill="#FFD93D" stroke="#5D4037" stroke-width="5"/>`;
    if (['captainchick', 'flowerchick', 'babychick', 'pilotchick'].includes(kind)) {
        return `<ellipse cx="80" cy="83" rx="48" ry="52" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M45 55 C38 31 61 25 67 49 C69 25 91 25 93 49 C100 25 124 33 113 57" fill="#FFE66D" stroke="#5D4037" stroke-width="5"/><path d="M45 86 C23 76 22 108 49 107" fill="#FFE66D" stroke="#5D4037" stroke-width="5"/><path d="M115 86 C137 76 138 108 111 107" fill="#FFE66D" stroke="#5D4037" stroke-width="5"/><path d="M78 87 L103 97 L78 108Z" fill="#FFA36C" stroke="#5D4037" stroke-width="4"/>`;
    }
    if (kind === 'dolphin') return `<path d="M29 83 C48 43 102 38 130 68 C113 70 109 84 124 100 C88 111 56 111 29 83Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M58 57 L48 31 L79 51" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M126 68 L148 50 L142 84" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'whale') return `<path d="M28 84 C33 48 90 38 126 63 C143 74 138 105 113 116 H57 C38 115 24 101 28 84Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M126 64 L148 47 L145 77 L153 99 L128 89" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M62 46 C59 31 75 26 83 43" fill="none" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/>`;
    if (kind === 'octopus') return `<circle cx="80" cy="67" r="42" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M43 100 C37 128 62 128 58 101 M66 106 C57 135 89 134 80 106 M95 106 C90 135 121 131 111 101 M116 100 C126 126 148 118 128 96" fill="none" stroke="#5D4037" stroke-width="8" stroke-linecap="round"/>`;
    if (kind === 'jelly') return `<path d="M39 79 C42 33 118 33 121 79 Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M47 82 C43 119 66 119 62 86 M74 84 C65 122 95 122 86 84 M101 86 C96 119 119 119 113 82" fill="none" stroke="#5D4037" stroke-width="6" stroke-linecap="round"/>`;
    if (kind === 'dino') return `<path d="M42 92 C42 48 95 35 122 62 C146 87 118 123 79 116 C55 112 42 105 42 92Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M55 52 L63 32 L73 52 L83 31 L93 52" fill="${light(color)}" stroke="#5D4037" stroke-width="4"/><path d="M43 97 L23 115 M111 111 L122 136" stroke="#5D4037" stroke-width="8" stroke-linecap="round"/>`;
    if (kind === 'eggdragon') return `<path d="M48 95 C48 45 113 39 119 92 C122 121 98 139 73 126 C57 118 48 108 48 95Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M46 94 L64 82 L82 96 L101 82 L121 96 V128 H46Z" fill="#FFF8E7" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'volcano') return `<path d="M38 125 L66 48 C71 34 89 34 94 48 L123 125Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M65 50 L80 64 L95 50" fill="#FFE066" stroke="#5D4037" stroke-width="5"/><circle cx="61" cy="36" r="10" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/><circle cx="96" cy="31" r="8" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'moon') return `<path d="M105 31 C69 41 55 79 76 112 C51 105 35 84 40 61 C45 32 74 18 105 31Z" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'bigstar') return `<path d="M80 20 L96 57 L136 60 L106 86 L116 126 L80 105 L44 126 L54 86 L24 60 L64 57Z" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'planet') return `<circle cx="80" cy="80" r="42" fill="${color}" stroke="#5D4037" stroke-width="5"/><ellipse cx="80" cy="83" rx="66" ry="19" fill="none" stroke="#5D4037" stroke-width="6" transform="rotate(-14 80 83)"/>`;
    if (kind === 'alien') return `<ellipse cx="80" cy="77" rx="44" ry="52" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M56 38 L38 18 M104 38 L122 18" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="16" r="7" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/><circle cx="124" cy="16" r="7" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'drum') return `<ellipse cx="80" cy="55" rx="45" ry="18" fill="${light(color)}" stroke="#5D4037" stroke-width="5"/><path d="M35 55 L48 117 C57 135 103 135 112 117 L125 55" fill="${color}" stroke="#5D4037" stroke-width="5"/><ellipse cx="80" cy="117" rx="33" ry="13" fill="#FFE0B2" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'bird') return `<path d="M45 86 C45 50 86 36 114 62 C135 84 116 118 78 118 C58 118 45 105 45 86Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M45 82 C22 71 21 105 47 103" fill="${light(color)}" stroke="#5D4037" stroke-width="5"/><path d="M113 77 L140 67 L120 91Z" fill="#FFA36C" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'piano') return `<rect x="30" y="55" width="100" height="58" rx="14" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="43" y="86" width="74" height="23" rx="5" fill="#fff" stroke="#5D4037" stroke-width="4"/><path d="M55 86 V108 M69 86 V108 M83 86 V108 M97 86 V108" stroke="#5D4037" stroke-width="3"/>`;
    if (kind === 'notecloud') return `<circle cx="54" cy="83" r="28" fill="${color}" stroke="#5D4037" stroke-width="5"/><circle cx="82" cy="67" r="34" fill="${color}" stroke="#5D4037" stroke-width="5"/><circle cx="111" cy="85" r="25" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="45" y="80" width="77" height="33" fill="${color}"/><path d="M52 43 V74 M52 43 L77 37 V68" stroke="#5D4037" stroke-width="6" stroke-linecap="round"/><circle cx="45" cy="76" r="9" fill="#FD79A8" stroke="#5D4037" stroke-width="4"/><circle cx="70" cy="70" r="9" fill="#FD79A8" stroke="#5D4037" stroke-width="4"/>`;
    // --- 水果 ---
    if (kind === 'apple') return `<circle cx="80" cy="84" r="46" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M78 38 C76 22 82 16 96 22" fill="none" stroke="#6BCB77" stroke-width="5" stroke-linecap="round"/><path d="M82 36 L92 24" fill="#6BCB77" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'banana') return `<path d="M48 52 C36 88 56 128 92 122 C128 116 132 78 108 52 C98 42 56 38 48 52Z" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'grape') return `<circle cx="68" cy="64" r="18" fill="${color}" stroke="#5D4037" stroke-width="4"/><circle cx="92" cy="64" r="18" fill="${color}" stroke="#5D4037" stroke-width="4"/><circle cx="56" cy="86" r="18" fill="${color}" stroke="#5D4037" stroke-width="4"/><circle cx="80" cy="86" r="18" fill="${color}" stroke="#5D4037" stroke-width="4"/><circle cx="104" cy="86" r="18" fill="${color}" stroke="#5D4037" stroke-width="4"/><circle cx="68" cy="108" r="18" fill="${color}" stroke="#5D4037" stroke-width="4"/><circle cx="92" cy="108" r="18" fill="${color}" stroke="#5D4037" stroke-width="4"/><path d="M80 46 L80 28" stroke="#6BCB77" stroke-width="5" stroke-linecap="round"/>`;
    if (kind === 'watermelon') return `<path d="M30 90 A52 52 0 0 1 130 90 Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M38 90 A44 44 0 0 1 122 90 Z" fill="#FF6B6B" stroke="#5D4037" stroke-width="3"/><circle cx="62" cy="82" r="3" fill="#5D4037"/><circle cx="80" cy="76" r="3" fill="#5D4037"/><circle cx="98" cy="82" r="3" fill="#5D4037"/><circle cx="72" cy="88" r="3" fill="#5D4037"/><circle cx="90" cy="88" r="3" fill="#5D4037"/>`;
    if (kind === 'orange') return `<circle cx="80" cy="84" r="46" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M76 40 L80 28 L84 40" fill="#6BCB77" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'lemon') return `<ellipse cx="80" cy="80" rx="52" ry="38" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M34 72 L22 64 M34 88 L22 96" stroke="#5D4037" stroke-width="4" stroke-linecap="round"/>`;
    // --- 天气 ---
    if (kind === 'rainbow') return `<path d="M28 110 A52 52 0 0 1 132 110" fill="none" stroke="#FF6B6B" stroke-width="8"/><path d="M34 110 A46 46 0 0 1 126 110" fill="none" stroke="#FFB347" stroke-width="8"/><path d="M40 110 A40 40 0 0 1 120 110" fill="none" stroke="#FFE066" stroke-width="8"/><path d="M46 110 A34 34 0 0 1 114 110" fill="none" stroke="#6BCB77" stroke-width="8"/><path d="M52 110 A28 28 0 0 1 108 110" fill="none" stroke="#74B9FF" stroke-width="8"/><path d="M58 110 A22 22 0 0 1 102 110" fill="none" stroke="#C77DFF" stroke-width="8"/><circle cx="36" cy="108" r="12" fill="#74B9FF" stroke="#5D4037" stroke-width="4"/><circle cx="122" cy="108" r="10" fill="#74B9FF" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'raindrop') return `<path d="M80 28 C106 62 118 92 80 128 C42 92 54 62 80 28Z" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'snowflake') return `<circle cx="80" cy="80" r="42" fill="${color}" stroke="#5D4037" stroke-width="5"/><g stroke="#5D4037" stroke-width="4" stroke-linecap="round"><line x1="80" y1="48" x2="80" y2="112"/><line x1="52" y1="64" x2="108" y2="96"/><line x1="52" y1="96" x2="108" y2="64"/><line x1="68" y1="52" x2="68" y2="68"/><line x1="92" y1="52" x2="92" y2="68"/><line x1="68" y1="92" x2="68" y2="108"/><line x1="92" y1="92" x2="92" y2="108"/></g>`;
    if (kind === 'wind') return `<circle cx="80" cy="80" r="44" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M42 68 C62 62 82 72 102 66 M46 80 C66 74 86 84 106 78 M42 92 C62 86 82 96 102 90" fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round"/>`;
    if (kind === 'thundy') return `<path d="M72 22 L54 78 H82 L66 138 L118 68 H86 L106 22Z" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'foggy') return `<ellipse cx="80" cy="80" rx="52" ry="42" fill="${color}" stroke="#5D4037" stroke-width="5"/><ellipse cx="60" cy="64" rx="28" ry="22" fill="${light(color)}" stroke="#5D4037" stroke-width="4"/><ellipse cx="100" cy="72" rx="24" ry="20" fill="${light(color)}" stroke="#5D4037" stroke-width="4"/>`;
    // --- 运动 ---
    if (kind === 'soccer') return `<circle cx="80" cy="80" r="46" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M80 34 L62 50 L68 72 H92 L98 50Z" fill="#fff" stroke="#5D4037" stroke-width="3"/><path d="M62 50 L38 58 L42 82 L68 72" fill="#fff" stroke="#5D4037" stroke-width="3"/><path d="M98 50 L122 58 L118 82 L92 72" fill="#fff" stroke="#5D4037" stroke-width="3"/><path d="M68 72 L62 102 L80 118 L98 102 L92 72" fill="#fff" stroke="#5D4037" stroke-width="3"/>`;
    if (kind === 'basketball') return `<circle cx="80" cy="80" r="46" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M34 80 H126 M80 34 V126" stroke="#5D4037" stroke-width="4"/><path d="M42 46 C62 72 62 88 42 114" fill="none" stroke="#5D4037" stroke-width="4"/><path d="M118 46 C98 72 98 88 118 114" fill="none" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'swimring') return `<ellipse cx="80" cy="80" rx="52" ry="38" fill="none" stroke="${color}" stroke-width="18"/><ellipse cx="80" cy="80" rx="52" ry="38" fill="none" stroke="#FF6B6B" stroke-width="18" stroke-dasharray="26 26"/><ellipse cx="80" cy="80" rx="52" ry="38" fill="none" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'runshoe') return `<path d="M36 92 C36 68 56 54 80 54 C104 54 124 68 124 92 V108 H36Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M36 108 H124" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/><path d="M52 68 L62 54 M72 62 L80 48 M92 62 L98 48" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="82" r="5" fill="#fff" stroke="#5D4037" stroke-width="3"/>`;
    if (kind === 'bike') return `<circle cx="52" cy="102" r="24" fill="none" stroke="${color}" stroke-width="6"/><circle cx="108" cy="102" r="24" fill="none" stroke="${color}" stroke-width="6"/><path d="M52 102 L72 68 H96 L108 102 M72 68 L80 102 M80 68 L96 48" stroke="#5D4037" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    if (kind === 'skate') return `<rect x="38" y="82" width="84" height="18" rx="8" fill="${color}" stroke="#5D4037" stroke-width="5"/><circle cx="56" cy="108" r="8" fill="#4E342E"/><circle cx="104" cy="108" r="8" fill="#4E342E"/><circle cx="80" cy="108" r="8" fill="#4E342E"/>`;
    // --- 节日 ---
    if (kind === 'xmastree') return `<path d="M80 22 L42 72 H58 L30 112 H130 L102 72 H118Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="68" y="112" width="24" height="22" rx="4" fill="#8D6E63" stroke="#5D4037" stroke-width="4"/><circle cx="80" cy="52" r="8" fill="#FFD93D" stroke="#5D4037" stroke-width="3"/><circle cx="64" cy="78" r="6" fill="#FF6B6B" stroke="#5D4037" stroke-width="3"/><circle cx="96" cy="78" r="6" fill="#74B9FF" stroke="#5D4037" stroke-width="3"/><circle cx="72" cy="102" r="6" fill="#FD79A8" stroke="#5D4037" stroke-width="3"/><circle cx="92" cy="102" r="6" fill="#C77DFF" stroke="#5D4037" stroke-width="3"/>`;
    if (kind === 'giftbox') return `<rect x="36" y="66" width="88" height="62" rx="8" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="28" y="46" width="104" height="28" rx="8" fill="${light(color)}" stroke="#5D4037" stroke-width="5"/><path d="M80 46 V128 M28 60 H132" stroke="#FFD93D" stroke-width="5"/><path d="M66 46 C52 32 68 18 80 36 C92 18 108 32 94 46" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/>`;
    if (kind === 'lantern') return `<ellipse cx="80" cy="82" rx="38" ry="48" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="62" y="30" width="36" height="12" rx="4" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/><path d="M68 132 H92 L86 142 H74Z" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/><line x1="62" y1="72" x2="98" y2="72" stroke="#FFD93D" stroke-width="3"/><line x1="60" y1="92" x2="100" y2="92" stroke="#FFD93D" stroke-width="3"/>`;
    if (kind === 'dumpling') return `<path d="M38 88 C38 56 122 56 122 88 Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M38 88 C38 108 122 108 122 88" fill="#FFF0D0" stroke="#5D4037" stroke-width="5"/><path d="M56 72 C68 64 92 64 104 72" fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round"/>`;
    if (kind === 'mooncake') return `<circle cx="80" cy="80" r="48" fill="${color}" stroke="#5D4037" stroke-width="5"/><circle cx="80" cy="80" r="36" fill="none" stroke="#5D4037" stroke-width="3"/><path d="M68 68 H92 V92 H68Z" fill="#8D6E63" stroke="#5D4037" stroke-width="3" rx="3"/>`;
    if (kind === 'pumpkin') return `<ellipse cx="64" cy="86" rx="28" ry="36" fill="${color}" stroke="#5D4037" stroke-width="5"/><ellipse cx="96" cy="86" rx="28" ry="36" fill="${light(color)}" stroke="#5D4037" stroke-width="5"/><path d="M78 50 L80 34 L82 50" fill="#6BCB77" stroke="#5D4037" stroke-width="4"/><path d="M80 34 L92 26" fill="none" stroke="#6BCB77" stroke-width="4" stroke-linecap="round"/>`;
    return `<circle cx="80" cy="80" r="52" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
}

function extras(kind) {
    const ear = `fill="#FFE1EA" stroke="#5D4037" stroke-width="5"`;
    const map = {
        pig: `<ellipse cx="48" cy="38" rx="16" ry="22" ${ear}/><ellipse cx="112" cy="38" rx="16" ry="22" ${ear}/><ellipse cx="80" cy="88" rx="22" ry="15" fill="#FFBED0" stroke="#5D4037" stroke-width="4"/><circle cx="73" cy="88" r="3" fill="#5D4037"/><circle cx="87" cy="88" r="3" fill="#5D4037"/>`,
        chick: `<path d="M48 44 C42 22 66 18 68 43" fill="#FFEA75" stroke="#5D4037" stroke-width="5"/><path d="M92 43 C96 18 121 24 111 47" fill="#FFEA75" stroke="#5D4037" stroke-width="5"/><path d="M78 82 L101 91 L78 101Z" fill="#FFA36C" stroke="#5D4037" stroke-width="4"/>`,
        captainchick: `<path d="M52 41 H108 L100 25 L88 39 L80 20 L72 39 L60 25Z" fill="#74B9FF" stroke="#5D4037" stroke-width="4"/><circle cx="80" cy="38" r="7" fill="#FFD93D" stroke="#5D4037" stroke-width="3"/><path d="M50 121 C62 136 98 136 110 121" fill="none" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/>`,
        flowerchick: `<g fill="#FD79A8" stroke="#5D4037" stroke-width="3">${[0,1,2,3,4].map(i => { const a = i * Math.PI * 2 / 5; return `<circle cx="${104 + Math.cos(a) * 9}" cy="${43 + Math.sin(a) * 9}" r="7"/>`; }).join('')}</g><circle cx="104" cy="43" r="5" fill="#FFD93D" stroke="#5D4037" stroke-width="2"/><path d="M48 118 Q64 130 80 118 Q96 130 112 118" fill="none" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/>`,
        babychick: `<path d="M51 39 C64 19 96 19 109 39 Q80 33 51 39Z" fill="#BEEBFF" stroke="#5D4037" stroke-width="4"/><circle cx="57" cy="126" r="7" fill="#FFA36C" stroke="#5D4037" stroke-width="3"/><circle cx="103" cy="126" r="7" fill="#FFA36C" stroke="#5D4037" stroke-width="3"/>`,
        pilotchick: `<path d="M43 50 C55 27 105 27 117 50 V61 H43Z" fill="#8D6E63" stroke="#5D4037" stroke-width="4"/><ellipse cx="61" cy="59" rx="15" ry="10" fill="#BEEBFF" stroke="#5D4037" stroke-width="3"/><ellipse cx="99" cy="59" rx="15" ry="10" fill="#BEEBFF" stroke="#5D4037" stroke-width="3"/><path d="M76 59 H84" stroke="#5D4037" stroke-width="3"/>`,
        bunny: `<ellipse cx="55" cy="27" rx="14" ry="36" fill="#fff" stroke="#5D4037" stroke-width="5"/><ellipse cx="105" cy="27" rx="14" ry="36" fill="#fff" stroke="#5D4037" stroke-width="5"/><ellipse cx="55" cy="30" rx="6" ry="24" fill="#FFBED0"/><ellipse cx="105" cy="30" rx="6" ry="24" fill="#FFBED0"/>`,
        bear: `<circle cx="43" cy="41" r="18" fill="#C98A54" stroke="#5D4037" stroke-width="5"/><circle cx="117" cy="41" r="18" fill="#C98A54" stroke="#5D4037" stroke-width="5"/><ellipse cx="80" cy="91" rx="22" ry="15" fill="#FFE0B2" stroke="#5D4037" stroke-width="4"/>`,
        cat: `<path d="M40 48 L53 17 L70 49" fill="#FFB6D5" stroke="#5D4037" stroke-width="5"/><path d="M90 49 L107 17 L120 48" fill="#FFB6D5" stroke="#5D4037" stroke-width="5"/><path d="M48 90 H20 M50 101 H23 M112 90 H140 M110 101 H137" stroke="#5D4037" stroke-width="4" stroke-linecap="round"/>`,
        puppy: `<ellipse cx="41" cy="64" rx="18" ry="30" fill="#9B6A43" stroke="#5D4037" stroke-width="5"/><ellipse cx="119" cy="64" rx="18" ry="30" fill="#9B6A43" stroke="#5D4037" stroke-width="5"/><ellipse cx="80" cy="92" rx="20" ry="13" fill="#FFE0B2" stroke="#5D4037" stroke-width="4"/>`,
        girl: `<path d="M39 76 C38 32 122 32 121 76 V106 C98 126 62 126 39 106Z" fill="#6D4C41" stroke="#5D4037" stroke-width="5"/><circle cx="80" cy="82" r="43" fill="#FFD6C9" stroke="#5D4037" stroke-width="5"/><path d="M50 55 C65 39 97 38 113 56 C96 51 68 51 50 55Z" fill="#6D4C41"/>`,
        boy: `<path d="M42 58 C48 26 116 26 120 62 C102 49 70 48 42 58Z" fill="#4D8FD9" stroke="#5D4037" stroke-width="5"/><circle cx="80" cy="83" r="44" fill="#FFD6C9" stroke="#5D4037" stroke-width="5"/>`,
        sprite: `<path d="M80 22 C112 42 123 79 80 132 C37 79 48 42 80 22Z" fill="#78D98B" stroke="#5D4037" stroke-width="5"/><path d="M36 58 C15 45 15 85 42 81 M124 58 C145 45 145 85 118 81" fill="#B8F2C2" stroke="#5D4037" stroke-width="4"/>`,
        cloud: `<circle cx="54" cy="83" r="28" fill="#BEEBFF" stroke="#5D4037" stroke-width="5"/><circle cx="82" cy="67" r="34" fill="#BEEBFF" stroke="#5D4037" stroke-width="5"/><circle cx="111" cy="85" r="25" fill="#BEEBFF" stroke="#5D4037" stroke-width="5"/><rect x="45" y="80" width="77" height="33" fill="#BEEBFF"/>`,
        dino: `<circle cx="118" cy="62" r="4" fill="#3E2723"/><path d="M124 80 Q136 85 145 75" fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round"/>`,
        drum: `<path d="M37 33 L66 55 M123 33 L94 55" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/><circle cx="35" cy="31" r="6" fill="#FFD93D" stroke="#5D4037" stroke-width="3"/><circle cx="125" cy="31" r="6" fill="#FFD93D" stroke="#5D4037" stroke-width="3"/>`,
        bird: `<path d="M70 36 C69 18 92 20 88 40" fill="#FFD93D" stroke="#5D4037" stroke-width="4"/>`
    };
    return map[kind] || '';
}

function face(kind) {
    const y = ['car', 'train', 'rocket', 'balloon', 'berry', 'sun', 'mushroom', 'flower', 'planet', 'bigstar', 'moon', 'drum', 'piano', 'notecloud', 'apple', 'banana', 'grape', 'watermelon', 'orange', 'lemon', 'rainbow', 'raindrop', 'snowflake', 'wind', 'thundy', 'foggy', 'soccer', 'basketball', 'swimring', 'runshoe', 'bike', 'skate', 'xmastree', 'giftbox', 'lantern', 'dumpling', 'mooncake', 'pumpkin'].includes(kind) ? 78 : 73;
    return `<circle cx="62" cy="${y}" r="7" fill="#3E2723"/><circle cx="98" cy="${y}" r="7" fill="#3E2723"/><circle cx="59" cy="${y - 3}" r="2.2" fill="#fff"/><circle cx="95" cy="${y - 3}" r="2.2" fill="#fff"/><path d="M66 ${y + 23} Q80 ${y + 35} 94 ${y + 23}" fill="none" stroke="#3E2723" stroke-width="5" stroke-linecap="round"/>`;
}

function light(color) {
    if (color === '#74B9FF') return '#DDF3FF';
    if (color === '#B2BEC3') return '#E8ECEF';
    if (color === '#DFE6E9') return '#F0F3F5';
    if (color === '#FF8A65') return '#FFE0B2';
    return '#FFF8E7';
}
