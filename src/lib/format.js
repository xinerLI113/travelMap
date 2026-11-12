export function formatKm(km) {
  if (!Number.isFinite(km) || km <= 0) return '0 km';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('zh-CN')} km`;
}

export function formatHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return '不到 1 分钟';
  const totalMin = Math.max(1, Math.round(hours * 60));
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh <= 0) return `${mm} 分钟`;
  if (mm === 0) return `${hh} 小时`;
  return `${hh} 小时 ${mm} 分`;
}

export function formatPop(population) {
  if (!population || population < 50000) return '';
  return `${Math.max(1, Math.round(population / 10000))} 万人`;
}

export function placeSubtitle(place) {
  const parts = [];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  const pop = formatPop(place.population);
  if (pop) parts.push(pop);
  return parts.join(' · ');
}
