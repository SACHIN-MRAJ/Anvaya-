import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '../lib/utils';

/** QR code that opens the public verification page for a letter. Generated locally, no external service. */
export function QrCode({ value, size = 132, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#0A1D42', light: '#FFFFFF' }, errorCorrectionLevel: 'M' })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt={`QR code to verify: ${value}`} className={cn('rounded-lg', className)} /> : <div className="skeleton" style={{ width: size, height: size }} />;
}

export const verifyUrl = (ref: string) => `${window.location.origin}/verify?ref=${encodeURIComponent(ref)}`;
