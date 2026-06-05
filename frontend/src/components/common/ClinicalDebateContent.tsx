import React from 'react';
import LinkifiedText from './LinkifiedText';
import { sanitizeClinicalContent } from '../../utils/sanitizeClinicalContent';

function stripLegacyMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s*->\s*/g, ' — ')
    .replace(/\s*→\s*/g, ' — ');
}

/** Konsilium munozarasi: ▸ bo'limlari, havolalar va raqamlangan dalillar */
export const ClinicalDebateContent: React.FC<{ text: string; className?: string }> = ({
  text,
  className = '',
}) => {
  const safe = stripLegacyMarkdown(sanitizeClinicalContent(text || ''));
  if (!safe) return null;

  if (!safe.includes('▸')) {
    return <LinkifiedText text={safe} className={className} />;
  }

  const chunks = safe.split(/\n\n+/).filter(Boolean);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {chunks.map((chunk, i) => {
        const lines = chunk.split('\n');
        const head = lines[0]?.trim() ?? '';
        if (head.startsWith('▸ ')) {
          const title = head.slice(2).trim();
          const body = lines.slice(1).join('\n').trim();
          const isAlert = /qizil|xavf|shoshilinch/i.test(title);
          return (
            <div
              key={`sec-${i}`}
              className={`rounded-xl border p-3 ${
                isAlert
                  ? 'border-red-500/30 bg-red-950/20'
                  : 'border-slate-600/25 bg-slate-900/25'
              }`}
            >
              <p
                className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${
                  isAlert ? 'text-red-400' : 'text-sky-400'
                }`}
              >
                {title}
              </p>
              {body && (
                <LinkifiedText
                  text={body}
                  className="text-sm text-slate-200 leading-relaxed"
                />
              )}
            </div>
          );
        }
        return (
          <LinkifiedText key={`blk-${i}`} text={chunk} className="text-sm text-slate-200" />
        );
      })}
    </div>
  );
};

export default ClinicalDebateContent;
