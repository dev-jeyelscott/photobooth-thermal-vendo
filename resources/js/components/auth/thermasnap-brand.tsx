import { Link } from '@inertiajs/react';
import { Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { home } from '@/routes';

type ThermaSnapMarkProps = {
    className?: string;
};

type ThermaSnapBrandProps = {
    className?: string;
};

/**
 * Renders the compact geometric ThermaSnap camera mark used by authentication
 * screens without reusing the starter Laravel logo.
 */
export function ThermaSnapMark({ className }: ThermaSnapMarkProps) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'relative inline-flex size-12 shrink-0 items-center justify-center text-primary',
                className,
            )}
        >
            <span className="absolute inset-x-1 top-2 bottom-0 rounded-[10px] border-[3px] border-current" />
            <span className="absolute top-0 left-1/2 h-3 w-5 -translate-x-1/2 rounded-t-[5px] border-x-[3px] border-t-[3px] border-current" />
            <span className="relative mt-2 flex size-6 items-center justify-center rounded-full border-[3px] border-current">
                <Power className="size-3.5 stroke-[2.6]" aria-hidden="true" />
            </span>
        </span>
    );
}

/**
 * Renders the reusable ThermaSnap authentication brand lockup and links it to
 * the existing application home route through Wayfinder.
 */
export default function ThermaSnapBrand({ className }: ThermaSnapBrandProps) {
    return (
        <Link
            href={home()}
            aria-label="ThermaSnap home"
            className={cn(
                'inline-flex items-center gap-3 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                className,
            )}
        >
            <ThermaSnapMark />

            <span className="flex flex-col">
                <span className="text-2xl leading-none font-bold tracking-[-0.04em] text-primary sm:text-[1.75rem]">
                    ThermaSnap
                </span>
                <span className="mt-1 text-[0.6rem] leading-none font-semibold tracking-[0.22em] text-muted-foreground uppercase sm:text-[0.65rem]">
                    Photobooth Prints
                </span>
            </span>
        </Link>
    );
}
