import { bearing, destinationPoint, focusOf, haversine, latLngToVec, lerp, lerpAngle, slerp, vecToLatLng } from './geo.js';

export const MODES = {
  plane: {
    id: 'plane',
    label: '飞机',
    color: '#8fd4ff',
    speed: 820,
    overhead: 1,
    factor: 1,
  },
  rail: {
    id: 'rail',
    label: '高铁',
    color: '#c9b6ff',
    speed: 250,
    overhead: 0.35,
    factor: 1.12,
  },
  car: {
    id: 'car',
    label: '汽车',
    color: '#f0a45a',
    speed: 85,
    overhead: 0.08,
    factor: 1.28,
  },
};

const CAMERA_ORIENTATION = { heading: 0, pitch: -65 };
const ARRIVAL_HOLD = 0.18;

export function defaultMode(km) {
  if (km < 220) return 'car';
  if (km < 1300) return 'rail';
  return 'plane';
}

export function normalizeModes(stops, modes = []) {
  const next = [];
  for (let i = 0; i < Math.max(0, stops.length - 1); i += 1) {
    const mode = modes[i];
    next.push(MODES[mode] ? mode : defaultMode(haversine(stops[i], stops[i + 1])));
  }
  return next;
}

function sampleCount(km, mode) {
  if (mode === 'plane') return Math.max(140, Math.min(240, Math.round(km / 18)));
  return Math.max(72, Math.min(160, Math.round(km / 28)));
}

function altitudeMeters(mode, t, km) {
  if (mode === 'plane') {
    const peak = Math.min(700_000, Math.max(70_000, km * 70));
    return 12_000 + Math.sin(Math.PI * t) * peak;
  }
  return 2_000;
}

function sampleLeg(from, to, mode, km, bendKm) {
  const count = sampleCount(km, mode);
  const a = latLngToVec(from.lat, from.lng);
  const b = latLngToVec(to.lat, to.lng);
  const samples = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    let point = vecToLatLng(slerp(a, b, t));
    if (i > 0 && i < count) {
      const ahead = vecToLatLng(slerp(a, b, Math.min(1, t + 0.001)));
      point = destinationPoint(point.lat, point.lng, bearing(point, ahead) + 90, bendKm * Math.sin(Math.PI * t) ** 2);
    }
    samples.push({ ...point, alt: altitudeMeters(mode, t, km) });
  }
  return samples;
}

