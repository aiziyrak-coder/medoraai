import React from 'react';

interface MoleculeViewerProps {
    target: {
        name: string;
        pdbId?: string;
    }
}

const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ target }) => {
    return (
        <div className="bg-slate-100 rounded-xl p-4 border border-border-color flex flex-col justify-between h-full">
            <div>
                <h5 className="font-semibold text-text-secondary">Molekulyar Nishon</h5>
                <p className="font-bold text-lg text-text-primary">{target.name}</p>
            </div>
            <div className="flex-grow flex items-center justify-center my-4">
                {/* Placeholder for a 3D molecule animation */}
                <div className="relative w-24 h-24">
                    <div className="absolute inset-0 border-2 border-accent-color-blue/30 rounded-full animate-spin" style={{animationDuration: '10s'}}></div>
                    <div className="absolute inset-2 border-2 border-accent-color-cyan/30 rounded-full animate-spin" style={{animationDuration: '8s', animationDirection: 'reverse'}}></div>
                    <div className="absolute inset-4 flex items-center justify-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-accent-color-blue to-accent-color-purple rounded-full animate-pulse shadow-lg"></div>
                    </div>
                </div>
            </div>
            {target.pdbId && target.pdbId !== 'N/A' && (
                <a 
                    href={`https://www.rcsb.org/structure/${target.pdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center block bg-slate-200 hover:bg-slate-300 text-text-primary text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                    PDB da ko'rish: {target.pdbId}
                </a>
            )}
        </div>
    )
}

export default MoleculeViewer;
