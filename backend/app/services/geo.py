"""Where and when a photo was taken, read from its EXIF data. Same parser as the browser (frontend/src/lib/geo.ts)."""
import math
import struct

FENCE_KM = 0.5


def read_exif(data: bytes) -> dict:
    try:
        if len(data) < 4 or data[:2] != b"\xff\xd8":
            return {}
        off = 2
        while off + 10 < len(data):
            marker, length = struct.unpack(">HH", data[off : off + 4])
            if marker & 0xFF00 != 0xFF00:
                break
            if marker == 0xFFE1 and data[off + 4 : off + 8] == b"Exif":
                return _tiff(data, off + 10)
            off += 2 + length
    except (struct.error, IndexError, ValueError):
        pass
    return {}


def _tiff(b: bytes, start: int) -> dict:
    le = b[start : start + 2] == b"II"
    e = "<" if le else ">"
    u16 = lambda o: struct.unpack(e + "H", b[start + o : start + o + 2])[0]  # noqa: E731
    u32 = lambda o: struct.unpack(e + "I", b[start + o : start + o + 4])[0]  # noqa: E731

    def ifd(at: int) -> dict:
        return {u16(at + 2 + i * 12): (u16(at + 4 + i * 12), u32(at + 6 + i * 12), at + 10 + i * 12) for i in range(u16(at))}

    def ascii_(entry) -> str:
        _, count, val = entry
        at = u32(val) if count > 4 else val
        return b[start + at : start + at + count - 1].decode("ascii", "ignore")

    def rationals(entry) -> list[float]:
        _, count, val = entry
        at = u32(val)
        return [u32(at + i * 8) / (u32(at + i * 8 + 4) or 1) for i in range(count)]

    meta: dict = {}
    ifd0 = ifd(u32(4))
    if 0x8769 in ifd0:
        exif = ifd(u32(ifd0[0x8769][2]))
        if 0x9003 in exif:
            meta["takenAt"] = ascii_(exif[0x9003])
    if "takenAt" not in meta and 0x0132 in ifd0:
        meta["takenAt"] = ascii_(ifd0[0x0132])
    if 0x8825 in ifd0:
        g = ifd(u32(ifd0[0x8825][2]))
        if 2 in g and 4 in g:
            deg = lambda r: r[0] + (r[1] if len(r) > 1 else 0) / 60 + (r[2] if len(r) > 2 else 0) / 3600  # noqa: E731
            meta["lat"] = deg(rationals(g[2])) * (-1 if 1 in g and ascii_(g[1]) == "S" else 1)
            meta["lng"] = deg(rationals(g[4])) * (-1 if 3 in g and ascii_(g[3]) == "W" else 1)
    return meta


def distance_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r = math.radians
    h = math.sin(r(b_lat - a_lat) / 2) ** 2 + math.cos(r(a_lat)) * math.cos(r(b_lat)) * math.sin(r(b_lng - a_lng) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def judge(meta: dict, lat: float, lng: float, visit_date: str) -> dict:
    """ok: on campus on the visit day · far: outside the 500 m fence · time: wrong day · nogps: no location."""
    if meta.get("lat") is None:
        return {"verdict": "nogps", "distanceM": None}
    km = distance_km(lat, lng, meta["lat"], meta["lng"])
    if km > FENCE_KM:
        return {"verdict": "far", "distanceM": round(km * 1000)}
    day = (meta.get("takenAt") or "")[:10].replace(":", "-")
    return {"verdict": "time" if day and day != visit_date else "ok", "distanceM": round(km * 1000)}