export function buildRoute(stops, modes) {
  const legs = [];
  const cities = [];
  const cityIds = stops.map((stop) => {
    const existing = cities.findIndex((city) => haversine(city, stop) < 8);
    if (existing >= 0) return existing;
    cities.push(stop);
    return cities.length - 1;
  });
  const passes = new Map();
  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i];
    const to = stops[i + 1];
    const mode = MODES[modes[i]] ? modes[i] : defaultMode(haversine(from, to));
    const greatKm = haversine(from, to);
    const spec = MODES[mode];
    const km = greatKm * spec.factor;
    const hours = greatKm < 1 ? 0 : km / spec.speed + spec.overhead;
    const fromId = cityIds[i];
    const toId = cityIds[i + 1];
    const pair = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}`;
    const pass = passes.get(pair) ?? 0;
    passes.set(pair, pass + 1);
    const lane = Math.floor(pass / 2) + 1;
    const side = (pass % 2 === 0 ? 1 : -1) * (fromId < toId ? 1 : -1);
    const bendKm = Math.min(20, greatKm * 0.008) * lane * side;
    const samples = greatKm < 1 ? [] : sampleLeg(from, to, mode, greatKm, bendKm);
    legs.push({ mode, from, to, greatKm, km, hours, samples });
  }
  return {
    stops,
    legs,
    km: legs.reduce((sum, leg) => sum + leg.km, 0),
    hours: legs.reduce((sum, leg) => sum + leg.hours, 0),
  };
}

function legAnimSeconds(leg) {
  if (leg.mode === 'plane') return Math.min(5.8, 1.7 + leg.greatKm / 2700);
  if (leg.mode === 'rail') return Math.min(3.8, 1.2 + leg.greatKm / 1800);
  return Math.min(2.8, 1.05 + leg.greatKm / 1300);
}

function arcEase(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function zoomSeconds(from, to, minimum) {
  return minimum + 0.25 * Math.abs(Math.log(to.range / from.range));
}

export function buildTimeline(route) {
  const { legs } = route;
  const overview = overviewCamera(route.stops);
  const cameras = legs.map((leg) => ({
    start: travelCamera(leg, 0),
    end: travelCamera(leg, 1),
  }));
  const intro = zoomSeconds(overview, cameras[0]?.start ?? overview, 0.9);
  const outro = zoomSeconds(cameras.at(-1)?.end ?? overview, overview, 1.5);
  const phases = [];
  let cursor = 0;
  phases.push({ type: 'intro', start: cursor, dur: intro, stopIndex: 0 });
  cursor += intro;
  legs.forEach((leg, index) => {
    const dur = legAnimSeconds(leg);
    phases.push({ type: 'travel', start: cursor, dur, legIndex: index, stopIndex: index });
    cursor += dur;
    const end = cameras[index].end;
    const next = cameras[index + 1]?.start;
    const arrival = ARRIVAL_HOLD + zoomSeconds(end, next ?? end, 0.28);
    phases.push({
      type: 'arrive',
      start: cursor,
      dur: arrival,
      hold: ARRIVAL_HOLD,
      legIndex: index,
      stopIndex: index + 1,
    });
    cursor += arrival;
  });
  phases.push({
    type: 'outro',
    start: cursor,
    dur: outro,
    stopIndex: Math.max(0, legs.length),
  });
  cursor += outro;
  const pace = Math.max(0.72, Math.sqrt(48 / Math.max(48, cursor)));
  for (const phase of phases) {
    phase.start *= pace;
    phase.dur *= pace;
    if (phase.hold) phase.hold *= pace;
  }
  return { ...route, phases, total: cursor * pace, overview, cameras };
}

export function cinematicSeconds(stops, modes) {
  if (stops.length < 2) return 0;
  return buildTimeline(buildRoute(stops, modes)).total;
}

function overviewCamera(stops) {
  const center = focusOf(stops);
  let maxMeters = 40_000;
  for (const stop of stops) maxMeters = Math.max(maxMeters, haversine(center, stop) * 1000);
  return {
    ...center,
    height: 0,
    ...CAMERA_ORIENTATION,
    range: Math.min(26_000_000, Math.max(280_000, maxMeters * 2.75)),
  };
}

function travelRange(mode, km) {
  if (mode === 'plane') return Math.min(6_800_000, Math.max(1_250_000, km * 820));
  if (mode === 'rail') return Math.min(980_000, Math.max(240_000, km * 260));
  return Math.min(460_000, Math.max(140_000, km * 380));
}

function positionOnLeg(leg, progress) {
  const { samples, from, to } = leg;
  if (samples.length < 2) {
    return { lat: lerp(from.lat, to.lat, progress), lng: lerpAngle(from.lng, to.lng, progress), height: 2000 };
  }
  const offset = progress * (samples.length - 1);
  const index = Math.min(Math.floor(offset), samples.length - 2);
  const fraction = offset - index;
  const a = samples[index];
  const b = samples[index + 1];
  return {
    lat: lerp(a.lat, b.lat, fraction),
    lng: lerpAngle(a.lng, b.lng, fraction),
    height: lerp(a.alt, b.alt, fraction),
  };
}

function travelCamera(leg, progress) {
  const ahead = progress + 0.55 * progress * (1 - progress);
  return {
    ...positionOnLeg(leg, ahead),
    ...CAMERA_ORIENTATION,
    range: travelRange(leg.mode, leg.greatKm),
  };
}

function blendCamera(from, to, progress) {
  const target = vecToLatLng(slerp(
    latLngToVec(from.lat, from.lng),
    latLngToVec(to.lat, to.lng),
    progress,
  ));
  return {
    ...target,
    height: lerp(from.height, to.height, progress),
    ...CAMERA_ORIENTATION,
    range: Math.exp(lerp(Math.log(from.range), Math.log(to.range), progress)),
  };
}

export function frameAt(timeline, stops, elapsed, title) {
  const { legs, phases, total, km, hours, overview, cameras } = timeline;
  const time = Math.min(Math.max(elapsed, 0), total);
  let phase = phases[phases.length - 1];
  for (const item of phases) {
    if (time >= item.start && time < item.start + item.dur) {
      phase = item;
      break;
    }
  }
  const u = phase.dur <= 0 ? 1 : Math.min(1, (time - phase.start) / phase.dur);
  const hold = phase.hold ?? 0;
  const eased = arcEase((u * phase.dur - hold) / (phase.dur - hold));
  const progress = legs.map((_, index) => {
    if (phase.type === 'intro') return 0;
    if (phase.type === 'outro') return 1;
    if (phase.type === 'arrive') return index <= phase.legIndex ? 1 : 0;
    if (index < phase.legIndex) return 1;
    if (index > phase.legIndex) return 0;
    return eased;
  });

  let vehicle = { show: false };
  let camera = overview;
  let caption = title || '未命名旅程';
  let meta = '';
  let color = '#e6b15c';

  if (phase.type === 'intro' && stops[0]) {
    camera = blendCamera(overview, cameras[0]?.start ?? overview, eased);
    caption = title || stops[0].name;
    meta = `${stops[0].name} 出发 · ${stops.length} 座城市`;
  }

  if (phase.type === 'travel') {
    const leg = legs[phase.legIndex];
    const spec = MODES[leg.mode];
    camera = travelCamera(leg, eased);
    const position = positionOnLeg(leg, eased);
    const before = positionOnLeg(leg, Math.max(0, eased - 0.01));
    const after = positionOnLeg(leg, Math.min(1, eased + 0.01));
    vehicle = { show: true, ...position, mode: leg.mode, heading: bearing(before, after) };
    caption = `${leg.from.name}  →  ${leg.to.name}`;
    meta = `${spec.label} · ${Math.round(leg.km).toLocaleString('zh-CN')} km · 约 ${formatLoose(leg.hours)}`;
    color = spec.color;
  }

  if (phase.type === 'arrive') {
    const leg = legs[phase.legIndex];
    const spec = MODES[leg.mode];
    const city = stops[phase.stopIndex];
    const from = cameras[phase.legIndex].end;
    const next = cameras[phase.legIndex + 1]?.start;
    const parked = { ...from, lat: city.lat, lng: city.lng, height: 1800 };
    camera = blendCamera(from, next ?? parked, eased);
    caption = city.name;
    meta = phase.stopIndex === stops.length - 1 ? '抵达终点' : `第 ${phase.stopIndex + 1} 站`;
    color = spec.color;
  }

  if (phase.type === 'outro') {
    const end = cameras.at(-1)?.end ?? overview;
    const last = stops.at(-1);
    const from = last ? { ...end, lat: last.lat, lng: last.lng, height: 1800 } : end;
    camera = blendCamera(from, overview, eased);
    caption = title || '旅程足迹';
    meta = `${stops.length} 座城市 · ${Math.round(km).toLocaleString('zh-CN')} km · 约 ${formatLoose(hours)}`;
  }

  return {
    progress,
    vehicle,
    camera,
    activeStop: phase.stopIndex,
    done: elapsed >= total,
    hud: {
      title: title || '未命名旅程',
      caption,
      meta,
      color,
      progress: total > 0 ? time / total : 0,
    },
  };
}

function formatLoose(hours) {
  const totalMin = Math.max(1, Math.round(hours * 60));
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh <= 0) return `${mm} 分钟`;
  if (mm === 0) return `${hh} 小时`;
  return `${hh} 小时 ${mm} 分`;
}
