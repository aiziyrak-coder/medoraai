import React, { useState } from 'react';
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
            alert('Xatolik yuz berdi. Qayta urinib ko\'ring.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-2">🔍 Dori Aniqlash</h2>
                <p className="text-sm text-slate-300 mb-6">Dori nomi yoki qadoq rasmi orqali batafsil ma'lumot oling</p>

                <div className="flex gap-3 mb-6">
                    <button
                        onClick={() => setMode('text')}
                        className={`flex-1 py-3 rounded-xl font-bold transition ${mode === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                        ✍️ Nomi bo'yicha
                    </button>
                    <button
                        onClick={() => setMode('image')}
                        className={`flex-1 py-3 rounded-xl font-bold transition ${mode === 'image' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                        📸 Rasm bo'yicha
                    </button>
                </div>

                {mode === 'text' ? (
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Dori nomi (masalan: Panadol, Nimesil, Augmentin...)"
                            className="w-full px-4 py-3 bg-white/90 text-slate-900 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg"
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
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-4 animate-fade-in-up">
                    <div className="border-b border-white/10 pb-4">
                        <h3 className="text-2xl font-bold text-white">{result.name}</h3>
                        <p className="text-sm text-slate-300 mt-1">Faol modda: {result.activeIngredient}</p>
                        <p className="text-sm font-bold text-blue-400 mt-2">{result.dosage}</p>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-2">📌 Ko'rsatmalar:</h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                            {result.indications.map((ind, i) => (
                                <li key={i}>{ind}</li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-2">⚠️ Kontrendikatsiyalar:</h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                            {result.contraindications.map((con, i) => (
                                <li key={i}>{con}</li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-2">🔴 Yon ta'sirlar:</h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                            {result.sideEffects.map((side, i) => (
                                <li key={i}>{side}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-bold text-blue-900 mb-2">📋 Qabul qilish yo'riqnomasi:</h4>
                        <p className="text-blue-800 text-sm">{result.dosageInstructions}</p>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-bold text-green-900 mb-2">🇺🇿 O'zbekistonda mavjudligi:</h4>
                        <p className="text-green-800 text-sm">{result.availabilityInUzbekistan}</p>
                        {result.priceRange && (
                            <p className="text-green-700 text-sm font-bold mt-1">Narx: {result.priceRange}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrugIdentifier;
