const HISTORY_KEY = 'travel-map.trips';
const CURRENT_TRIP_KEY = 'travel-map.current-trip';
const HOME_KEY = 'travel-map.home';

function isPlace(place) {
  return place && typeof place.name === 'string' && Number.isFinite(place.lat) && Number.isFinite(place.lng);
}

export function readHome() {
  try {
    const place = JSON.parse(localStorage.getItem(HOME_KEY) ?? 'null');
    return isPlace(place) ? place : null;
  } catch {
    return null;
  }
}

export function saveHome(place) {
  localStorage.setItem(HOME_KEY, JSON.stringify(place));
}

export function readCurrentTrip() {
  try {
    return parseTrip(localStorage.getItem(CURRENT_TRIP_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function parseTrip(json) {
  const trip = JSON.parse(json);
  if (
    trip && typeof trip.title === 'string' &&
    (trip.aspect === 'landscape' || trip.aspect === 'portrait') &&
    Array.isArray(trip.modes) && Array.isArray(trip.stops) &&
    trip.stops.every(isPlace)
  ) return trip;
  return null;
}

export function saveCurrentTrip(trip) {
  localStorage.setItem(CURRENT_TRIP_KEY, JSON.stringify(trip));
}

export function readTrips() {
  try {
    const trips = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(trips) ? trips : [];
  } catch {
    return [];
  }
}

export function saveTrip(trip) {
  const signature = ({ title, stops, modes, aspect }) => JSON.stringify([
    title, stops.map(({ name, lat, lng }) => [name, lat, lng]), modes, aspect,
  ]);
  const id = signature(trip);
  const trips = [{ ...trip, id }, ...readTrips().filter((saved) => saved.id !== id)];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trips));
  return trips;
}
