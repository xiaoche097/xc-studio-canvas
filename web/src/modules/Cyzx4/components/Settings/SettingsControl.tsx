import React from 'react';

interface SettingsControlProps {
    label: string;
    description?: string;
    children: React.ReactNode;
}

export const SettingsControl: React.FC<SettingsControlProps> = ({ label, description, children }) => (
    <div className="flex items-center justify-between gap-8 py-2">
        <div className="flex-1">
            <label className="text-base font-bold text-foreground/90 block mb-0.5">{label}</label>
            {description && <p className="text-xs text-muted-foreground font-medium leading-snug">{description}</p>}
        </div>
        <div className="flex-shrink-0">
            {children}
        </div>
    </div>
);

export const SettingsToggle: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-11 h-6 rounded-full transition-all duration-300 relative ${active ? 'bg-black shadow-lg shadow-black/10' : 'bg-gray-200'}`}
    >
        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${active ? 'translate-x-5' : ''}`} />
    </button>
);

export const SettingsInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className={`bg-gray-50/50 border border-gray-200 text-gray-900 text-[15px] font-medium rounded-xl focus:ring-4 focus:ring-black/5 focus:border-gray-400 block w-full px-5 py-3 outline-none transition-all placeholder:text-gray-400 ${props.className || ''}`}
    />
);

export const SettingsSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <div className="relative w-full">
        <select
            {...props}
            className={`bg-gray-50/50 border border-gray-200 text-gray-900 text-[15px] font-medium rounded-xl focus:ring-4 focus:ring-black/5 focus:border-gray-400 block w-full px-5 py-3 outline-none transition-all appearance-none cursor-pointer ${props.className || ''}`}
        >
            {props.children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
            </svg>
        </div>
    </div>
);
