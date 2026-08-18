type Coordinates = {
  latitude: number;
  longitude: number;
};

type TravelMode = "DRIVE" | "WALK";

const postalCodeCoordinateCache = new Map<string, Coordinates | null>();

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sanitizePostalCode(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(0, 4);
}

export function sanitizePostalPrefix(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(0, 1);
}

export function haversineKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function toCoordinates(input: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}): Coordinates | null {
  if (!isFiniteCoordinate(input.latitude) || !isFiniteCoordinate(input.longitude)) return null;
  const latitude = input.latitude;
  const longitude = input.longitude;
  return {
    latitude,
    longitude,
  };
}

async function fetchPostalCodeCoordinates(postalCode: string): Promise<Coordinates | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`https://api.zippopotam.us/no/${postalCode}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = await response.json() as {
      places?: Array<{ latitude?: string; longitude?: string }>;
    };
    const place = payload.places?.[0];
    if (!place) return null;

    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolvePostalCodeCoordinates(postalCodeInput: string | null | undefined): Promise<Coordinates | null> {
  const postalCode = sanitizePostalCode(postalCodeInput);
  if (!postalCode || postalCode.length !== 4) return null;

  if (postalCodeCoordinateCache.has(postalCode)) {
    return postalCodeCoordinateCache.get(postalCode) ?? null;
  }

  const resolved = await fetchPostalCodeCoordinates(postalCode);
  postalCodeCoordinateCache.set(postalCode, resolved);
  return resolved;
}

export function deriveMaxTravelKm(input: {
  travelMode: TravelMode;
  maxTravelKm: number | null | undefined;
  maxTravelMinutes: number | null | undefined;
}) {
  const km = typeof input.maxTravelKm === "number" && Number.isFinite(input.maxTravelKm) && input.maxTravelKm > 0
    ? input.maxTravelKm
    : null;
  const minutes = typeof input.maxTravelMinutes === "number" && Number.isFinite(input.maxTravelMinutes) && input.maxTravelMinutes > 0
    ? input.maxTravelMinutes
    : null;

  const kmFromMinutes = minutes === null
    ? null
    : input.travelMode === "WALK"
      ? minutes * 0.08
      : minutes * 0.8;

  if (km !== null && kmFromMinutes !== null) return Math.min(km, kmFromMinutes);
  if (km !== null) return km;
  if (kmFromMinutes !== null) return kmFromMinutes;
  return null;
}
