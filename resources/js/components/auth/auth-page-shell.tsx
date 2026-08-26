import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AuthPageShellProps = {
    children: ReactNode;
    mainClassName?: string;
    footerClassName?: string;
};

/**
 * Renders the common full-viewport authentication canvas, decorative backdrop,
 * main content area, and shared copyright footer.
 */
export default function AuthPageShell({
    children,
    mainClassName,
    footerClassName,
}: AuthPageShellProps) {
    return (
        <div className="relative min-h-svh overflow-x-hidden bg-background text-foreground">
            <AuthDecorations />

            <div className="relative z-10 flex min-h-svh flex-col">
                <main className={cn('flex flex-1', mainClassName)}>
                    {children}
                </main>

                <AuthFooter className={footerClassName} />
            </div>
        </div>
    );
}

/**
 * Renders non-interactive soft pink background geometry inspired by the
 * supplied authentication references.
 */
function AuthDecorations() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div className="absolute -top-[30rem] -right-[24rem] size-[68rem] rounded-full bg-primary/5" />
            <div className="absolute -bottom-[16rem] -left-[14rem] size-[38rem] rounded-full bg-primary/5" />

            <div className="absolute -bottom-[22rem] left-[5%] hidden h-[42rem] w-[90rem] -rotate-[7deg] rounded-[50%] border border-primary/10 md:block" />

            <div className="absolute -right-[14rem] bottom-[-18rem] hidden size-[56rem] rounded-full border border-primary/10 bg-primary/[0.02] lg:block" />

            <div
                className="absolute top-6 right-8 hidden h-40 w-64 text-primary/10 sm:block"
                style={{
                    backgroundImage:
                        'radial-gradient(currentColor 1.4px, transparent 1.4px)',
                    backgroundSize: '16px 16px',
                }}
            />
        </div>
    );
}

/**
 * Renders the shared authentication copyright using the current calendar year.
 */
function AuthFooter({ className }: { className?: string }) {
    return (
        <footer
            className={cn(
                'relative z-10 px-6 pt-3 pb-6 text-center text-sm text-muted-foreground',
                className,
            )}
        >
            © {new Date().getFullYear()} ThermaSnap. All rights reserved.
        </footer>
    );
}
