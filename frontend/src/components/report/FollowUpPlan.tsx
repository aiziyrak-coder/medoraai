import React, { useState } from 'react';
import { FollowUpTask } from '../../types';
import ClipboardListIcon from '../icons/ClipboardListIcon';
import { useTranslation } from '../../hooks/useTranslation';

interface FollowUpPlanProps {
    tasks: FollowUpTask[];
    embedded?: boolean;
}

const FollowUpPlan: React.FC<FollowUpPlanProps> = ({ tasks, embedded = false }) => {
    const { t } = useTranslation();
    const [completedTasks, setCompletedTasks] = useState<string[]>([]);
    
    const toggleTask = (taskName: string) => {
        setCompletedTasks(prev => 
            prev.includes(taskName) ? prev.filter(t => t !== taskName) : [...prev, taskName]
        );
    };

    const whoLabel = (r: FollowUpTask['responsible']) =>
        r === 'Patient' ? t('followup_responsible_patient') : t('followup_responsible_clinician');

    return (
         <div className={embedded ? '' : 'p-4 bg-slate-100 rounded-lg border border-border-color'}>
            {!embedded && (
                <h4 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                    <ClipboardListIcon className="w-5 h-5 text-purple-600" /> {t('final_report_follow_up_title')}
                </h4>
            )}
            <div className="space-y-2">
                {tasks.map((task, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 bg-white rounded-md border border-slate-100">
                        <input
                            type="checkbox"
                            id={`task-${index}`}
                            checked={completedTasks.includes(task.task)}
                            onChange={() => toggleTask(task.task)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`task-${index}`} className={`flex-1 text-sm ${completedTasks.includes(task.task) ? 'line-through text-slate-400' : 'text-text-primary'}`}>
                            {task.task}
                            <span className="block text-xs text-slate-500">{task.timeline} ({whoLabel(task.responsible)})</span>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FollowUpPlan;