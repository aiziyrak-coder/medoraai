import React from 'react';
import type { VitalSigns } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import EkgWaveIcon from '../icons/EkgWaveIcon';
import HeartRateIcon from '../icons/HeartRateIcon';
import OxygenIcon from '../icons/OxygenIcon';

interface RealTimePatientMonitorProps {
    vitals: VitalSigns | null;
    isConnecting: boolean;
    isConnected: boolean;
    onDisconnect: () => void;
    onCapture: () => void;
    captureMessage: string;
    onBack?: () => void; // Optional: For use in full-page ToolsDashboard
}

const VitalDisplay: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    unit: string;
    colorClass: string;
}> = ({ icon, label, value, unit, colorClass }) => (
    <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-8 h-8 ${colorClass}`}>{icon}</div>
        <div>
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">
                {value} <span className="text-sm font-normal text-slate-300">{unit}</span>
            </p>
        </div>
    </div>
);

const RealTimePatientMonitor: React.FC<RealTimePatientMonitorProps> = ({
    vitals, isConnecting, isConnected, onDisconnect, onCapture, captureMessage, onBack
}) => {
    if (isConnecting) {
        return (
            <div className="bg-slate-800 p-6 rounded-2xl text-center border-2 border-slate-700">
                <SpinnerIcon className="w-8 h-8 mx-auto text-accent-color-cyan" />
                <p className="mt-3 font-semibold text-white">Qurilmaga ulanilmoqda...</p>
            </div>
        );
    }

    if (!isConnected) {
        // This component might be used in a context where it's not immediately visible,
        // so returning null is appropriate if there's no connection attempt.
        return null; 
    }

    return (
        <div className="bg-slate-900/80 backdrop-blur-sm p-4 rounded-2xl border-2 border-slate-700 shadow-2xl animate-fade-in-up">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <VitalDisplay
                    icon={<HeartRateIcon />}
                    label="Puls"
                    value={vitals?.heartRate ?? '--'}
                    unit="bpm"
                    colorClass="text-green-400"
                />
                <VitalDisplay
                    icon={<OxygenIcon />}
                    label="SpO₂"
                    value={vitals?.spO2 ?? '--'}
                    unit="%"
                    colorClass="text-cyan-400"
                />
                <div className="col-span-2 md:col-span-1">
                     <VitalDisplay
                        icon={<div className="w-8 h-8 flex items-center justify-center font-bold text-sm text-yellow-400 border-2 border-yellow-400/50 rounded-full">AQB</div>}
                        label="Qon Bosimi"
                        value={`${vitals?.bpSystolic ?? '--'}/${vitals?.bpDiastolic ?? '--'}`}
                        unit="mm.sim.ust."
                        colorClass="text-yellow-400"
                    />
                </div>
                 <VitalDisplay
                    icon={<div className="w-8 h-8 flex items-center justify-center font-bold text-sm text-blue-400 border-2 border-blue-400/50 rounded-full">N/S</div>}
                    label="Nafas Soni"
                    value={vitals?.respirationRate ?? '--'}
                    unit="/min"
                    colorClass="text-blue-400"
                />
            </div>
            
            <div className="h-24 w-full bg-black/30 rounded-lg overflow-hidden relative flex items-center">
                <EkgWaveIcon className="absolute w-full h-16 text-green-400" />
                <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3">
                <div className="text-center sm:text-left">
                     <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Ulangan
                    </p>
                    {captureMessage && <p className="text-xs text-cyan-300 mt-1">{captureMessage}</p>}
                </div>
                <div className="flex items-center gap-3">
                     <button onClick={onCapture} className="px-4 py-2 text-sm font-bold text-slate-900 bg-green-400 rounded-lg hover:bg-green-300 transition-colors">
                        Ma'lumotlarni Saqlash
                    </button>
                    <button onClick={onBack || onDisconnect} className="px-4 py-2 text-sm font-semibold text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                        {onBack ? "Orqaga" : "Uzish"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RealTimePatientMonitor;
