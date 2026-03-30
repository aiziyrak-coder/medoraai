import React, { useMemo } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { getDeviceDisplayName } from '../utils/deviceDisplayName';
import MonitorIcon from './icons/MonitorIcon';

type Props = { variant?: 'header' | 'auth' | 'compact'; tone?: 'light' | 'dark' };

/**
 * Bitta qurilma siyosati: qurilma nomi + ogohlantirish (header yoki kirish formasi).
 */
const DeviceSessionBanner: React.FC<Props> = ({ variant = 'header', tone = 'light' }) => {
  const { t } = useTranslation();
  const deviceName = useMemo(() => getDeviceDisplayName(), []);
  const compactTooltip = useMemo(
    () =>
      `${t('device_session_banner_title')}: ${deviceName || '—'}\n\n${t('device_session_banner_body')}`,
    [t, deviceName],
  );

  if (variant === 'compact') {
    const isDark = tone === 'dark';
    return (
      <div
        className={`inline-flex max-w-[min(46vw,11rem)] sm:max-w-[15rem] md:max-w-xs items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] sm:text-[10px] leading-tight shadow-sm min-w-0 ${
          isDark
            ? 'border-amber-400/35 bg-amber-950/50 text-amber-100'
            : 'border-amber-200/90 bg-amber-50/95 text-amber-950'
        }`}
        title={compactTooltip}
      >
        <MonitorIcon className={`w-3 h-3 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
        <span className="min-w-0 truncate font-semibold">
          <span className={isDark ? 'text-amber-100/90' : 'text-amber-950/90'}>
            {t('device_session_banner_title')}:
          </span>{' '}
          <span className={isDark ? 'text-white' : 'text-slate-900'}>{deviceName || '—'}</span>
        </span>
      </div>
    );
  }

  if (variant === 'auth') {
    return (
      <div className="rounded-xl border border-amber-400/35 bg-amber-950/50 p-3 text-left shadow-lg backdrop-blur-sm">
        <p className="text-[11px] font-bold text-amber-100/95 flex items-start gap-2">
          <MonitorIcon className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
          <span>
            {t('device_session_banner_title')}:{' '}
            <span className="text-white font-semibold break-words">{deviceName || '—'}</span>
          </span>
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-amber-50/90 pl-6 border-l border-amber-500/30">
          {t('auth_login_device_notice')}
        </p>
      </div>
    );
  }

  if (tone === 'dark') {
    return (
      <div className="rounded-xl border border-amber-400/35 bg-amber-950/45 px-3 py-2 sm:px-4 sm:py-2.5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 text-xs min-w-0">
          <div className="flex items-start gap-2 min-w-0">
            <MonitorIcon className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
            <span className="text-amber-100/95 font-semibold leading-snug">
              {t('device_session_banner_title')}:{' '}
              <span className="text-white font-bold break-words">{deviceName || '—'}</span>
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-medium text-amber-100/90 sm:text-right sm:max-w-[58%] leading-snug">
            {t('device_session_banner_body')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-amber-50/95 to-amber-100/80 px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 text-xs min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          <MonitorIcon className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
          <span className="text-amber-950/95 font-semibold leading-snug">
            {t('device_session_banner_title')}:{' '}
            <span className="text-slate-900 font-bold break-words">{deviceName || '—'}</span>
          </span>
        </div>
        <p className="text-[11px] sm:text-xs font-medium text-amber-900/90 sm:text-right sm:max-w-[58%] leading-snug">
          {t('device_session_banner_body')}
        </p>
      </div>
    </div>
  );
};

export default DeviceSessionBanner;
