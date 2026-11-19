/** A scanned QR is a link ending in /q/CODE. A USB scanner types it into the box; a phone camera can scan it directly. */
export const extractCode = (text: string) => text.match(/\/q\/([A-Za-z0-9]{7})/)?.[1]?.toUpperCase() ?? text.trim().match(/^[PLpl][A-Za-z0-9]{6}$/)?.[0]?.toUpperCase() ?? null;
