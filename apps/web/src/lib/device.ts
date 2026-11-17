/** A stable per-browser id used to bind a staff member to their own phone. */
export function deviceId() {
  try {
    let id = localStorage.getItem("pp_device");
    if (!id) {
      id = `${crypto.randomUUID()}`;
      localStorage.setItem("pp_device", id);
    }
    return id;
  } catch {
    return "no-storage-device";
  }
}
