import React from 'react';

interface SettingsCardProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    badge?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, icon, children, badge }) => {
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-premium transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-50 text-black rounded-lg border border-gray-100">
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-xl font-display font-semibold text-foreground tracking-tight flex items-center gap-2">
                            {title}
                            {badge && (
                                <span className="px-2 py-0.5 rounded-full bg-black/5 text-black text-[11px] uppercase font-bold tracking-wider border border-black/10">
                                    {badge}
                                </span>
                            )}
                        </h3>
                        {description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-sm">{description}</p>}
                    </div>
                </div>
            </div>
            <div className="space-y-5 pt-4 border-t border-border/40">
                {children}
            </div>
        </div>
    );
};
