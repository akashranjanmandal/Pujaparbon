import { describe, expect, it } from "vitest";
import { distanceMeters, checkGeofence } from "./geo";

const warehouse = { lat: 22.2889, lng: 88.2633, radiusM: 100 }; // Sarisha area

describe("geofence", () => {
  it("measures distance between two coordinates in metres", () => {
    // ~111 m per 0.001 deg latitude
    const d = distanceMeters({ lat: 22.2889, lng: 88.2633 }, { lat: 22.2899, lng: 88.2633 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });
  it("allows a check-in inside the radius with good accuracy", () => {
    const r = checkGeofence({ lat: 22.28895, lng: 88.26335, accuracyM: 15 }, warehouse);
    expect(r.allowed).toBe(true);
    expect(r.distanceM).toBeLessThan(10);
  });
  it("blocks a check-in outside the radius", () => {
    const r = checkGeofence({ lat: 22.2950, lng: 88.2633, accuracyM: 10 }, warehouse);
    expect(r).toMatchObject({ allowed: false, reason: "OUTSIDE_GEOFENCE" });
  });
  it("blocks a check-in when GPS accuracy is worse than the radius", () => {
    const r = checkGeofence({ lat: 22.2889, lng: 88.2633, accuracyM: 400 }, warehouse);
    expect(r).toMatchObject({ allowed: false, reason: "LOW_ACCURACY" });
  });
});
