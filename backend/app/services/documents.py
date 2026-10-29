"""File storage and the upload pre-flight.

The browser already checks each PDF before upload; the server checks again because the browser can be
bypassed. Checks: real PDF, size limit, password lock, page count, digital signature (validated with
pyHanko when the signature is present), and a ClamAV virus scan when a clamd host is configured.
"""
import asyncio
import io
import re
import uuid
from pathlib import Path

from ..config import settings


class LocalStorage:
    """Files on disk under storage/files, in folders named by the first two characters of a random key."""

    def __init__(self, root: Path):
        self.root = root / "files"

    async def prepare(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    async def healthy(self) -> bool:
        return self.root.is_dir()

    async def save(self, data: bytes, suffix: str) -> str:
        key = f"{uuid.uuid4().hex}{suffix}"
        path = self.root / key[:2] / key
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)
        return f"{key[:2]}/{key}"

    async def read(self, key: str) -> bytes:
        return await asyncio.to_thread((self.root / key).read_bytes)


class S3Storage:
    """Any S3-compatible bucket: MinIO on premises or a MeghRaj/cloud object store in an Indian region.
    Objects are private; the API reads them on behalf of signed-in users and never hands out bucket URLs."""

    def __init__(self):
        from minio import Minio

        self.bucket = settings.s3_bucket
        self.client = Minio(settings.s3_endpoint, access_key=settings.s3_access_key, secret_key=settings.s3_secret_key, secure=settings.s3_secure, region=settings.s3_region)

    async def prepare(self) -> None:
        def ensure() -> None:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket, location=settings.s3_region)

        await asyncio.to_thread(ensure)

    async def healthy(self) -> bool:
        try:
            return await asyncio.to_thread(self.client.bucket_exists, self.bucket)
        except Exception:
            return False

    async def save(self, data: bytes, suffix: str) -> str:
        key = f"{uuid.uuid4().hex[:2]}/{uuid.uuid4().hex}{suffix}"
        content_type = "application/pdf" if suffix == ".pdf" else "application/octet-stream"
        await asyncio.to_thread(self.client.put_object, self.bucket, key, io.BytesIO(data), len(data), content_type=content_type)
        return key

    async def read(self, key: str) -> bytes:
        def get() -> bytes:
            r = self.client.get_object(self.bucket, key)
            try:
                return r.read()
            finally:
                r.close()
                r.release_conn()

        return await asyncio.to_thread(get)


storage = S3Storage() if settings.storage_backend == "s3" else LocalStorage(settings.storage_dir)


async def _signature_details(data: bytes) -> dict:
    """Validates embedded PDF signatures with pyHanko. "intact" means the signed bytes were not changed;
    whether the signer's certificate chains to a trusted Indian CA is checked against the CCA roots in production."""
    try:
        from pyhanko.pdf_utils.reader import PdfFileReader
        from pyhanko.sign.validation import async_validate_pdf_signature
        from pyhanko_certvalidator import ValidationContext
    except ImportError:
        return {"engine": "pattern check only"}
    try:
        reader = PdfFileReader(io.BytesIO(data), strict=False)
        sigs = reader.embedded_signatures
        if not sigs:
            return {"engine": "pyHanko", "intact": None}
        status = await async_validate_pdf_signature(sigs[0], ValidationContext(allow_fetching=False))
        signer = status.signing_cert.subject.human_friendly if status.signing_cert else None
        return {"engine": "pyHanko", "intact": bool(status.intact and status.valid), "trusted": bool(status.trusted), "signer": signer}
    except Exception as e:  # malformed signature dictionaries are reported, not raised
        return {"engine": "pyHanko", "intact": False, "error": type(e).__name__}


async def clamav_alive() -> bool:
    host, _, port = settings.clamd_host.partition(":")
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, int(port or 3310)), 2)
        writer.write(b"zPING\0")
        await writer.drain()
        reply = await asyncio.wait_for(reader.read(64), 3)
        writer.close()
        return reply.startswith(b"PONG")
    except (TimeoutError, OSError):
        return False


def clamd_verdict(reply: str) -> str:
    """clamd answers "stream: OK", "stream: <name> FOUND" or "... ERROR", each ending in a NUL byte (z-commands)."""
    reply = reply.strip("\x00 \r\n")
    if reply.endswith(" FOUND"):
        return "infected"
    return "clean" if reply.endswith(": OK") else "unavailable"


async def _virus_scan(data: bytes) -> str:
    if not settings.clamd_host:
        return "not configured"
    host, _, port = settings.clamd_host.partition(":")
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, int(port or 3310)), 3)
        writer.write(b"zINSTREAM\0")
        for i in range(0, len(data), 8192):
            chunk = data[i : i + 8192]
            writer.write(len(chunk).to_bytes(4, "big") + chunk)
        writer.write((0).to_bytes(4, "big"))
        await writer.drain()
        reply = (await asyncio.wait_for(reader.read(1024), 10)).decode(errors="ignore")
        writer.close()
        return clamd_verdict(reply)
    except (TimeoutError, OSError):
        return "unavailable"


async def preflight(data: bytes) -> dict:
    kind = "pdf" if data[:5] == b"%PDF-" else "other"
    text = data.decode("latin-1") if kind == "pdf" else ""
    pages = (len(re.findall(r"/Type\s*/Page(?!s)", text)) or None) if kind == "pdf" else None
    signed = kind == "pdf" and bool(re.search(r"/ByteRange\s*\[", text)) and bool(re.search(r"/(Sig|DocTimeStamp)\b", text))
    encrypted = kind == "pdf" and bool(re.search(r"/Encrypt\s", text))
    sig = await _signature_details(data) if signed else {}
    virus = await _virus_scan(data)
    errors: list[str] = []
    warnings: list[str] = []
    if kind != "pdf":
        errors.append("Only PDF files are accepted.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        errors.append(f"File is {len(data) / 1048576:.1f} MB; the limit is {settings.max_upload_mb} MB. Scan at 200 dpi in greyscale to make it smaller.")
    if encrypted:
        errors.append("The PDF is password-protected. Remove the password so the committee can open it.")
    if virus == "infected":
        errors.append("The virus scan flagged this file. It has not been stored.")
    elif virus == "unavailable":
        (errors if settings.secure else warnings).append("The virus scanner is not answering right now, so this file could not be checked. Please try again in a few minutes.")
    if kind == "pdf" and not signed:
        warnings.append("No digital signature found. Sign it with the Chairman’s or Secretary’s DSC before final submission (APH 1.4.6).")
    if signed and sig.get("intact") is False:
        warnings.append("A signature is present but the signed content does not match it. Re-sign the final file.")
    if pages == 1 and len(data) < 20 * 1024:
        warnings.append("The file is very small for a scanned document. Check that the right file was chosen.")
    return {
        "kind": kind, "sizeKb": round(len(data) / 1024), "pages": pages, "signed": signed, "signatureIntact": sig.get("intact"),
        "signer": sig.get("signer"), "signatureEngine": sig.get("engine"), "encrypted": encrypted, "virusScan": virus, "errors": errors, "warnings": warnings,
    }
