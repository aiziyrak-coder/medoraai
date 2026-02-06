import React, { useState } from 'react';
import { FollowUpTask } from '../../types';
import ClipboardListIcon from '../icons/ClipboardListIcon';

interface FollowUpPlanProps {
    tasks: FollowUpTask[];
}

const FollowUpPlan: React.FC<FollowUpPlanProps> = ({ tasks }) => {
    const [completedTasks, setCompletedTasks] = useState<string[]>([]);
    
    const toggleTask = (taskName: string) => {
        setCompletedTasks(prev => 
            prev.includes(taskName) ? prev.filter(t => t !== taskName) : [...prev, taskName]
        );
    };

    return (
         <div className="p-4 bg-slate-100 rounded-lg border border-border-color">
            <h4 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                <ClipboardListIcon className="w-5 h-5 text-purple-600" /> Keyingi Qadamlar Rejasi
            </h4>
            <div className="space-y-2">
                {tasks.map((task, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 bg-white rounded-md">
                        <input
                            type="checkbox"
                            id={`task-${index}`}
                            checked={completedTasks.includes(task.task)}
                            onChange={() => toggleTask(task.task)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`task-${index}`} className={`flex-1 text-sm ${completedTasks.includes(task.task) ? 'line-through text-slate-400' : 'text-text-primary'}`}>
                            {task.task}
                            <span className="block text-xs text-slate-500">{task.timeline} (Mas'ul: {task.responsible})</span>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FollowUpPlan;
