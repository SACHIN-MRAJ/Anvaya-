/** Reads where and when a photo was taken, straight from its EXIF data, in the browser. */
export interface PhotoMeta {
  lat?: number;
  lng?: number;
  /** "YYYY:MM:DD HH:MM:SS" as the camera wrote it (local time). */
  takenAt?: string;
}

type Entry = { type: number; count: number; valOff: number };

export function readExif(buf: ArrayBuffer): PhotoMeta {
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return {};
    let off = 2;
    while (off + 10 < v.byteLength) {
      const marker = v.getUint16(off);
      if ((marker & 0xff00) !== 0xff00) break;
      const len = v.getUint16(off + 2);
      // APP1 segment that starts with "Exif\0\0"
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
      off += 2 + len;
    }
  } catch {
    /* damaged or unusual file: treat as having no metadata */
  }
  return {};
}

function parseTiff(v: DataView, start: number): PhotoMeta {
  const le = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(start + o, le);
  const u32 = (o: number) => v.getUint32(start + o, le);
  const ifd = (at: number) => {
    const out = new Map<number, Entry>();
    const n = u16(at);
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12;
      out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valOff: e + 8 });
    }
    return out;
  };
  const ascii = (e: Entry) => {
    const at = e.count > 4 ? u32(e.valOff) : e.valOff;
    let s = '';
    for (let i = 0; i < e.count - 1; i++) s += String.fromCharCode(v.getUint8(start + at + i));
    return s;
  };
  const rationals = (e: Entry) => {
    const at = u32(e.valOff);
    return Array.from({ length: e.count }, (_, i) => u32(at + i * 8) / (u32(at + i * 8 + 4) || 1));
  };
  const meta: PhotoMeta = {};
  const ifd0 = ifd(u32(4));
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr) {
    const original = ifd(u32(exifPtr.valOff)).get(0x9003);
    if (original) meta.takenAt = ascii(original);
  }
  const dt = ifd0.get(0x0132);
  if (!meta.takenAt && dt) meta.takenAt = ascii(dt);
  const gpsPtr = ifd0.get(0x8825);
  if (gpsPtr) {
    const g = ifd(u32(gpsPtr.valOff));
    const lat = g.get(0x0002);
    const lng = g.get(0x0004);
    if (lat && lng) {
      const deg = (r: number[]) => r[0] + (r[1] ?? 0) / 60 + (r[2] ?? 0) / 3600;
      const latRef = g.get(0x0001);
      const lngRef = g.get(0x0003);
      meta.lat = deg(rationals(lat)) * (latRef && ascii(latRef) === 'S' ? -1 : 1);
      meta.lng = deg(rationals(lng)) * (lngRef && ascii(lngRef) === 'W' ? -1 : 1);
    }
  }
  return meta;
}

/** Great-circle distance in kilometres. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b in degrees (0 = north). */
export function bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(bLng - aLng)) * Math.cos(r(bLat));
  const x = Math.cos(r(aLat)) * Math.sin(r(bLat)) - Math.sin(r(aLat)) * Math.cos(r(bLat)) * Math.cos(r(bLng - aLng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
