import React from 'react';
import LinkifiedText from './LinkifiedText';
import { sanitizeClinicalContent } from '../../utils/sanitizeClinicalContent';

const HIDDEN_DEBATE_SECTIONS = new Set([
  'TASHXIS',
  'EHTIMOLLIK VA DALIL DARAJASI',
  'YAKUNIY TASHXISLAR (MKB-10)',
]);

function shouldHideDebateSection(title: string): boolean {
  const t = title.trim().toUpperCase();
  if (HIDDEN_DEBATE_SECTIONS.has(t)) return true;
  if (t.startsWith('EHTIMOLLIK')) return true;
  return false;
}

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
          if (shouldHideDebateSection(title)) return null;
          const body = lines.slice(1).join('\n').trim();
          const isAlert = /qizil|xavf|shoshilinch/i.test(title);
          return (
            <div
              key={`sec-${i}`}
              className={`py-2 border-b last:border-b-0 ${
                isAlert ? 'border-red-200' : 'border-slate-200'
              }`}
            >
              <p
                className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
                  isAlert ? 'text-red-800' : 'text-slate-800'
                }`}
              >
                {title}
              </p>
              {body && (
                <LinkifiedText
                  text={body}
                  className="text-sm text-black leading-relaxed"
                />
              )}
            </div>
          );
        }
        return (
          <LinkifiedText key={`blk-${i}`} text={chunk} className="text-sm text-black" />
        );
      })}
    </div>
  );
};

export default ClinicalDebateContent;
