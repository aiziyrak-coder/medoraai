import React from 'react';
import { sanitizeClinicalContent } from '../../utils/sanitizeClinicalContent';

/** Matndagi markdown havolalar, qavs ichidagi manbalar va http(s) URL larni bosiladigan havolaga aylantiradi */
const TOKEN_RE =
  /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\(([^)\n]{2,140}?),\s*(https?:\/\/[^\s)]+)\)|\(([^)\n]{2,140}?)\s+(https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>\]]+)/gi;

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

  return <span className={`whitespace-pre-wrap break-words ${className}`}>{nodes}</span>;
};

export default LinkifiedText;
