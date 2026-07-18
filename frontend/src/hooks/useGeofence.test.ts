import { describe, expect, it } from "vitest";
import { haversineM } from "./useGeofence";

describe("haversineM", () => {
  it("returns ~0 for same point", () => {
    expect(haversineM({ lat: 32.08, lng: 34.78 }, { lat: 32.08, lng: 34.78 })).toBeLessThan(1);
  });

  it("measures tel aviv short distance in hundreds of meters", () => {
    const d = haversineM(
      { lat: 32.0765, lng: 34.7745 },
      { lat: 32.0743, lng: 34.7922 },
    );
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(5000);
  });
});
