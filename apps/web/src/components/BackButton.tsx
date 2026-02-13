'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft } from 'lucide-react';

type BackButtonProps = {
  href?: string;
  label?: string;
  onClick?: () => void;
  className?: string;
};

export default function BackButton({ href, label = 'Volver', onClick, className = '' }: BackButtonProps) {
  const router = useRouter();

  const sharedClasses =
    'inline-flex items-center justify-center sm:justify-start gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 active:bg-slate-300 transition-colors font-medium text-sm touch-manipulation';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${sharedClasses} ${className}`}
        aria-label={label}
      >
        <ArrowLeft size={20} strokeWidth={2.5} className="flex-shrink-0" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={`${sharedClasses} ${className}`} aria-label={label}>
        <ArrowLeft size={20} strokeWidth={2.5} className="flex-shrink-0" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`${sharedClasses} ${className}`}
      aria-label={label}
    >
      <ArrowLeft size={20} strokeWidth={2.5} className="flex-shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
