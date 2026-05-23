import React from 'react';

/** Matndagi http(s) URL larni bosiladigan havolaga aylantiradi */
const URL_PATTERN = /(https?:\/\/[^\s<>\]]+)/gi;

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)\]"']+$/g, '');
}

export const LinkifiedText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  if (!text) return null;

  const parts = text.split(URL_PATTERN);

  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^https?:\/\//i.test(part)) {
          const href = trimTrailingPunctuation(part);
          return (
            <a
              key={`url-${i}-${href.slice(0, 24)}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline break-all hover:text-blue-800 font-medium"
            >
              {href}
            </a>
          );
        }
        return <React.Fragment key={`t-${i}`}>{part}</React.Fragment>;
      })}
    </span>
  );
};

export default LinkifiedText;
