import React from 'react';
import { sanitizeClinicalContent } from '../../utils/sanitizeClinicalContent';

/** Matndagi markdown havolalar, qavs ichidagi manbalar va http(s) URL larni bosiladigan havolaga aylantiradi */
const TOKEN_RE =
  /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\(([^)\n]{2,140}?),\s*(https?:\/\/[^\s)]+)\)|\(([^)\n]{2,140}?)\s+(https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>\]]+)/gi;

/** Protokol/manba nomi URL siz qolganida — lex.uz qidiruv */
const BARE_SOURCE_PARENS_RE =
  /\(([^)\n]{3,120}?(?:protokol|SSV|PubMed|Cochrane|WHO|ESC|NICE|NEJM|Lancet|Manba|Dalil|Qo['']llanma)[^)\n]{0,60}?)\)/gi;

function lexSearchUrl(label: string): string {
  const q = encodeURIComponent(label.replace(/https?:\/\/\S+/g, '').trim() || 'klinik protokol SSV');
  return `https://lex.uz/ru/search?type=1&search_text=${q}`;
}

function pubmedSearchUrl(label: string): string {
  const q = encodeURIComponent(label.replace(/https?:\/\/\S+/g, '').trim() || 'clinical guideline');
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${q}`;
}

function resolveBareCitation(label: string): string {
  const low = label.toLowerCase();
  if (/pubmed|nejm|lancet|cochrane|esc|nice|who|jama|bmj/.test(low)) {
    return pubmedSearchUrl(label);
  }
  return lexSearchUrl(label);
}

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)\]"']+$/g, '');
}

function renderLink(href: string, label: string, key: string) {
  const cleanHref = trimTrailingPunctuation(href);
  return (
    <a
      key={key}
      href={cleanHref}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline break-all hover:text-blue-800 font-medium"
      title={cleanHref}
    >
      {label}
    </a>
  );
}

export const LinkifiedText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  if (!text) return null;

  const safeText = sanitizeClinicalContent(text);
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(safeText)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`t-${lastIndex}`}>{safeText.slice(lastIndex, match.index)}</React.Fragment>,
      );
    }

    if (match[1] && match[2]) {
      nodes.push(renderLink(match[2], match[1], `md-${match.index}`));
    } else if (match[3] && match[4]) {
      nodes.push(
        <React.Fragment key={`c-${match.index}`}>
          ({renderLink(match[4], match[3].trim(), `c1-${match.index}`)})
        </React.Fragment>,
      );
    } else if (match[5] && match[6]) {
      nodes.push(
        <React.Fragment key={`c2-${match.index}`}>
          ({renderLink(match[6], match[5].trim(), `c2-${match.index}`)})
        </React.Fragment>,
      );
    } else if (match[7]) {
      const href = trimTrailingPunctuation(match[7]);
      nodes.push(renderLink(href, href, `u-${match.index}`));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < safeText.length) {
    nodes.push(<React.Fragment key={`t-end`}>{safeText.slice(lastIndex)}</React.Fragment>);
  }

  // URL siz qolgan manba qavslarini havolaga aylantirish
  const withBareLinks = nodes.map((node, idx) => {
    if (typeof node !== 'object' || node === null || !('props' in node)) return node;
    const children = (node as React.ReactElement).props?.children;
    if (typeof children !== 'string' || !children.includes('(')) return node;
    const parts: React.ReactNode[] = [];
    let bareLast = 0;
    let bareMatch: RegExpExecArray | null;
    BARE_SOURCE_PARENS_RE.lastIndex = 0;
    while ((bareMatch = BARE_SOURCE_PARENS_RE.exec(children)) !== null) {
      if (bareMatch[0].includes('http')) continue;
      if (bareMatch.index > bareLast) {
        parts.push(children.slice(bareLast, bareMatch.index));
      }
      const label = bareMatch[1].trim();
      const href = resolveBareCitation(label);
      parts.push(
        <React.Fragment key={`bare-${idx}-${bareMatch.index}`}>
          ({renderLink(href, label, `bare-${idx}-${bareMatch.index}`)})
        </React.Fragment>,
      );
      bareLast = bareMatch.index + bareMatch[0].length;
    }
    if (parts.length === 0) return node;
    if (bareLast < children.length) parts.push(children.slice(bareLast));
    return <React.Fragment key={`bare-wrap-${idx}`}>{parts}</React.Fragment>;
  });

  return <span className={`whitespace-pre-wrap break-words ${className}`}>{withBareLinks}</span>;
};

export default LinkifiedText;
