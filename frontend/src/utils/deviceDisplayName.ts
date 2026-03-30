/**
 * Brauzer User-Agent dan qisqa qurilma nomi (headerda ko'rsatish uchun).
 */
export function getDeviceDisplayName(): string {
  if (typeof navigator === 'undefined') {
    return '';
  }
  const ua = navigator.userAgent || '';

  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else browser = 'Brauzer';

  let os = '';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = /iPad/.test(ua) ? 'iPad' : 'iPhone';

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : ua.slice(0, 56);
}
