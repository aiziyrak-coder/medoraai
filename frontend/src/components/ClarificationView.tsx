import React, { useState, useEffect } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';

interface ClarificationViewProps {
    isGenerating: boolean;
    questions: string[] | null;
    onSubmit: (answers: Record<string, string>) => void;
    statusMessage: string;
    error: string | null;
}

const ClarificationView: React.FC<ClarificationViewProps> = ({ isGenerating, questions, onSubmit, statusMessage, error }) => {
    const [answers, setAnswers] = useState<Record<string, string>>({});

    useEffect(() => {
        if (questions) {
            // Initialize answers state, but don't overwrite existing on re-render
            setAnswers(prev => {
                const newAnswers = {...prev};
                questions.forEach((_, index) => {
                    if (newAnswers[index] === undefined) {
                        newAnswers[index] = '';
                    }
                });
                return newAnswers;
            });
        }
    }, [questions]);


    const handleAnswerChange = (index: number, value: string) => {
        setAnswers(prev => ({...prev, [index]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(answers);
    };
    
    if (isGenerating && !questions?.length) {
        return (
             <div className="glass-panel animate-fade-in-up p-8 text-center">
                <SpinnerIcon className="w-10 h-10 mx-auto text-accent-color-cyan" />
                <p className="mt-4 font-semibold text-text-primary">{statusMessage || "Konsilium uchun qo'shimcha savollar tayyorlanmoqda..."}</p>
                <p className="text-sm text-text-secondary">Iltimos, kuting.</p>
            </div>
        );
    }
    
    // Handle the case where question generation fails but we allow the user to proceed.
    if (!isGenerating && questions && questions.length === 0) {
         return (
             <div className="glass-panel animate-fade-in-up p-6 md:p-8">
                <div className="text-center mb-8">
                     <h3 className="text-xl font-bold text-text-primary">Konsiliumning Aniqlashtiruvchi Savollari</h3>
                     <p className="text-sm text-text-secondary mt-1">Tahlilning aniqligini oshirish uchun quyidagi savollarga javob bering.</p>
                </div>
                {error && (
                    <div className="p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-100 border border-yellow-200" role="alert">
                      <span className="font-bold">Ma'lumot:</span> {error}
                    </div>
                )}
                <p className="text-center text-text-secondary">AI savol yaratmadi. Tahlilni mavjud ma'lumotlar bilan davom ettirishingiz mumkin.</p>
                <div className="pt-4 mt-4">
                    <button
                        onClick={handleSubmit}
                        className="w-full flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all duration-300 transform hover:scale-105"
                    >
                        Konsiliumni Boshlash
                    </button>
                </div>
             </div>
         )
    }

    return (
        <div className="glass-panel animate-fade-in-up p-6 md:p-8">
            <div className="text-center mb-8">
                 <h3 className="text-xl font-bold text-text-primary">Konsiliumning Aniqlashtiruvchi Savollari</h3>
                 <p className="text-sm text-text-secondary mt-1">Tahlilning aniqligini oshirish uchun quyidagi savollarga javob bering.</p>
            </div>

            {error && (
                <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-100 border border-red-200" role="alert">
                  <span className="font-bold">Xatolik!</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {questions?.map((q, index) => {
                    if (q.startsWith('---')) {
                        const title = q.replace(/---/g, '');
                        return (
                             <div key={`header-${index}`} className="!mt-8 pt-6 border-t border-border-color">
                                <h4 className="font-semibold text-text-primary text-center">{title}</h4>
                            </div>
                        )
                    }

                    const questionNumber = questions.slice(0, index + 1).filter(item => !item.startsWith('---')).length;

                    return (
                        <div key={index}>
                            <label htmlFor={`question-${index}`} className="block text-sm font-medium text-text-secondary mb-2">
                                {questionNumber}. {q}
                            </label>
                            <textarea
                                id={`question-${index}`}
                                rows={3}
                                value={answers[index] || ''}
                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                className="block w-full sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition shadow-sm px-3 py-2"
                                placeholder="Javobingizni shu yerga yozing..."
                            />
                        </div>
                    );
                })}

                <div className="pt-4">
                    <button
                        type="submit"
                        className="w-full flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all duration-300 transform hover:scale-105"
                    >
                        Konsiliumni Boshlash
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ClarificationView;