// === 卡通贴图库 ===
// 主体为 AI 生成的 512×512 透明 PNG（assets/stickers/<分类>/<id>.png，入库规范见 docs/贴纸生成提示词.md）。
// 另保留 4 个程序化 SVG 贴纸（太阳哥哥/蘑菇仔/花朵妹妹/跑步伙伴）作为无 PNG 版主体的兜底，
// 角色设计为通用卡通风格，不引用或模仿任何已知商业 IP。
// PNG 素材条目工厂：路径与 assets/stickers/<category>/<id>.png 一一对应
function pngSticker(category, id, name) {
    return { id, name, assetType: 'png', source: 'assets/stickers/' + category + '/' + id + '.png' };
}

const StickerLibrary = {
    categories: {
        friends: { label: '伙伴', stickers: ['piggy', 'bunny', 'honeybear', 'starcat', 'puppy', 'scarfpig'] },
        chicks: { label: '小鸡一家', stickers: ['captainchick', 'flowerchick', 'fluffychick', 'pilotchick'] },
        fairytale: { label: '童话', stickers: ['girl', 'boy', 'leafelf', 'cloudbaby'] },
        toys: { label: '玩具', stickers: ['smilecar', 'dinorocket', 'hearttrain', 'balloonbear'] },
        desserts: { label: '甜点', stickers: ['strawberrycake', 'icecream', 'macarons', 'donut'] },
        ocean: { label: '海洋', stickers: ['dolphinkid', 'bluewhale', 'octopus', 'jellyfish', 'pufferfish', 'crab'] },
        dinosaurs: { label: '恐龙', stickers: ['greendino', 'bowdino', 'hatchling', 'volcanodino'] },
        space: { label: '太空', stickers: ['moonbaby', 'starfairy', 'planetkid', 'alien'] },
        music: { label: '音乐', stickers: ['drumbear', 'songbird', 'pianocat', 'notecloud'] },
        fruits: { label: '水果', stickers: ['apple', 'banana', 'grapes', 'watermelon', 'orange', 'lemon'] },
        weather: { label: '天气', stickers: ['rainbowcloud', 'sunny', 'raindrop', 'snowflake', 'windbaby', 'lightning', 'fogkid'] },
        sports: { label: '运动', stickers: ['footballkid', 'basketballfawn', 'swimfish', 'tennisbunny', 'skateboardbear', 'trophycat', 'runbuddy'] },
        festivals: { label: '节日', stickers: ['christmastree', 'ribbonpresent', 'lanternbunny', 'tangyuan', 'mooncake', 'witchpumpkin'] },
        vehicles: { label: '交通', stickers: ['firetruck', 'bus', 'hotairballoon', 'steamtrain', 'sailboat', 'helicopter', 'tractor', 'ambulance', 'submarine', 'bicycle'] },
        wildlife: { label: '动物', stickers: ['lion', 'elephant', 'giraffe', 'monkey', 'panda', 'fox', 'owl', 'raccoon', 'kangaroo', 'sloth'] },
        garden: { label: '花园', stickers: ['ladybug', 'bee', 'snail', 'caterpillar', 'dragonfly', 'ants', 'sunflower', 'cactus', 'dandelion', 'mushroomhouse', 'mushroomkid', 'flowerkid'] },
        meals: { label: '美食', stickers: ['noodles', 'dumplings', 'sushi', 'friedegg', 'milk', 'toast', 'burger', 'corn', 'riceball', 'dango'] },
        emotions: { label: '表情', stickers: ['laugh', 'angry', 'cry', 'surprised', 'shy', 'sleepy', 'proud', 'love'] },
        careers: { label: '职业', stickers: ['doctor', 'firefighter', 'astronaut', 'chef', 'police', 'painter', 'teacher', 'champion'] },
        birthday: { label: '生日', stickers: ['birthdaycake', 'giftbox', 'balloons', 'partyhat', 'candle', 'bunting', 'lollipop', 'horn'] },
        monsters: { label: '怪兽', stickers: ['oneeyemonster', 'threeeyemonster', 'jellymonster', 'longneckmonster', 'cloudmonster', 'squaremonster'] }
    },

    items: [
        // --- 伙伴 ---
        pngSticker('friends', 'piggy', '小粉猪'),
        pngSticker('friends', 'bunny', '跳跳兔'),
        pngSticker('friends', 'honeybear', '抱抱熊'),
        pngSticker('friends', 'starcat', '星星猫'),
        pngSticker('friends', 'puppy', '圆耳狗'),
        pngSticker('friends', 'scarfpig', '围巾猪猪'),
        // --- 小鸡一家 ---
        pngSticker('chicks', 'captainchick', '队长小鸡'),
        pngSticker('chicks', 'flowerchick', '花花小鸡'),
        pngSticker('chicks', 'fluffychick', '绒绒小鸡'),
        pngSticker('chicks', 'pilotchick', '飞飞小鸡'),
        // --- 童话 ---
        pngSticker('fairytale', 'girl', '笑笑女孩'),
        pngSticker('fairytale', 'boy', '太阳男孩'),
        pngSticker('fairytale', 'leafelf', '叶子精灵'),
        pngSticker('fairytale', 'cloudbaby', '云朵宝宝'),
        // --- 玩具 ---
        pngSticker('toys', 'smilecar', '笑脸小车'),
        pngSticker('toys', 'dinorocket', '火箭小恐龙'),
        pngSticker('toys', 'hearttrain', '爱心火车'),
        pngSticker('toys', 'balloonbear', '气球小熊'),
        // --- 甜点 ---
        pngSticker('desserts', 'strawberrycake', '草莓蛋糕'),
        pngSticker('desserts', 'icecream', '冰淇淋'),
        pngSticker('desserts', 'macarons', '马卡龙'),
        pngSticker('desserts', 'donut', '甜甜圈'),
        // --- 海洋 ---
        pngSticker('ocean', 'dolphinkid', '海豚宝宝'),
        pngSticker('ocean', 'bluewhale', '鲸鱼船长'),
        pngSticker('ocean', 'octopus', '章鱼朋友'),
        pngSticker('ocean', 'jellyfish', '水母妹妹'),
        pngSticker('ocean', 'pufferfish', '河豚嘟嘟'),
        pngSticker('ocean', 'crab', '螃蟹先生'),
        // --- 恐龙 ---
        pngSticker('dinosaurs', 'greendino', '绿恐龙'),
        pngSticker('dinosaurs', 'bowdino', '粉恐龙'),
        pngSticker('dinosaurs', 'hatchling', '蛋壳龙'),
        pngSticker('dinosaurs', 'volcanodino', '火山龙'),
        // --- 太空 ---
        pngSticker('space', 'moonbaby', '月亮宝宝'),
        pngSticker('space', 'starfairy', '星星精灵'),
        pngSticker('space', 'planetkid', '行星朋友'),
        pngSticker('space', 'alien', '小外星人'),
        // --- 音乐 ---
        pngSticker('music', 'drumbear', '鼓鼓熊'),
        pngSticker('music', 'songbird', '唱歌小鸟'),
        pngSticker('music', 'pianocat', '钢琴猫'),
        pngSticker('music', 'notecloud', '音符云'),
        // --- 水果 ---
        pngSticker('fruits', 'apple', '苹果宝宝'),
        pngSticker('fruits', 'banana', '香蕉弟弟'),
        pngSticker('fruits', 'grapes', '葡萄姐妹'),
        pngSticker('fruits', 'watermelon', '西瓜胖胖'),
        pngSticker('fruits', 'orange', '橙子圆圆'),
        pngSticker('fruits', 'lemon', '柠檬酸酸'),
        // --- 天气 ---
        pngSticker('weather', 'rainbowcloud', '彩虹桥'),
        { id: 'sunny', name: '太阳哥哥', assetType: 'svg', source: makeStickerSvg('#FFD93D', 'sun') },
        pngSticker('weather', 'raindrop', '小雨滴'),
        pngSticker('weather', 'snowflake', '雪花仙子'),
        pngSticker('weather', 'windbaby', '风宝宝'),
        pngSticker('weather', 'lightning', '闪电伙伴'),
        pngSticker('weather', 'fogkid', '雾雾精灵'),
        // --- 运动 ---
        pngSticker('sports', 'footballkid', '足球小子'),
        pngSticker('sports', 'basketballfawn', '篮球小鹿'),
        pngSticker('sports', 'swimfish', '游泳小鱼'),
        pngSticker('sports', 'tennisbunny', '网球小兔'),
        pngSticker('sports', 'skateboardbear', '滑板小熊'),
        pngSticker('sports', 'trophycat', '奖杯小猫'),
        { id: 'runbuddy', name: '跑步伙伴', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'runshoe') },
        // --- 节日 ---
        pngSticker('festivals', 'christmastree', '圣诞树'),
        pngSticker('festivals', 'ribbonpresent', '礼物盒'),
        pngSticker('festivals', 'lanternbunny', '灯笼兔'),
        pngSticker('festivals', 'tangyuan', '小汤圆'),
        pngSticker('festivals', 'mooncake', '月饼圆圆'),
        pngSticker('festivals', 'witchpumpkin', '南瓜灯'),
        // --- 交通工具 ---
        pngSticker('vehicles', 'firetruck', '消防车'),
        pngSticker('vehicles', 'bus', '小巴士'),
        pngSticker('vehicles', 'hotairballoon', '热气球'),
        pngSticker('vehicles', 'steamtrain', '小火车'),
        pngSticker('vehicles', 'sailboat', '小帆船'),
        pngSticker('vehicles', 'helicopter', '直升机'),
        pngSticker('vehicles', 'tractor', '拖拉机'),
        pngSticker('vehicles', 'ambulance', '救护车'),
        pngSticker('vehicles', 'submarine', '潜水艇'),
        pngSticker('vehicles', 'bicycle', '自行车'),
        // --- 野生动物 ---
        pngSticker('wildlife', 'lion', '小狮子'),
        pngSticker('wildlife', 'elephant', '小象'),
        pngSticker('wildlife', 'giraffe', '长颈鹿'),
        pngSticker('wildlife', 'monkey', '小猴子'),
        pngSticker('wildlife', 'panda', '大熊猫'),
        pngSticker('wildlife', 'fox', '小狐狸'),
        pngSticker('wildlife', 'owl', '猫头鹰'),
        pngSticker('wildlife', 'raccoon', '小浣熊'),
        pngSticker('wildlife', 'kangaroo', '袋鼠宝宝'),
        pngSticker('wildlife', 'sloth', '树懒'),
        // --- 昆虫与花园 ---
        pngSticker('garden', 'ladybug', '瓢虫'),
        pngSticker('garden', 'bee', '小蜜蜂'),
        pngSticker('garden', 'snail', '小蜗牛'),
        pngSticker('garden', 'caterpillar', '毛毛虫'),
        pngSticker('garden', 'dragonfly', '蜻蜓'),
        pngSticker('garden', 'ants', '小蚂蚁'),
        pngSticker('garden', 'sunflower', '向日葵'),
        pngSticker('garden', 'cactus', '仙人掌'),
        pngSticker('garden', 'dandelion', '蒲公英'),
        pngSticker('garden', 'mushroomhouse', '蘑菇小屋'),
        { id: 'mushroomkid', name: '蘑菇仔', assetType: 'svg', source: makeStickerSvg('#FF6B6B', 'mushroom') },
        { id: 'flowerkid', name: '花朵妹妹', assetType: 'svg', source: makeStickerSvg('#FDCB6E', 'flower') },
        // --- 美食正餐 ---
        pngSticker('meals', 'noodles', '面条碗'),
        pngSticker('meals', 'dumplings', '小笼包'),
        pngSticker('meals', 'sushi', '寿司'),
        pngSticker('meals', 'friedegg', '煎蛋'),
        pngSticker('meals', 'milk', '牛奶杯'),
        pngSticker('meals', 'toast', '果酱吐司'),
        pngSticker('meals', 'burger', '小汉堡'),
        pngSticker('meals', 'corn', '甜玉米'),
        pngSticker('meals', 'riceball', '饭团'),
        pngSticker('meals', 'dango', '团子串'),
        // --- 情绪表情 ---
        pngSticker('emotions', 'laugh', '哈哈大笑'),
        pngSticker('emotions', 'angry', '生气'),
        pngSticker('emotions', 'cry', '委屈'),
        pngSticker('emotions', 'surprised', '惊讶'),
        pngSticker('emotions', 'shy', '害羞'),
        pngSticker('emotions', 'sleepy', '困困'),
        pngSticker('emotions', 'proud', '得意'),
        pngSticker('emotions', 'love', '爱心眼'),
        // --- 职业梦想 ---
        pngSticker('careers', 'doctor', '小医生'),
        pngSticker('careers', 'firefighter', '消防员'),
        pngSticker('careers', 'astronaut', '宇航员'),
        pngSticker('careers', 'chef', '小厨师'),
        pngSticker('careers', 'police', '小警察'),
        pngSticker('careers', 'painter', '小画家'),
        pngSticker('careers', 'teacher', '小老师'),
        pngSticker('careers', 'champion', '小冠军'),
        // --- 生日派对 ---
        pngSticker('birthday', 'birthdaycake', '生日蛋糕'),
        pngSticker('birthday', 'giftbox', '礼物盒'),
        pngSticker('birthday', 'balloons', '五彩气球'),
        pngSticker('birthday', 'partyhat', '派对帽'),
        pngSticker('birthday', 'candle', '小蜡烛'),
        pngSticker('birthday', 'bunting', '三角彩旗'),
        pngSticker('birthday', 'lollipop', '螺旋糖'),
        pngSticker('birthday', 'horn', '小喇叭'),
        // --- 可爱怪兽 ---
        pngSticker('monsters', 'oneeyemonster', '独眼怪'),
        pngSticker('monsters', 'threeeyemonster', '三眼怪'),
        pngSticker('monsters', 'jellymonster', '果冻怪'),
        pngSticker('monsters', 'longneckmonster', '长脖怪'),
        pngSticker('monsters', 'cloudmonster', '云朵怪'),
        pngSticker('monsters', 'squaremonster', '方方怪')
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
    ${face(kind)}
    <ellipse cx="56" cy="88" rx="10" ry="6" fill="#FF8FB3" opacity=".65"/>
    <ellipse cx="104" cy="88" rx="10" ry="6" fill="#FF8FB3" opacity=".65"/>
  </g>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
}

