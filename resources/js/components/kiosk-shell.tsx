import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type KioskProgressStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Provides the shared ThermaSnap customer kiosk frame used by every public
 * session step so branding, progress, spacing, and responsive behavior stay
 * visually consistent without coupling the shell to business state.
 */
export function KioskShell({
    step,
    children,
}: {
    step: KioskProgressStep;
    children: ReactNode;
}) {
    return (
        <div className="relative flex min-h-dvh w-full flex-col overflow-y-auto bg-neutral-950 text-neutral-50 select-none">
            <header className="flex w-full items-start justify-between gap-6 px-5 pt-5 sm:px-8 sm:pt-8 lg:px-14 lg:pt-12">
                <div className="flex items-center gap-3">
                    <div
                        aria-hidden="true"
                        className="grid size-10 place-items-center rounded-[0.7rem] border-2 border-neutral-100 sm:size-11"
                    >
                        <span className="grid size-5 place-items-center rounded-full border border-neutral-100">
                            <span className="size-2.5 rounded-full border border-neutral-100" />
                        </span>
                    </div>
                    <div className="leading-none">
                        <p className="text-lg font-semibold tracking-[-0.03em] sm:text-xl">
                            ThermaSnap
                        </p>
                        <p className="mt-1 text-[0.68rem] tracking-[0.08em] text-neutral-400 uppercase sm:text-xs">
                            Thermal photobooth
                        </p>
                    </div>
                </div>

                <div className="hidden items-center gap-2 sm:flex">
                    <span className="rounded-full border border-neutral-800 px-3 py-2 text-xs text-neutral-400">
                        Secure session
                    </span>
                    <span className="rounded-full border border-neutral-800 px-3 py-2 text-xs text-neutral-400">
                        Touch friendly
                    </span>
                </div>
            </header>

            <KioskProgress step={step} />

            <main className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-12 lg:py-12">
                {children}
            </main>
        </div>
    );
}

/**
 * Renders the seven-step customer journey using semantic current/completed
 * states while keeping the connector line decorative and non-interactive.
 */
export function KioskProgress({ step }: { step: KioskProgressStep }) {
    return (
        <nav
            aria-label="Photobooth session progress"
            className="mx-auto mt-7 w-full max-w-3xl px-8 sm:mt-8"
        >
            <ol className="grid grid-cols-7 items-center">
                {Array.from({ length: 7 }, (_, index) => {
                    const number = (index + 1) as KioskProgressStep;
                    const isComplete = number < step;
                    const isCurrent = number === step;

                    return (
                        <li
                            key={number}
                            className="relative flex items-center justify-center"
                            aria-current={isCurrent ? 'step' : undefined}
                        >
                            {number > 1 && (
                                <span
                                    aria-hidden="true"
                                    className="absolute top-1/2 right-1/2 left-[-50%] h-px -translate-y-1/2 bg-neutral-800"
                                />
                            )}
                            <span
                                data-testid={`kiosk-progress-${number}`}
                                data-state={
                                    isComplete
                                        ? 'complete'
                                        : isCurrent
                                          ? 'current'
                                          : 'upcoming'
                                }
                                className={cn(
                                    'relative z-10 grid size-6 place-items-center rounded-full border text-[0.68rem] font-medium transition-colors sm:size-7 sm:text-xs',
                                    isComplete &&
                                        'border-emerald-800 bg-emerald-950 text-emerald-400',
                                    isCurrent &&
                                        'border-neutral-100 bg-neutral-100 text-neutral-950',
                                    !isComplete &&
                                        !isCurrent &&
                                        'border-neutral-800 bg-neutral-950 text-neutral-500',
                                )}
                                aria-label={
                                    isComplete
                                        ? `Step ${number} complete`
                                        : isCurrent
                                          ? `Step ${number}, current step`
                                          : `Step ${number}`
                                }
                            >
                                {isComplete ? (
                                    <Check
                                        aria-hidden="true"
                                        className="size-3.5"
                                        strokeWidth={2.5}
                                    />
                                ) : (
                                    number
                                )}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/**
 * Provides the shared bordered content surface used by the redesigned kiosk
 * screens while allowing each step to control its own responsive grid.
 */
export function KioskPanel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'w-full max-w-[91rem] rounded-2xl border border-neutral-800 bg-neutral-950/95 p-6 shadow-2xl shadow-black/35 sm:p-8 lg:p-10',
                className,
            )}
        >
            {children}
        </section>
    );
}
