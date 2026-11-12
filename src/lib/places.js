import { haversine } from './geo.js';

export const PLACES = [
  { name: '北京', alias: 'beijing', country: '中国', admin1: '北京', lat: 39.9042, lng: 116.4074 },
  { name: '上海', alias: 'shanghai', country: '中国', admin1: '上海', lat: 31.2304, lng: 121.4737 },
  { name: '广州', alias: 'guangzhou', country: '中国', admin1: '广东', lat: 23.1291, lng: 113.2644 },
  { name: '深圳', alias: 'shenzhen', country: '中国', admin1: '广东', lat: 22.5431, lng: 114.0579 },
  { name: '成都', alias: 'chengdu', country: '中国', admin1: '四川', lat: 30.5728, lng: 104.0668 },
  { name: '重庆', alias: 'chongqing', country: '中国', admin1: '重庆', lat: 29.563, lng: 106.5516 },
  { name: '杭州', alias: 'hangzhou', country: '中国', admin1: '浙江', lat: 30.2741, lng: 120.1551 },
  { name: '绍兴', alias: 'shaoxing', country: '中国', admin1: '浙江', lat: 30.0, lng: 120.582 },
  { name: '南京', alias: 'nanjing', country: '中国', admin1: '江苏', lat: 32.0603, lng: 118.7969 },
  { name: '苏州', alias: 'suzhou', country: '中国', admin1: '江苏', lat: 31.2989, lng: 120.5853 },
  { name: '武汉', alias: 'wuhan', country: '中国', admin1: '湖北', lat: 30.5928, lng: 114.3055 },
  { name: '西安', alias: 'xian', country: '中国', admin1: '陕西', lat: 34.3416, lng: 108.9398 },
  { name: '天津', alias: 'tianjin', country: '中国', admin1: '天津', lat: 39.3434, lng: 117.3616 },
  { name: '长沙', alias: 'changsha', country: '中国', admin1: '湖南', lat: 28.2282, lng: 112.9388 },
  { name: '郑州', alias: 'zhengzhou', country: '中国', admin1: '河南', lat: 34.7466, lng: 113.6254 },
  { name: '青岛', alias: 'qingdao', country: '中国', admin1: '山东', lat: 36.0671, lng: 120.3826 },
  { name: '厦门', alias: 'xiamen', country: '中国', admin1: '福建', lat: 24.4798, lng: 118.0894 },
  { name: '昆明', alias: 'kunming', country: '中国', admin1: '云南', lat: 25.0389, lng: 102.7183 },
  { name: '大理', alias: 'dali', country: '中国', admin1: '云南', lat: 25.6065, lng: 100.2676 },
  { name: '丽江', alias: 'lijiang', country: '中国', admin1: '云南', lat: 26.855, lng: 100.227 },
  { name: '桂林', alias: 'guilin', country: '中国', admin1: '广西', lat: 25.2736, lng: 110.29 },
  { name: '三亚', alias: 'sanya', country: '中国', admin1: '海南', lat: 18.2528, lng: 109.5119 },
  { name: '哈尔滨', alias: 'harbin', country: '中国', admin1: '黑龙江', lat: 45.8038, lng: 126.535 },
  { name: '沈阳', alias: 'shenyang', country: '中国', admin1: '辽宁', lat: 41.8057, lng: 123.4315 },
  { name: '大连', alias: 'dalian', country: '中国', admin1: '辽宁', lat: 38.914, lng: 121.6147 },
  { name: '拉萨', alias: 'lhasa', country: '中国', admin1: '西藏', lat: 29.652, lng: 91.1721 },
  { name: '乌鲁木齐', alias: 'urumqi', country: '中国', admin1: '新疆', lat: 43.8256, lng: 87.6168 },
  { name: '香港', alias: 'hong kong', country: '中国', admin1: '香港', lat: 22.3193, lng: 114.1694 },
  { name: '澳门', alias: 'macau', country: '中国', admin1: '澳门', lat: 22.1987, lng: 113.5439 },
  { name: '台北', alias: 'taipei', country: '中国', admin1: '台湾', lat: 25.033, lng: 121.5654 },
  { name: '东京', alias: 'tokyo', country: '日本', admin1: '东京都', lat: 35.6762, lng: 139.6503 },
  { name: '大阪', alias: 'osaka', country: '日本', admin1: '大阪府', lat: 34.6937, lng: 135.5023 },
  { name: '京都', alias: 'kyoto', country: '日本', admin1: '京都府', lat: 35.0116, lng: 135.7681 },
  { name: '札幌', alias: 'sapporo', country: '日本', admin1: '北海道', lat: 43.0618, lng: 141.3545 },
  { name: '福冈', alias: 'fukuoka', country: '日本', admin1: '福冈县', lat: 33.5902, lng: 130.4017 },
  { name: '首尔', alias: 'seoul', country: '韩国', admin1: '首尔', lat: 37.5665, lng: 126.978 },
  { name: '釜山', alias: 'busan', country: '韩国', admin1: '釜山', lat: 35.1796, lng: 129.0756 },
  { name: '新加坡', alias: 'singapore', country: '新加坡', admin1: '', lat: 1.3521, lng: 103.8198 },
  { name: '曼谷', alias: 'bangkok', country: '泰国', admin1: '曼谷', lat: 13.7563, lng: 100.5018 },
  { name: '清迈', alias: 'chiang mai', country: '泰国', admin1: '清迈', lat: 18.7883, lng: 98.9853 },
  { name: '吉隆坡', alias: 'kuala lumpur', country: '马来西亚', admin1: '', lat: 3.139, lng: 101.6869 },
  { name: '巴厘岛', alias: 'bali', country: '印度尼西亚', admin1: '巴厘', lat: -8.4095, lng: 115.1889 },
  { name: '河内', alias: 'hanoi', country: '越南', admin1: '', lat: 21.0278, lng: 105.8342 },
  { name: '胡志明市', alias: 'ho chi minh', country: '越南', admin1: '', lat: 10.8231, lng: 106.6297 },
  { name: '新德里', alias: 'delhi', country: '印度', admin1: '德里', lat: 28.6139, lng: 77.209 },
  { name: '迪拜', alias: 'dubai', country: '阿联酋', admin1: '迪拜', lat: 25.2048, lng: 55.2708 },
  { name: '伊斯坦布尔', alias: 'istanbul', country: '土耳其', admin1: '伊斯坦布尔', lat: 41.0082, lng: 28.9784 },
  { name: '莫斯科', alias: 'moscow', country: '俄罗斯', admin1: '莫斯科', lat: 55.7558, lng: 37.6173 },
  { name: '巴黎', alias: 'paris', country: '法国', admin1: '法兰西岛', lat: 48.8566, lng: 2.3522 },
  { name: '里昂', alias: 'lyon', country: '法国', admin1: '奥弗涅-罗讷-阿尔卑斯', lat: 45.764, lng: 4.8357 },
  { name: '马赛', alias: 'marseille', country: '法国', admin1: '普罗旺斯', lat: 43.2965, lng: 5.3698 },
  { name: '尼斯', alias: 'nice', country: '法国', admin1: '普罗旺斯', lat: 43.7102, lng: 7.262 },
  { name: '伦敦', alias: 'london', country: '英国', admin1: '英格兰', lat: 51.5072, lng: -0.1276 },
  { name: '爱丁堡', alias: 'edinburgh', country: '英国', admin1: '苏格兰', lat: 55.9533, lng: -3.1883 },
  { name: '罗马', alias: 'rome', country: '意大利', admin1: '拉齐奥', lat: 41.9028, lng: 12.4964 },
  { name: '米兰', alias: 'milan', country: '意大利', admin1: '伦巴第', lat: 45.4642, lng: 9.19 },
  { name: '威尼斯', alias: 'venice', country: '意大利', admin1: '威尼托', lat: 45.4408, lng: 12.3155 },
  { name: '佛罗伦萨', alias: 'florence', country: '意大利', admin1: '托斯卡纳', lat: 43.7696, lng: 11.2558 },
  { name: '巴塞罗那', alias: 'barcelona', country: '西班牙', admin1: '加泰罗尼亚', lat: 41.3874, lng: 2.1686 },
  { name: '马德里', alias: 'madrid', country: '西班牙', admin1: '马德里', lat: 40.4168, lng: -3.7038 },
  { name: '里斯本', alias: 'lisbon', country: '葡萄牙', admin1: '里斯本', lat: 38.7223, lng: -9.1393 },
  { name: '阿姆斯特丹', alias: 'amsterdam', country: '荷兰', admin1: '北荷兰', lat: 52.3676, lng: 4.9041 },
  { name: '布鲁塞尔', alias: 'brussels', country: '比利时', admin1: '布鲁塞尔', lat: 50.8503, lng: 4.3517 },
  { name: '柏林', alias: 'berlin', country: '德国', admin1: '柏林', lat: 52.52, lng: 13.405 },
  { name: '慕尼黑', alias: 'munich', country: '德国', admin1: '巴伐利亚', lat: 48.1351, lng: 11.582 },
  { name: '维也纳', alias: 'vienna', country: '奥地利', admin1: '维也纳', lat: 48.2082, lng: 16.3738 },
  { name: '布拉格', alias: 'prague', country: '捷克', admin1: '布拉格', lat: 50.0755, lng: 14.4378 },
  { name: '苏黎世', alias: 'zurich', country: '瑞士', admin1: '苏黎世', lat: 47.3769, lng: 8.5417 },
  { name: '哥本哈根', alias: 'copenhagen', country: '丹麦', admin1: '首都大区', lat: 55.6761, lng: 12.5683 },
  { name: '斯德哥尔摩', alias: 'stockholm', country: '瑞典', admin1: '斯德哥尔摩', lat: 59.3293, lng: 18.0686 },
  { name: '奥斯陆', alias: 'oslo', country: '挪威', admin1: '奥斯陆', lat: 59.9139, lng: 10.7522 },
  { name: '赫尔辛基', alias: 'helsinki', country: '芬兰', admin1: '乌西马', lat: 60.1699, lng: 24.9384 },
  { name: '雷克雅未克', alias: 'reykjavik', country: '冰岛', admin1: '', lat: 64.1466, lng: -21.9426 },
  { name: '雅典', alias: 'athens', country: '希腊', admin1: '阿提卡', lat: 37.9838, lng: 23.7275 },
  { name: '纽约', alias: 'new york', country: '美国', admin1: '纽约州', lat: 40.7128, lng: -74.006 },
  { name: '洛杉矶', alias: 'los angeles', country: '美国', admin1: '加利福尼亚', lat: 34.0522, lng: -118.2437 },
  { name: '旧金山', alias: 'san francisco', country: '美国', admin1: '加利福尼亚', lat: 37.7749, lng: -122.4194 },
  { name: '西雅图', alias: 'seattle', country: '美国', admin1: '华盛顿州', lat: 47.6062, lng: -122.3321 },
  { name: '芝加哥', alias: 'chicago', country: '美国', admin1: '伊利诺伊', lat: 41.8781, lng: -87.6298 },
  { name: '迈阿密', alias: 'miami', country: '美国', admin1: '佛罗里达', lat: 25.7617, lng: -80.1918 },
  { name: '檀香山', alias: 'honolulu', country: '美国', admin1: '夏威夷', lat: 21.3069, lng: -157.8583 },
  { name: '温哥华', alias: 'vancouver', country: '加拿大', admin1: '不列颠哥伦比亚', lat: 49.2827, lng: -123.1207 },
  { name: '多伦多', alias: 'toronto', country: '加拿大', admin1: '安大略', lat: 43.6532, lng: -79.3832 },
  { name: '墨西哥城', alias: 'mexico city', country: '墨西哥', admin1: '', lat: 19.4326, lng: -99.1332 },
  { name: '里约热内卢', alias: 'rio', country: '巴西', admin1: '里约热内卢', lat: -22.9068, lng: -43.1729 },
  { name: '布宜诺斯艾利斯', alias: 'buenos aires', country: '阿根廷', admin1: '', lat: -34.6037, lng: -58.3816 },
  { name: '开罗', alias: 'cairo', country: '埃及', admin1: '开罗', lat: 30.0444, lng: 31.2357 },
  { name: '马拉喀什', alias: 'marrakesh', country: '摩洛哥', admin1: '马拉喀什', lat: 31.6295, lng: -7.9811 },
  { name: '开普敦', alias: 'cape town', country: '南非', admin1: '西开普', lat: -33.9249, lng: 18.4241 },
  { name: '内罗毕', alias: 'nairobi', country: '肯尼亚', admin1: '内罗毕', lat: -1.2921, lng: 36.8219 },
  { name: '悉尼', alias: 'sydney', country: '澳大利亚', admin1: '新南威尔士', lat: -33.8688, lng: 151.2093 },
  { name: '墨尔本', alias: 'melbourne', country: '澳大利亚', admin1: '维多利亚', lat: -37.8136, lng: 144.9631 },
  { name: '皇后镇', alias: 'queenstown', country: '新西兰', admin1: '奥塔哥', lat: -45.0312, lng: 168.6626 },
  { name: '奥克兰', alias: 'auckland', country: '新西兰', admin1: '奥克兰', lat: -36.8509, lng: 174.7645 },
];

