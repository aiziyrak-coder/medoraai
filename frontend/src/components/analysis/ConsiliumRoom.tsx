/**
 * Konsilium zali: aylana stol, o'rindiqlar (chaqirilgan mutaxassislar),
 * kim gapirsa shu odam ustida speech bubble, qisqa dialoglar va animatsiya.
 */
import React, { useState, useEffect, useMemo } from 'react';
import type { ChatMessage } from '../../types';
import { AIModel } from '../../types';
import AIAvatar from '../AIAvatar';
import { AI_SPECIALISTS } from '../../constants';
import { useTranslation } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../hooks/useTranslation';

const SPEAKER_DURATION_MS = 7000;
const TABLE_R = 28;
const SEAT_R = 38;

interface ConsiliumRoomProps {
  debateHistory: ChatMessage[];
  selectedSpecialists?: AIModel[];
}

function getSpecialistsOrder(debateHistory: ChatMessage[], selectedSpecialists?: AIModel[]): AIModel[] {
  const fromHistory = [...new Set(debateHistory.map(m => m.author).filter(a => a && a !== AIModel.SYSTEM))] as AIModel[];
  if (selectedSpecialists && selectedSpecialists.length > 0) {
    const order = selectedSpecialists.filter(s => fromHistory.includes(s));
    const rest = fromHistory.filter(a => !order.includes(a));
    return [...order, ...rest];
  }
  return fromHistory;
}

export const ConsiliumRoom: React.FC<ConsiliumRoomProps> = ({ debateHistory, selectedSpecialists }) => {
  const { t } = useTranslation();
  const specialistMessages = useMemo(() =>
    debateHistory.filter(m => !m.isSystemMessage && !m.isUserIntervention),
    [debateHistory]
  );
  const speakers = useMemo(() => getSpecialistsOrder(debateHistory, selectedSpecialists), [debateHistory, selectedSpecialists]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentMessage = specialistMessages[currentIndex] ?? null;

  useEffect(() => {
    if (specialistMessages.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIndex(i => (i + 1) % specialistMessages.length);
    }, SPEAKER_DURATION_MS);
    return () => clearInterval(id);
  }, [specialistMessages.length]);

  if (speakers.length === 0) return null;

  const n = Math.min(speakers.length, 10);
  const seats = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      author: speakers[i],
      x: 50 + SEAT_R * Math.cos(angle),
      y: 50 + SEAT_R * Math.sin(angle),
    };
  });

  const currentAuthor = currentMessage?.author;
  const bubbleContent = currentMessage?.content?.slice(0, 280) + (currentMessage?.content && currentMessage.content.length > 280 ? '...' : '');

  return (
    <div className="consilium-room w-full max-w-2xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-600/50 shadow-2xl">
      <div className="aspect-[4/3] relative">
        {/* Stol aylana */}
        <div
          className="absolute rounded-full border-4 border-amber-800/80 bg-amber-900/40 shadow-inner"
          style={{
            width: `${TABLE_R * 2}%`,
            height: `${TABLE_R * 2}%`,
            left: `${50 - TABLE_R}%`,
            top: `${50 - TABLE_R}%`,
          }}
        />
        {/* O'rindiqlar va avatarlar */}
        {seats.map(({ author, x, y }) => {
          const isSpeaking = currentAuthor === author;
          const name = t(`specialist_name_${String(author).toLowerCase()}` as TranslationKey) || AI_SPECIALISTS[author]?.name || String(author);
          return (
            <div
              key={author}
              className="absolute flex flex-col items-center justify-center transition-all duration-500"
              style={{
                left: `${x - 6}%`,
                top: `${y - 8}%`,
                width: '12%',
                minWidth: 48,
              }}
            >
              {/* Speech bubble - faqat hozir gapiryotgan ustida */}
              {isSpeaking && bubbleContent && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] max-w-[90vw] animate-fade-in-up z-20">
                  <div className="rounded-2xl rounded-bl-md bg-white/95 text-slate-800 shadow-xl border border-slate-200 p-3 text-sm leading-relaxed">
                    <p className="whitespace-pre-wrap max-h-20 overflow-y-auto text-left">{bubbleContent}</p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white/95" />
                </div>
              )}
              {/* O'rindiq (doira) */}
              <div
                className={`rounded-full flex items-center justify-center transition-all duration-300 ${
                  isSpeaking
                    ? 'ring-4 ring-sky-400 ring-offset-2 ring-offset-slate-800 bg-sky-500/30 scale-110'
                    : 'bg-slate-700/80 border-2 border-slate-500'
                }`}
                style={{ width: 44, height: 44 }}
              >
                <AIAvatar model={author} size="xs" />
              </div>
              <span className="mt-1 text-[10px] font-medium text-slate-300 text-center leading-tight max-w-[70px] truncate">
                {name}
              </span>
            </div>
          );
        })}
      </div>
      {/* Progress: qaysi xabardan qaysi */}
      {specialistMessages.length > 1 && (
        <div className="px-4 pb-3 flex items-center justify-center gap-2">
          <span className="text-xs text-slate-400">
            {currentIndex + 1} / {specialistMessages.length}
          </span>
          <div className="flex gap-1">
            {specialistMessages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-sky-400 scale-125' : 'bg-slate-500 hover:bg-slate-400'
                }`}
                aria-label={`Xabar ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsiliumRoom;
