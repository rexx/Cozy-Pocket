import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  accentClassName?: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  icon: Icon,
  accentClassName = 'border-white/8 bg-cyan-500/12 text-cyan-200',
  children,
}) => {
  return (
    <section className="rounded-[28px] border border-white/8 bg-white/[0.045] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-6">
      <header className="mb-5 flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${accentClassName}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-black tracking-[0.02em] text-white">{title}</h2>
          <p className="text-xs leading-relaxed text-slate-400">{description}</p>
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
};

export const sectionPanelClassName = 'rounded-2xl border border-white/10 bg-[#131726]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
export const sectionLabelClassName = 'text-[11px] font-black uppercase tracking-[0.18em] text-slate-500';
export const sectionInputClassName = 'w-full rounded-2xl border border-white/10 bg-[#0f1321] px-3 py-3 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/40';
export const sectionSelectClassName = 'rounded-2xl border border-white/10 bg-[#0f1321] px-3 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-cyan-400/40';
export const sectionButtonBaseClassName = 'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';
export const sectionSecondaryButtonClassName = `${sectionButtonBaseClassName} border-white/10 bg-white/5 text-slate-100 hover:bg-white/10`;
export const sectionCyanButtonClassName = `${sectionButtonBaseClassName} border-cyan-400/25 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/20`;
export const sectionEmeraldButtonClassName = `${sectionButtonBaseClassName} border-emerald-400/25 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20`;
export const sectionAmberButtonClassName = `${sectionButtonBaseClassName} border-amber-400/25 bg-amber-500/15 text-amber-200 hover:bg-amber-500/20`;
export const sectionRedButtonClassName = `${sectionButtonBaseClassName} border-red-400/25 bg-red-500/15 text-red-200 hover:bg-red-500/20`;
export const sectionInfoCardClassName = 'rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-slate-300';

export default SettingsSection;
