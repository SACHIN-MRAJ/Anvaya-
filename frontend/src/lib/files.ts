/** Browser-side helpers for uploads, downloads and calendar files. Nothing leaves the device. */

export const MAX_UPLOAD_MB = 10;

export interface Preflight {
  kind: 'pdf' | 'other';
  sizeKB: number;
  pages?: number;
  signed: boolean;
  encrypted: boolean;
  /** Problems that block the upload. */
  errors: string[];
  /** Problems the institution should fix but may still upload. */
  warnings: string[];
}

/**
 * Checks a file before upload, the way the scrutiny committee would: is it a PDF,
 * within the size limit, not password-locked, and does it carry a digital signature (APH 1.4.6)?
 */
export async function preflight(file: File): Promise<Preflight> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const head = String.fromCharCode(...buf.slice(0, 5));
  const kind = head === '%PDF-' ? 'pdf' : 'other';
  // PDF structure is ASCII; decoding as latin1 keeps byte offsets and is fast enough for 10 MB.
  const text = kind === 'pdf' ? new TextDecoder('latin1').decode(buf) : '';
  const pages = kind === 'pdf' ? (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length || undefined : undefined;
  const signed = kind === 'pdf' && /\/ByteRange\s*\[/.test(text) && /\/(Sig|DocTimeStamp)\b/.test(text);
  const encrypted = kind === 'pdf' && /\/Encrypt\s/.test(text);
  const sizeKB = Math.round(file.size / 1024);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (kind !== 'pdf') errors.push('Only PDF files are accepted.');
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) errors.push(`File is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_UPLOAD_MB} MB. Scan at 200 dpi in greyscale to make it smaller.`);
  if (encrypted) errors.push('The PDF is password-protected. Remove the password so the committee can open it.');
  if (kind === 'pdf' && !signed) warnings.push('No digital signature found. Sign it with the Chairman’s or Secretary’s DSC before final submission (APH 1.4.6).');
  if (pages === 1 && file.size < 20 * 1024) warnings.push('The file is very small for a scanned document. Check that the right file was chosen.');
  return { kind, sizeKB, pages, signed, encrypted, errors, warnings };
}

export function downloadText(name: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface CalendarItem {
  title: string;
  /** yyyy-mm-dd, all-day event */
  date: string;
  description?: string;
}

const icsDate = (iso: string) => iso.replace(/-/g, '');
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** An .ics file that Google Calendar, Outlook and phone calendars import directly, with a reminder 3 days before. */
export function toIcs(items: CalendarItem[], calName = 'ANUMATI deadlines'): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ANUMATI//Approvals//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsEscape(calName)}`];
  items.forEach((it, i) => {
    const next = new Date(it.date);
    next.setDate(next.getDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:anumati-${icsDate(it.date)}-${i}@aicte`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(it.date)}`,
      `DTEND;VALUE=DATE:${icsDate(next.toISOString().slice(0, 10))}`,
      `SUMMARY:${icsEscape(it.title)}`,
      `DESCRIPTION:${icsEscape(it.description ?? 'From ANUMATI')}`,
      'BEGIN:VALARM',
      'TRIGGER:-P3D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(it.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export const downloadIcs = (name: string, items: CalendarItem[], calName?: string) => downloadText(name, toIcs(items, calName), 'text/calendar');

/** "just now", "12 s ago", "3 min ago" */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}
