import React, { useState } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';

interface SocraticModeViewProps {
    onBack: () => void;
}

// Mocked data for demonstration
const mockCase = {
    title: "Nafas qisilishi bilan 58 yoshli erkak",
    summary: "58 yoshli erkak, chekish va gipertoniya anamneziga ega, 3 kun davomida kuchayib borayotgan nafas qisilishidan shikoyat qilmoqda. Yo'tal va isitma yo'q. Ko'rikda oyoqlarida shishlar aniqlangan.",
    questions: [
        {
            id: 1,
            question: "Ushbu bemor uchun eng ehtimolli tashxis qaysi?",
            options: ["Pnevmoniya", "O'tkir dekompensatsiyalangan yurak yetishmovchiligi", "O'pka arteriyasi tromboemboliyasi", "Astma xuruji"],
            correctAnswer: "O'tkir dekompensatsiyalangan yurak yetishmovchiligi",
            rationale: "Nafas qisilishining asta-sekin kuchayishi, gipertoniya anamnezi va periferik shishlar yurak yetishmovchiligiga ko'proq mos keladi."
        },
        {
            id: 2,
            question: "Keyingi eng muhim diagnostik tekshiruv qaysi?",
            options: ["Ko'krak qafasi rentgenogrammasi", "Qonda D-dimer miqdori", "BNP (Miya natriyuretik peptidi) tahlili", "Elektrokardiogramma (EKG)"],
            correctAnswer: "BNP (Miya natriyuretik peptidi) tahlili",
            rationale: "BNP darajasining oshishi yurak yetishmovchiligi tashxisini tasdiqlash uchun yuqori sezgir va o'ziga xos belgidir."
        }
    ]
};

const SocraticModeView: React.FC<SocraticModeViewProps> = ({ onBack }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);

    const handleAnswerSelect = (option: string) => {
        if (isAnswered) return;
        setSelectedAnswer(option);
        setIsAnswered(true);
    };

    const handleNext = () => {
        if (currentQuestionIndex < mockCase.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setIsAnswered(false);
        } else {
            // End of session
            alert("Trening yakunlandi!");
            onBack();
        }
    };
    
    const currentQuestion = mockCase.questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    return (
        <div className="glass-panel p-6 md:p-8 animate-fade-in-up max-w-3xl mx-auto">
            <button onClick={onBack} className="text-sm font-semibold text-accent-color-blue hover:underline mb-4">
                &larr; Bosh Sahifaga
            </button>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Sokratik Trening Rejimi</h2>
            <p className="text-text-secondary mb-6">Klinik fikrlash qobiliyatingizni sinab ko'ring.</p>

            <div className="p-4 bg-slate-50 rounded-lg border border-border-color">
                <h3 className="font-bold text-lg text-text-primary">{mockCase.title}</h3>
                <p className="text-sm mt-1">{mockCase.summary}</p>
            </div>

            <div className="mt-6">
                <h4 className="font-semibold text-text-primary mb-3">{currentQuestion.question}</h4>
                <div className="space-y-3">
                    {currentQuestion.options.map(option => {
                        const isSelected = selectedAnswer === option;
                        let buttonClass = "bg-slate-100 hover:bg-slate-200 border-border-color";
                        if(isAnswered) {
                            if (option === currentQuestion.correctAnswer) {
                                buttonClass = "bg-green-100 border-green-300 text-green-800 font-bold";
                            } else if (isSelected && !isCorrect) {
                                buttonClass = "bg-red-100 border-red-300 text-red-800";
                            }
                        }
                        
                        return (
                            <button
                                key={option}
                                onClick={() => handleAnswerSelect(option)}
                                className={`w-full text-left p-3 rounded-lg border transition-colors ${buttonClass}`}
                                disabled={isAnswered}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {isAnswered && (
                <div className={`mt-4 p-4 rounded-lg animate-fade-in-up ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                    <h5 className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                        {isCorrect ? "To'g'ri!" : "Noto'g'ri."}
                    </h5>
                    <p className="text-sm mt-1">{currentQuestion.rationale}</p>
                    <button onClick={handleNext} className="mt-3 animated-gradient-button text-sm font-semibold px-4 py-2">
                        {currentQuestionIndex < mockCase.questions.length - 1 ? "Keyingi Savol" : "Yakunlash"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SocraticModeView;
