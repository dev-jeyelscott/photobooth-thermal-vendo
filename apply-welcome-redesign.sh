#!/usr/bin/env bash
set -euo pipefail

# Run from the ThermaSnap repository root after extracting this bundle.

mkdir -p resources/js/pages/__tests__

cat > resources/js/pages/welcome.tsx <<'EOF'
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { kiosk } from '@/routes';

const PHOTO_ASSET = '/images/welcome/photostrip-photo.png';
const WELCOME_PANEL_CLASS =
    'gap-0 overflow-hidden rounded-3xl border-border/80 bg-muted/20 py-0 shadow-xl';

type PhotoStripProps = {
    className?: string;
    monochromeFrames?: number[];
};

/**
 * Renders one decorative three-frame photostrip using the approved local
 * welcome-page photo asset.
 */
function PhotoStrip({
    className,
    monochromeFrames = [],
}: PhotoStripProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-2 rounded-[14px] bg-white p-2 shadow-xl',
                className,
            )}
        >
            {[0, 1, 2].map((frameIndex) => (
                <div
                    key={frameIndex}
                    className="aspect-[1.08] overflow-hidden rounded-[4px] bg-muted"
                >
                    <img
                        src={PHOTO_ASSET}
                        alt=""
                        draggable={false}
                        className={cn(
                            'h-full w-full object-cover',
                            monochromeFrames.includes(frameIndex) &&
                                'grayscale',
                        )}
                    />
                </div>
            ))}
        </div>
    );
}

/**
 * Renders the public ThermaSnap entry page and links customers into the
 * existing kiosk flow without creating or mutating a photobooth session.
 */
export default function Welcome() {
    return (
        <>
            <Head title="Welcome" />

            <div className="dark grid min-h-dvh grid-rows-[1fr_auto] overflow-x-hidden bg-background text-foreground">
                <main className="flex items-center px-4 py-10 sm:px-6 lg:px-8 xl:px-10 xl:py-12">
                    <div className="mx-auto grid w-full max-w-[1496px] gap-8 lg:grid-cols-[1.08fr_0.92fr]">
                        <Card
                            className={cn(
                                WELCOME_PANEL_CLASS,
                                'min-h-[520px] xl:min-h-[574px]',
                            )}
                        >
                            <CardContent className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-10 lg:px-10 xl:px-12 xl:py-16">
                                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                                    Self-service photobooth
                                </p>

                                <h1 className="mt-4 max-w-[42rem] text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl xl:text-[3rem]">
                                    Capture it. Print it. Take it with you.
                                </h1>

                                <p className="mt-5 max-w-[42rem] text-base leading-7 text-muted-foreground sm:text-lg">
                                    A simple public entry point for the
                                    ThermaSnap experience. Start a private
                                    session, pay or use a voucher, take your
                                    photos, then collect the thermal print and
                                    digital gallery.
                                </p>

                                <div className="mt-7 flex flex-wrap gap-3">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="h-14 rounded-xl px-7 text-base motion-reduce:transition-none"
                                    >
                                        <Link href={kiosk.url()}>
                                            Start Photobooth
                                        </Link>
                                    </Button>

                                    <Button
                                        asChild
                                        variant="outline"
                                        size="lg"
                                        className="h-14 rounded-xl px-7 text-base motion-reduce:transition-none"
                                    >
                                        <a href="#how-it-works">
                                            How it works
                                        </a>
                                    </Button>
                                </div>

                                <section
                                    id="how-it-works"
                                    aria-label="How it works"
                                    tabIndex={-1}
                                    className="mt-8 scroll-mt-6 outline-none"
                                >
                                    <ol className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                        <li className="rounded-full border border-border/80 px-4 py-2">
                                            1. Start
                                        </li>
                                        <li className="rounded-full border border-border/80 px-4 py-2">
                                            2. Capture
                                        </li>
                                        <li className="rounded-full border border-border/80 px-4 py-2">
                                            3. Print &amp; download
                                        </li>
                                    </ol>
                                </section>
                            </CardContent>
                        </Card>

                        <Card
                            className={cn(
                                WELCOME_PANEL_CLASS,
                                'min-h-[420px] sm:min-h-[500px] lg:min-h-[520px] xl:min-h-[574px]',
                            )}
                        >
                            <CardContent
                                aria-hidden="true"
                                className="flex flex-1 items-center justify-center p-5 sm:p-8"
                            >
                                <div className="relative h-[370px] w-full max-w-[560px] sm:h-[470px] xl:h-[510px]">
                                    <PhotoStrip className="absolute top-[2%] left-[3%] z-10 w-[31%] -rotate-[3deg]" />
                                    <PhotoStrip
                                        className="absolute top-[8%] left-[35%] z-20 w-[31%] rotate-[2deg]"
                                        monochromeFrames={[0, 2]}
                                    />
                                    <PhotoStrip className="absolute top-[3%] right-[2%] z-10 w-[31%] rotate-[1deg]" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>

                <footer className="px-6 pb-7 text-center text-xs text-muted-foreground sm:text-sm">
                    Public route /. Clear entry into the kiosk flow with no
                    admin navigation.
                </footer>
            </div>
        </>
    );
}
EOF

cat > resources/js/pages/__tests__/welcome.test.tsx <<'EOF'
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Welcome from '@/pages/welcome';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({
        href,
        children,
        ...props
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
        href: string;
        children: ReactNode;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe('welcome page', () => {
    it('renders the public ThermaSnap entry experience', () => {
        render(<Welcome />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Capture it. Print it. Take it with you.',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /A simple public entry point for the ThermaSnap experience\./,
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', { name: 'Start Photobooth' }),
        ).toHaveAttribute('href', '/kiosk');
        expect(
            screen.getByRole('link', { name: 'How it works' }),
        ).toHaveAttribute('href', '#how-it-works');

        expect(screen.getByText('1. Start')).toBeInTheDocument();
        expect(screen.getByText('2. Capture')).toBeInTheDocument();
        expect(screen.getByText('3. Print & download')).toBeInTheDocument();
    });

    it('keeps the public page free of authenticated navigation', () => {
        const { container } = render(<Welcome />);

        expect(container.querySelector('#how-it-works')).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /dashboard/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /log in/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /register/i }),
        ).not.toBeInTheDocument();
    });
});
EOF

composer wayfinder:generate
npm run test -- resources/js/pages/__tests__/welcome.test.tsx
