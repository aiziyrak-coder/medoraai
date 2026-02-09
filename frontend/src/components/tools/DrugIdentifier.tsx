import React, { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { identifyDrugByImage, identifyDrugByName } from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';
import CameraIcon from '../icons/CameraIcon';

interface DrugInfo {
    name: string;
    activeIngredient: string;
    dosage: string;
    indications: string[];
    contraindications: string[];
    sideEffects: string[];
    dosageInstructions: string;
    availabilityInUzbekistan: string;
    priceRange: string;
}

const DrugIdentifier: React.FC = () => {
    const { t } = useTranslation();
    const [searchText, setSearchText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<DrugInfo | null>(null);
    const [mode, setMode] = useState<'text' | 'image'>('text');

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleIdentify = async () => {
        setIsAnalyzing(true);
        try {
            if (mode === 'text' && searchText.trim()) {
                const info = await identifyDrugByName(searchText, 'uz-L');
                setResult(info);
            } else if (mode === 'image' && imageFile) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = (e.target?.result as string).split(',')[1];
                    const info = await identifyDrugByImage(base64, imageFile.type, 'uz-L');
                    setResult(info);
                    setIsAnalyzing(false);
                };
                reader.readAsDataURL(imageFile);
                return;
            }
        } catch (error) {
            alert(t('alert_error_generic'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="w-full">
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/10 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <span className="text-2xl">🔍</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Dori Aniqlash</h2>
                            <p className="text-xs text-slate-400">
                                Dori nomi yoki qadoq rasmini kiriting. Tizim faol modda, asosiy ko'rsatmalar, kontrendikatsiyalar va qabul qilish yo'riqnomasi bo'yicha ma'lumot beradi.
                                Bu klinik qarorni to'liq almashtirmaydi, lekin tez orientatsiya uchun yordam beradi.
                            </p>
                    </div>
                </div>

                <div className="flex gap-2 mb-4 bg-slate-800/50 p-1 rounded-xl">
                    <button
                        onClick={() => setMode('text')}
                        className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${mode === 'text' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
                    >
                        ✍️ Nom
                    </button>
                    <button
                        onClick={() => setMode('image')}
                        className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${mode === 'image' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
                    >
                        📸 Rasm
                    </button>
                </div>

                {mode === 'text' ? (
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Dori nomi (Panadol, Nimesil, Augmentin...)"
                            className="w-full px-4 py-3 bg-white text-slate-900 rounded-xl border-2 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
                        />
                        <button
                            onClick={handleIdentify}
                            disabled={isAnalyzing || !searchText.trim()}
                            className="w-full animated-gradient-button text-white font-bold py-3 rounded-xl disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <SpinnerIcon className="w-5 h-5" /> Qidirilmoqda...
                                </span>
                            ) : 'Qidirish'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Dori qadoq" className="max-h-64 mx-auto rounded-lg" />
                            ) : (
                                <label className="cursor-pointer block">
                                    <CameraIcon className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                                    <p className="text-slate-600 font-semibold">Dori qadoq rasmini yuklang</p>
                                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                                </label>
                            )}
                        </div>
                        {imageFile && (
                            <button
                                onClick={handleIdentify}
                                disabled={isAnalyzing}
                                className="w-full animated-gradient-button text-white font-bold py-3 rounded-xl disabled:opacity-50"
                            >
                                {isAnalyzing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <SpinnerIcon className="w-5 h-5" /> Aniqlanmoqda...
                                    </span>
                                ) : 'Aniqlash'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {result && (
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/10 shadow-xl space-y-4 animate-fade-in-up mt-4">
                    <div className="border-b border-white/10 pb-4">
                        <h3 className="text-2xl font-bold text-white">{result.name}</h3>
                        <p className="text-sm text-slate-300 mt-1">Faol modda: {result.activeIngredient}</p>
                        <p className="text-sm font-bold text-blue-400 mt-2">{result.dosage}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                        <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/20">
                            <h4 className="font-bold text-blue-300 mb-2 text-sm flex items-center gap-1">
                                <span>📌</span> Ko'rsatmalar
                            </h4>
                            <ul className="space-y-1 text-slate-300 text-xs">
                                {(result.indications || []).slice(0, 5).map((ind, i) => (
                                    <li key={i} className="flex gap-1"><span className="text-blue-400">•</span> {ind}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/20">
                            <h4 className="font-bold text-red-300 mb-2 text-sm flex items-center gap-1">
                                <span>⚠️</span> Kontrendikatsiyalar
                            </h4>
                            <ul className="space-y-1 text-slate-300 text-xs">
                                {(result.contraindications || []).slice(0, 5).map((con, i) => (
                                    <li key={i} className="flex gap-1"><span className="text-red-400">•</span> {con}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="bg-orange-900/20 p-3 rounded-lg border border-orange-500/20">
                        <h4 className="font-bold text-orange-300 mb-2 text-sm flex items-center gap-1">
                            <span>🔴</span> Yon ta'sirlar
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {(result.sideEffects || []).slice(0, 8).map((side, i) => (
                                <span key={i} className="px-2 py-1 bg-orange-500/10 text-orange-200 rounded text-xs">{side}</span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 p-4 rounded-xl border border-blue-400/20">
                        <h4 className="font-bold text-blue-200 mb-2 text-sm flex items-center gap-1">
                            <span>📋</span> Qabul qilish yo'riqnomasi
                        </h4>
                        <p className="text-blue-100 text-sm leading-relaxed">{result.dosageInstructions}</p>
                    </div>

                    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 rounded-xl border border-green-400/20">
                        <h4 className="font-bold text-green-200 mb-2 text-sm flex items-center gap-1">
                            <span>🇺🇿</span> O'zbekistonda
                        </h4>
                        <p className="text-green-100 text-sm">{result.availabilityInUzbekistan}</p>
                        {result.priceRange && (
                            <p className="text-green-300 text-sm font-bold mt-2">💰 Narx: {result.priceRange}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrugIdentifier;