function bodyShape(kind, color) {
    if (kind === 'sun') return `<g stroke="#5D4037" stroke-width="5" stroke-linecap="round">${Array.from({length: 10}, (_, i) => { const a = i * Math.PI / 5; const x1 = 80 + Math.cos(a) * 50; const y1 = 80 + Math.sin(a) * 50; const x2 = 80 + Math.cos(a) * 68; const y2 = 80 + Math.sin(a) * 68; return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }).join('')}</g><circle cx="80" cy="80" r="48" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'mushroom') return `<path d="M33 75 C42 34 118 34 127 75 Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><rect x="59" y="72" width="42" height="56" rx="18" fill="#FFF8E7" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'flower') return `<g fill="${color}" stroke="#5D4037" stroke-width="5">${[0,1,2,3,4,5].map(i => { const a = i * Math.PI / 3; return `<ellipse cx="${80 + Math.cos(a) * 30}" cy="${74 + Math.sin(a) * 30}" rx="22" ry="30" transform="rotate(${i * 60} ${80 + Math.cos(a) * 30} ${74 + Math.sin(a) * 30})"/>`; }).join('')}</g><circle cx="80" cy="74" r="25" fill="#FFD93D" stroke="#5D4037" stroke-width="5"/>`;
    if (kind === 'runshoe') return `<path d="M36 92 C36 68 56 54 80 54 C104 54 124 68 124 92 V108 H36Z" fill="${color}" stroke="#5D4037" stroke-width="5"/><path d="M36 108 H124" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/><path d="M52 68 L62 54 M72 62 L80 48 M92 62 L98 48" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="82" r="5" fill="#fff" stroke="#5D4037" stroke-width="3"/>`;
    return `<circle cx="80" cy="80" r="52" fill="${color}" stroke="#5D4037" stroke-width="5"/>`;
}

function face(kind) {
    const y = ['sun', 'mushroom', 'flower', 'runshoe'].includes(kind) ? 78 : 73;
    return `<circle cx="62" cy="${y}" r="7" fill="#3E2723"/><circle cx="98" cy="${y}" r="7" fill="#3E2723"/><circle cx="59" cy="${y - 3}" r="2.2" fill="#fff"/><circle cx="95" cy="${y - 3}" r="2.2" fill="#fff"/><path d="M66 ${y + 23} Q80 ${y + 35} 94 ${y + 23}" fill="none" stroke="#3E2723" stroke-width="5" stroke-linecap="round"/>`;
}