function byName(name) {
  const place = PLACES.find((item) => item.name === name);
  if (!place) throw new Error(`缺少城市 ${name}`);
  return place;
}

export const PRESETS = [
  {
    title: '东亚连线',
    stops: ['上海', '东京', '大阪', '京都'].map(byName),
    modes: ['plane', 'rail', 'car'],
  },
  {
    title: '京沪杭',
    stops: ['北京', '南京', '上海', '杭州', '绍兴'].map(byName),
    modes: ['rail', 'rail', 'rail', 'car'],
  },
  {
    title: '欧洲海岸',
    stops: ['巴黎', '里昂', '马赛', '尼斯'].map(byName),
    modes: ['rail', 'rail', 'car'],
  },
  {
    title: '洲际飞行',
    stops: ['纽约', '伦敦', '伊斯坦布尔', '新加坡', '悉尼'].map(byName),
    modes: ['plane', 'plane', 'plane', 'plane'],
  },
];

export const POPULAR = ['北京', '上海', '成都', '杭州', '东京', '巴黎', '纽约', '伦敦', '新加坡', '悉尼'].map(byName);

function normalizeQuery(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function filterLocal(query) {
  const q = normalizeQuery(query);
  if (!q) return POPULAR;
  const scored = [];
  for (const place of PLACES) {
    const name = place.name.toLowerCase();
    const alias = (place.alias || '').replace(/\s+/g, '');
    const blob = `${name}${alias}${(place.country || '').toLowerCase()}${(place.admin1 || '').toLowerCase()}`;
    if (!blob.includes(q)) continue;
    let score = 20;
    if (name === q || alias === q) score = 100;
    else if (name.startsWith(q) || alias.startsWith(q)) score = 80;
    else if (name.includes(q) || alias.includes(q)) score = 60;
    scored.push({ place, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map((item) => ({ ...item.place, curated: true }));
}

function bareName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/(特别行政区|自治州|地区|盟|市|省|县|区)$/u, '');
}

function scorePlace(place, query) {
  const name = bareName(place.name);
  const q = bareName(query);
  let score = 0;
  if (q && name === q) score += 1000;
  else if (q && name.startsWith(q)) score += 500;
  else if (q && name.includes(q)) score += 200;
  if (place.curated) score += 320;
  if (place.population > 0) score += Math.log10(place.population) * 120;
  if (place.feature === 'PPLC') score += 180;
  else if (place.feature === 'PPLA') score += 140;
  else if (place.feature === 'PPLA2') score += 70;
  if (place.importance) score += place.importance * 200;
  return score;
}

function mapRemote(result) {
  return {
    name: result.name,
    country: result.country || '',
    admin1: result.admin1 || '',
    lat: result.latitude,
    lng: result.longitude,
    population: result.population || 0,
    feature: result.feature_code || '',
  };
}

function dedupe(list, query = '') {
  const kept = [];
  for (const place of list) {
    const index = kept.findIndex((item) => haversine(item, place) < 30);
    if (index === -1) {
      kept.push(place);
      continue;
    }
    const current = kept[index];
    const placeWins = scorePlace(place, query) >= scorePlace(current, query);
    const winner = placeWins ? place : current;
    const other = placeWins ? current : place;
    kept[index] = {
      ...winner,
      population: winner.population || other.population,
      feature: winner.feature || other.feature,
      importance: winner.importance || other.importance,
      admin1: winner.admin1 || other.admin1,
      country: winner.country || other.country,
    };
  }
  return kept;
}

function isMajor(place) {
  return (
    place.population >= 300000 ||
    place.feature === 'PPLC' ||
    place.feature === 'PPLA' ||
    (place.importance || 0) >= 0.6
  );
}

function keepSerious(list, query) {
  const ranked = [...list].sort((a, b) => scorePlace(b, query) - scorePlace(a, query));
  const anchor = ranked.find(
    (place) => isMajor(place) || (place.curated && bareName(place.name) === bareName(query)),
  );
  if (!anchor) return ranked.slice(0, 6);
  return ranked
    .filter((place, index) => {
      if (index === 0 || place === anchor) return true;
      if (place.population >= 100000) return true;
      if (place.feature === 'PPLC' || place.feature === 'PPLA') return true;
      if (place.curated && bareName(place.name) === bareName(query)) return true;
      return (place.importance || 0) >= 0.55 && bareName(place.name) !== bareName(anchor.name);
    })
    .slice(0, 6);
}

const CITY_TYPES = new Set(['city', 'town', 'municipality', 'state']);

function mapNominatim(item) {
  const address = item.address || {};
  const name = item.name || address.city || address.town || address.municipality;
  if (!name || !CITY_TYPES.has(item.addresstype)) return null;
  if (item.addresstype === 'state' && !/市$/.test(name) && (item.importance || 0) < 0.6) return null;
  return {
    name,
    country: address.country || '',
    admin1: address.state || address.province || address.region || address.city || '',
    lat: Number(item.lat),
    lng: Number(item.lon),
    population: 0,
    importance: Number(item.importance) || 0,
  };
}

async function searchOpenMeteo(query, signal) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=zh&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  const results = data.results || [];
  const cities = results.filter((item) => !item.feature_code || String(item.feature_code).startsWith('PPL'));
  return (cities.length ? cities : results).map(mapRemote);
}

async function searchNominatim(query, signal) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=6&accept-language=zh&addressdetails=1`;
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'zh' } });
  if (!response.ok) return [];
  const data = await response.json();
  return data.map(mapNominatim).filter(Boolean);
}

export async function searchPlaces(query, signal) {
  const q = query.trim();
  signal?.throwIfAborted();
  const local = filterLocal(q);
  if (!q) return local.slice(0, 8);
  const name = bareName(normalizeQuery(q));
  const exact = PLACES.filter((place) => name === bareName(place.name) || name === normalizeQuery(place.alias || ''));
  if (exact.length) return exact;
  try {
    const [meteo, nominatim] = await Promise.all([
      searchOpenMeteo(q, signal).catch(() => []),
      searchNominatim(q, signal).catch(() => []),
    ]);
    signal?.throwIfAborted();
    return keepSerious(dedupe([...meteo, ...nominatim, ...local], q), q);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return local;
  }
}

export async function reversePlace(lat, lng, signal) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('reverse failed');
  const data = await response.json();
  const name = data.city || data.locality;
  if (!name) return null;
  return {
    name,
    country: data.countryName || '',
    admin1: data.principalSubdivision || '',
    lat,
    lng,
  };
}
