import React from 'react';

interface RoadmapTimelineProps {
    roadmap: {
        stage: string;
        duration: string;
        cost: string;
    }[];
}

const RoadmapTimeline: React.FC<RoadmapTimelineProps> = ({ roadmap }) => {
    if (!roadmap || roadmap.length === 0) {
        return <p className="text-sm text-text-secondary">Yo'l xaritasi mavjud emas.</p>;
    }
    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 -mb-3">
            {roadmap.map((item, index) => (
                <React.Fragment key={index}>
                    <div className="flex-shrink-0 w-48 p-3 bg-slate-100 rounded-lg border border-border-color text-center">
                        <p className="font-bold text-sm text-text-primary">{item.stage}</p>
                        <p className="text-xs text-accent-color-cyan mt-1">{item.duration}</p>
                        <p className="text-xs text-text-secondary">{item.cost}</p>
                    </div>
                    {index < roadmap.length - 1 && (
                         <div className="w-8 h-px bg-border-color"></div>
                    )}
                </React.Fragment>
            ))}
        </div>
    )
}

export default RoadmapTimeline;
