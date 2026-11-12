const EARTH_KM = 6371;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  const delta = ((b - a + 540) % 360) - 180;
  return a + delta * t;
}

export function wrapLng(lng) {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}

export function haversine(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a, b) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function destinationPoint(lat, lng, bearingDeg, distanceKm) {
  const delta = distanceKm / EARTH_KM;
  const theta = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) +
      Math.cos(lat1) * Math.sin(delta) * Math.cos(theta),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: wrapLng((lng2 * 180) / Math.PI),
  };
}

export function latLngToVec(lat, lng) {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  return {
    x: cosPhi * Math.cos(theta),
    y: Math.sin(phi),
    z: cosPhi * Math.sin(theta),
  };
}

export function vecToLatLng(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return {
    lat: (Math.asin(clamp(v.y / len, -1, 1)) * 180) / Math.PI,
    lng: wrapLng((Math.atan2(v.z / len, v.x / len) * 180) / Math.PI),
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function slerp(a, b, t) {
  const aa = normalize(a);
  const bb = normalize(b);
  const cos = clamp(dot(aa, bb), -1, 1);
  const omega = Math.acos(cos);
  if (omega < 1e-5) {
    return normalize({
      x: aa.x + (bb.x - aa.x) * t,
      y: aa.y + (bb.y - aa.y) * t,
      z: aa.z + (bb.z - aa.z) * t,
    });
  }
  if (omega > Math.PI - 1e-3) {
    const axis = Math.abs(aa.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const perp = normalize(cross(aa, axis));
    return t < 0.5 ? slerp(aa, perp, t * 2) : slerp(perp, bb, (t - 0.5) * 2);
  }
  const sinOmega = Math.sin(omega);
  const k1 = Math.sin((1 - t) * omega) / sinOmega;
  const k2 = Math.sin(t * omega) / sinOmega;
  return {
    x: aa.x * k1 + bb.x * k2,
    y: aa.y * k1 + bb.y * k2,
    z: aa.z * k1 + bb.z * k2,
  };
}

export function focusOf(stops) {
  if (!stops.length) return { lat: 22, lng: 78 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const stop of stops) {
    const v = latLngToVec(stop.lat, stop.lng);
    x += v.x;
    y += v.y;
    z += v.z;
  }
  if (Math.hypot(x, y, z) < 1e-4) return { lat: 0, lng: 0 };
  return vecToLatLng({ x, y, z });
}

export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}
