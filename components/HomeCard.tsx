'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface HomeCardProps {
  className?: string;
  img?: string;
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionClassName?: string;
  descriptionClassName?: string;
  handleClick?: () => void;
}

const HomeCard = ({ className, img, icon, title, description, actionLabel, actionClassName, descriptionClassName, handleClick }: HomeCardProps) => {
  return (
    <section
      className={cn(
        'flex min-h-[190px] cursor-pointer flex-col items-center justify-between rounded-[14px] border border-black/5 px-2.5 py-3 text-center text-[#18121F] shadow-[0_7px_12px_rgba(71,38,96,0.12)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_20px_rgba(71,38,96,0.18)] sm:min-h-[204px] sm:px-5 sm:py-4',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex-center size-11 rounded-full bg-white shadow-sm sm:size-12">
        {icon || (img && <Image src={img} alt="meeting" width={27} height={27} className="h-6 w-6 object-contain" />)}
      </div>

      <div className="flex min-h-[58px] flex-col items-center justify-center gap-1 sm:min-h-[62px] sm:gap-1.5">
        <h1 className="text-sm font-semibold sm:text-base">{title}</h1>
        <p className={cn('max-w-[140px] text-[11px] leading-4 text-[#30263A] sm:max-w-[170px] sm:text-[13px]', descriptionClassName)}>{description}</p>
      </div>

      {actionLabel && (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'flex h-9 w-full max-w-[142px] items-center justify-center gap-1 rounded-md bg-white px-2 text-[10px] font-semibold text-[#6E27AE] shadow-sm transition-colors hover:opacity-90 sm:h-10 sm:gap-2 sm:px-3 sm:text-xs',
            actionClassName
          )}
        >
          {actionLabel}
          <span aria-hidden="true">-&gt;</span>
        </button>
      )}
    </section>
  );
};

export default HomeCard;
