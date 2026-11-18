"use client";
/** Browser-only helpers for geofenced selfie attendance. No third-party services. */

export interface Fix { lat: number; lng: number; accuracyM: number }

export function getPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser cannot share location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? "Location permission was denied. Allow it in the browser settings." : "Could not get your location. Try again near a window.")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

export async function openCamera(video: HTMLVideoElement) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera needs HTTPS (or localhost) and a supported browser.");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
  video.srcObject = stream;
  // A newer attach can interrupt play(); that is not a camera failure.
  await video.play().catch((e: Error) => { if (e.name !== "AbortError") throw e; });
  return () => stream.getTracks().forEach((t) => t.stop());
}

/** Square-crop, mirror and compress the live frame to a ~40 KB JPEG. */
export function capture(video: HTMLVideoElement, size = 480): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const s = Math.min(video.videoWidth, video.videoHeight);
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, (video.videoWidth - s) / 2, (video.videoHeight - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.78);
}

/** Bearing-free local offset in metres (good enough inside a few km). */
export function offsetMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const dy = (to.lat - from.lat) * 111_320;
  const dx = (to.lng - from.lng) * 111_320 * Math.cos((from.lat * Math.PI) / 180);
  return { dx, dy, d: Math.hypot(dx, dy) };
}
