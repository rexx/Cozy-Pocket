import React from 'react';

interface PageHeaderProps {
  title: string;
  leftAction: React.ReactNode;
  onLeftAction: () => void;
  rightSlot?: React.ReactNode;
}

const baseButtonClassName = 'p-2 text-gray-400 active:scale-90 transition-transform';

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  leftAction,
  onLeftAction,
  rightSlot,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-white/5 bg-[#1a1c2c] px-4 pb-4 pt-0">
      <button
        type="button"
        onClick={onLeftAction}
        className={baseButtonClassName}
        aria-label={title}
      >
        {leftAction}
      </button>
      <h1 className="text-lg font-bold tracking-wide text-white">{title}</h1>
      <div className="flex w-10 items-center justify-end">
        {rightSlot || null}
      </div>
    </div>
  );
};

export default PageHeader;
