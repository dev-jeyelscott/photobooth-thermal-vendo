import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoTemplateOption } from '@/hooks/use-photobooth-session';
import type { StickerDesignOption } from '@/hooks/use-photobooth-session';
import Kiosk from '@/pages/kiosk';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
}));

vi.mock('@/components/capture-step', () => ({
    CaptureStep: ({
        onComplete,
    }: {
        onComplete: (photos: string[], photoPaths: (string | null)[]) => void;
    }) => (
        <div data-testid="kiosk-capture-stub">
            <button
                type="button"
                onClick={() =>
                    onComplete(
                        ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'],
                        [
                            'captures/token/1.jpg',
                            'captures/token/2.jpg',
                            'captures/token/3.jpg',
                        ],
                    )
                }
            >
                complete capture
            </button>
        </div>
    ),
}));

const SESSION_TOKEN = 'session-token-abc';

const template: PhotoTemplateOption = {
    id: 1,
    name: 'Classic Strip',
    thumbnailPath: null,
    photoSlots: 3,
    layoutConfig: null,
    printWidthMm: 50,
    printHeightMm: 150,
};

const sticker: StickerDesignOption = {
    id: 1,
    name: 'Confetti',
    assetPath: '/stickers/confetti.png',
    thumbnailPath: null,
};

type Route = {
    method: string;
    pattern: RegExp;
    handler: () => { status: number; body: unknown };
};

/**
 * Creates the minimal Response-compatible JSON object used by kiosk fetch mocks.
 */
const jsonResponse = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

/**
 * Creates a deterministic fetch mock that dispatches requests to matching
 * method and pathname handlers.
 */
const createFetchMock = (routes: Route[]) =>
    vi.fn(async (input: string | URL, init?: RequestInit) => {
        const method = (init?.method ?? 'get').toLowerCase();
        const { pathname } = new URL(String(input), 'http://localhost');

        const route = routes.find(
            (candidate) =>
                candidate.method === method && candidate.pattern.test(pathname),
        );

        if (!route) {
            throw new Error(
                `Unhandled request: ${method.toUpperCase()} ${pathname}`,
            );
        }

        const { status, body } = route.handler();

        return jsonResponse(status, body) as unknown as Response;
    });

const paymentStatusState = {
    status: 'paid' as string,
    paymentStatus: 'succeeded' as string | null,
};

/**
 * Simulates the durable session state updated asynchronously by the queued
 * captured-media processing job.
 */
const processingState = {
    galleryToken: null as string | null,
};

const baseRoutes: Route[] = [
    {
        method: 'post',
        pattern: /^\/kiosk\/sessions$/,
        handler: () => ({
            status: 200,
            body: {
                sessionToken: SESSION_TOKEN,
                status: 'pending',
                startedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                paymentStatus: null,
                printJobStatus: null,
                requiredCaptureCount: 3,
                galleryToken: null,
            },
        }),
    },
    {
        method: 'post',
        pattern: /^\/kiosk\/sessions\/[^/]+\/voucher$/,
        handler: () => ({
            status: 200,
            body: { status: 'template_selection' },
        }),
    },
    {
        method: 'post',
        pattern: /^\/kiosk\/sessions\/[^/]+\/payments$/,
        handler: () => ({
            status: 200,
            body: { checkoutUrl: 'https://pay.example.test/checkout' },
        }),
    },
    {
        method: 'get',
        pattern: /^\/kiosk\/sessions\/[^/]+$/,
        handler: () => ({
            status: 200,
            body: {
                sessionToken: SESSION_TOKEN,
                status: paymentStatusState.status,
                startedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                paymentStatus: paymentStatusState.paymentStatus,
                printJobStatus: 'printed',
                requiredCaptureCount: 3,
                galleryToken: processingState.galleryToken,
            },
        }),
    },
    {
        method: 'get',
        pattern: /^\/templates$/,
        handler: () => ({ status: 200, body: { templates: [template] } }),
    },
    {
        method: 'post',
        pattern: /^\/kiosk\/sessions\/[^/]+\/template$/,
        handler: () => ({ status: 200, body: { status: 'capture' } }),
    },
    {
        method: 'get',
        pattern: /^\/stickers$/,
        handler: () => ({ status: 200, body: { stickers: [sticker] } }),
    },
    {
        method: 'post',
        pattern: /^\/kiosk\/sessions\/[^/]+\/sticker$/,
        handler: () => ({ status: 200, body: { status: 'preview' } }),
    },
    {
        method: 'post',
        pattern: /^\/kiosk\/sessions\/[^/]+\/preview$/,
        handler: () => ({ status: 200, body: { status: 'processing' } }),
    },
    {
        method: 'post',
        pattern: /^\/kiosk\/sessions\/[^/]+\/color-output$/,
        handler: () => {
            processingState.galleryToken = 'gallery-token-xyz';

            return {
                status: 202,
                body: {
                    status: 'processing',
                    processing: true,
                },
            };
        },
    },
];

describe('Kiosk', () => {
    beforeEach(() => {
        paymentStatusState.status = 'paid';
        paymentStatusState.paymentStatus = 'succeeded';
        processingState.galleryToken = null;

        global.fetch = createFetchMock(baseRoutes) as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('starts a session from the welcome screen (start flow)', async () => {
        const user = userEvent.setup();

        render(<Kiosk />);

        expect(screen.getByTestId('kiosk-welcome')).toBeInTheDocument();

        await user.click(
            screen.getByRole('button', { name: 'Click to Start' }),
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/kiosk/sessions',
                expect.objectContaining({ method: 'post' }),
            );
        });
    });

    it('waits for payment and advances once paid (payment waiting state)', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        render(<Kiosk paymentTimeoutSeconds={30} />);

        await user.click(screen.getByRole('button', { name: 'Pay via QR' }));

        expect(
            await screen.findByTestId('kiosk-pay-via-qr'),
        ).toBeInTheDocument();

        const checkoutLink = await screen.findByTestId(
            'kiosk-payment-checkout-link',
        );

        expect(checkoutLink).toHaveAttribute(
            'href',
            'https://pay.example.test/checkout',
        );
        // The checkout action must use the large touch-target Button
        // treatment, not a plain text link, to stay touch-first.
        expect(checkoutLink).toHaveAttribute('data-slot', 'button');
        expect(checkoutLink.className).toContain('h-10');

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(
            await screen.findByTestId('kiosk-select-template'),
        ).toBeInTheDocument();
    });

    it('recovers from a transient network failure during payment polling without re-issuing the checkout', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        paymentStatusState.status = 'pending';

        let sessionPollCount = 0;
        const paymentPostCalls: string[] = [];

        global.fetch = vi.fn(
            async (input: string | URL, init?: RequestInit) => {
                const method = (init?.method ?? 'get').toLowerCase();
                const { pathname } = new URL(String(input), 'http://localhost');

                if (
                    method === 'post' &&
                    /^\/kiosk\/sessions\/[^/]+\/payments$/.test(pathname)
                ) {
                    paymentPostCalls.push(pathname);

                    return jsonResponse(200, {
                        checkoutUrl: 'https://pay.example.test/checkout',
                    }) as unknown as Response;
                }

                if (
                    method === 'get' &&
                    /^\/kiosk\/sessions\/[^/]+$/.test(pathname)
                ) {
                    sessionPollCount += 1;

                    // The very first poll after checkout creation fails
                    // transiently, such as a dropped connection.
                    if (sessionPollCount === 1) {
                        throw new TypeError('Failed to fetch');
                    }

                    if (sessionPollCount >= 3) {
                        paymentStatusState.status = 'paid';
                        paymentStatusState.paymentStatus = 'succeeded';
                    }

                    return jsonResponse(200, {
                        sessionToken: SESSION_TOKEN,
                        status: paymentStatusState.status,
                        startedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 60_000).toISOString(),
                        paymentStatus: paymentStatusState.paymentStatus,
                        printJobStatus: null,
                        requiredCaptureCount: 3,
                        galleryToken: null,
                    }) as unknown as Response;
                }

                const route = baseRoutes.find(
                    (candidate) =>
                        candidate.method === method &&
                        candidate.pattern.test(pathname),
                );

                if (!route) {
                    throw new Error(
                        `Unhandled request: ${method.toUpperCase()} ${pathname}`,
                    );
                }

                const { status, body } = route.handler();

                return jsonResponse(status, body) as unknown as Response;
            },
        ) as unknown as typeof fetch;

        render(<Kiosk paymentTimeoutSeconds={30} />);

        await user.click(screen.getByRole('button', { name: 'Pay via QR' }));

        expect(
            await screen.findByTestId('kiosk-payment-checkout-link'),
        ).toBeInTheDocument();

        // First poll fails transiently. The kiosk keeps waiting instead of
        // surfacing a hard error immediately.
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(
            screen.queryByTestId('kiosk-error-network-interruption'),
        ).not.toBeInTheDocument();

        // Subsequent polls succeed once connectivity returns, and the
        // session advances once payment is confirmed.
        for (let i = 0; i < 5; i += 1) {
            await act(async () => {
                vi.advanceTimersByTime(3000);
            });
        }

        expect(
            await screen.findByTestId('kiosk-select-template'),
        ).toBeInTheDocument();

        expect(paymentPostCalls).toHaveLength(1);
    });

    it('resumes polling the pending checkout after a payment timeout instead of re-issuing a new checkout', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        paymentStatusState.status = 'pending';

        let paymentPostCount = 0;

        global.fetch = vi.fn(
            async (input: string | URL, init?: RequestInit) => {
                const method = (init?.method ?? 'get').toLowerCase();
                const { pathname } = new URL(String(input), 'http://localhost');

                if (
                    method === 'post' &&
                    /^\/kiosk\/sessions\/[^/]+\/payments$/.test(pathname)
                ) {
                    paymentPostCount += 1;

                    return jsonResponse(200, {
                        checkoutUrl: 'https://pay.example.test/checkout',
                    }) as unknown as Response;
                }

                if (
                    method === 'get' &&
                    /^\/kiosk\/sessions\/[^/]+$/.test(pathname)
                ) {
                    return jsonResponse(200, {
                        sessionToken: SESSION_TOKEN,
                        status: paymentStatusState.status,
                        startedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 60_000).toISOString(),
                        paymentStatus: paymentStatusState.paymentStatus,
                        printJobStatus: null,
                        requiredCaptureCount: 3,
                        galleryToken: null,
                    }) as unknown as Response;
                }

                const route = baseRoutes.find(
                    (candidate) =>
                        candidate.method === method &&
                        candidate.pattern.test(pathname),
                );

                if (!route) {
                    throw new Error(
                        `Unhandled request: ${method.toUpperCase()} ${pathname}`,
                    );
                }

                const { status, body } = route.handler();

                return jsonResponse(status, body) as unknown as Response;
            },
        ) as unknown as typeof fetch;

        render(<Kiosk paymentTimeoutSeconds={30} />);

        await user.click(screen.getByRole('button', { name: 'Pay via QR' }));

        expect(
            await screen.findByTestId('kiosk-payment-checkout-link'),
        ).toBeInTheDocument();

        // The session remains pending until after the client-side payment
        // timeout elapses, e.g. because a connectivity gap delayed the
        // paid-session response.
        await act(async () => {
            vi.advanceTimersByTime(30_000);
        });

        expect(
            await screen.findByTestId('kiosk-error-payment-timeout'),
        ).toBeInTheDocument();
        expect(paymentPostCount).toBe(1);

        // Recovering from the timeout must resume polling the existing
        // checkout, not create a second one.
        await user.click(screen.getByRole('button', { name: 'Retry Payment' }));

        expect(paymentPostCount).toBe(1);

        paymentStatusState.status = 'paid';
        paymentStatusState.paymentStatus = 'succeeded';

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(
            await screen.findByTestId('kiosk-select-template'),
        ).toBeInTheDocument();

        expect(paymentPostCount).toBe(1);
    });

    it('resumes the print-status poll after five consecutive transient failures and reports the terminal failed state', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });

        let galleryPublished = false;
        let printPollCount = 0;

        global.fetch = vi.fn(
            async (input: string | URL, init?: RequestInit) => {
                const method = (init?.method ?? 'get').toLowerCase();
                const { pathname } = new URL(String(input), 'http://localhost');

                if (
                    method === 'get' &&
                    /^\/kiosk\/sessions\/[^/]+$/.test(pathname)
                ) {
                    if (!galleryPublished) {
                        galleryPublished = true;

                        return jsonResponse(200, {
                            sessionToken: SESSION_TOKEN,
                            status: 'complete',
                            startedAt: new Date().toISOString(),
                            expiresAt: new Date(
                                Date.now() + 60_000,
                            ).toISOString(),
                            paymentStatus: 'succeeded',
                            printJobStatus: null,
                            requiredCaptureCount: 3,
                            galleryToken: 'gallery-token-xyz',
                        }) as unknown as Response;
                    }

                    printPollCount += 1;

                    // The five polls immediately following gallery
                    // completion fail transiently, such as a dropped
                    // connection, before connectivity is restored.
                    if (printPollCount <= 5) {
                        throw new TypeError('Failed to fetch');
                    }

                    return jsonResponse(200, {
                        sessionToken: SESSION_TOKEN,
                        status: 'complete',
                        startedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 60_000).toISOString(),
                        paymentStatus: 'succeeded',
                        printJobStatus: 'failed',
                        requiredCaptureCount: 3,
                        galleryToken: 'gallery-token-xyz',
                    }) as unknown as Response;
                }

                const route = baseRoutes.find(
                    (candidate) =>
                        candidate.method === method &&
                        candidate.pattern.test(pathname),
                );

                if (!route) {
                    throw new Error(
                        `Unhandled request: ${method.toUpperCase()} ${pathname}`,
                    );
                }

                const { status, body } = route.handler();

                return jsonResponse(status, body) as unknown as Response;
            },
        ) as unknown as typeof fetch;

        render(<Kiosk idleTimeoutSeconds={9999} />);

        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));
        await user.type(screen.getByTestId('kiosk-voucher-input'), 'FREE-2026');
        await user.click(
            screen.getByRole('button', { name: 'Redeem Voucher' }),
        );

        await user.click(await screen.findByTestId('kiosk-template-1'));

        await user.click(
            await screen.findByRole('button', { name: 'complete capture' }),
        );

        await user.click(
            screen.getByRole('button', { name: 'Choose a Sticker' }),
        );

        const stickerOption = await screen.findByTestId('kiosk-sticker-1');
        await user.click(stickerOption);

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Continue' }),
            ).toBeEnabled();
        });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        await user.click(
            await screen.findByRole('button', { name: 'Confirm' }),
        );

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(
            await screen.findByTestId('kiosk-gallery-qr-code'),
        ).toBeInTheDocument();

        // Advance well past five consecutive transient poll failures; the
        // print-status poll must keep retrying at the capped backoff
        // interval instead of stopping permanently.
        for (let i = 0; i < 7; i += 1) {
            await act(async () => {
                vi.advanceTimersByTime(15000);
            });
        }

        expect(
            await screen.findByTestId('kiosk-error-print-failure'),
        ).toBeInTheDocument();
    });

    it('keeps explicit printing feedback visible when the print job is still unresolved after the poll budget is exhausted', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });

        let galleryPublished = false;

        global.fetch = vi.fn(
            async (input: string | URL, init?: RequestInit) => {
                const method = (init?.method ?? 'get').toLowerCase();
                const { pathname } = new URL(String(input), 'http://localhost');

                if (
                    method === 'get' &&
                    /^\/kiosk\/sessions\/[^/]+$/.test(pathname)
                ) {
                    if (!galleryPublished) {
                        galleryPublished = true;

                        return jsonResponse(200, {
                            sessionToken: SESSION_TOKEN,
                            status: 'complete',
                            startedAt: new Date().toISOString(),
                            expiresAt: new Date(
                                Date.now() + 60_000,
                            ).toISOString(),
                            paymentStatus: 'succeeded',
                            printJobStatus: null,
                            requiredCaptureCount: 3,
                            galleryToken: 'gallery-token-xyz',
                        }) as unknown as Response;
                    }

                    // The print job never reaches a terminal status within
                    // the local poll budget, e.g. because the printer is
                    // still spooling a long queue.
                    return jsonResponse(200, {
                        sessionToken: SESSION_TOKEN,
                        status: 'complete',
                        startedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 60_000).toISOString(),
                        paymentStatus: 'succeeded',
                        printJobStatus: null,
                        requiredCaptureCount: 3,
                        galleryToken: 'gallery-token-xyz',
                    }) as unknown as Response;
                }

                const route = baseRoutes.find(
                    (candidate) =>
                        candidate.method === method &&
                        candidate.pattern.test(pathname),
                );

                if (!route) {
                    throw new Error(
                        `Unhandled request: ${method.toUpperCase()} ${pathname}`,
                    );
                }

                const { status, body } = route.handler();

                return jsonResponse(status, body) as unknown as Response;
            },
        ) as unknown as typeof fetch;

        render(<Kiosk idleTimeoutSeconds={9999} />);

        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));
        await user.type(screen.getByTestId('kiosk-voucher-input'), 'FREE-2026');
        await user.click(
            screen.getByRole('button', { name: 'Redeem Voucher' }),
        );

        await user.click(await screen.findByTestId('kiosk-template-1'));

        await user.click(
            await screen.findByRole('button', { name: 'complete capture' }),
        );

        await user.click(
            screen.getByRole('button', { name: 'Choose a Sticker' }),
        );

        const stickerOption = await screen.findByTestId('kiosk-sticker-1');
        await user.click(stickerOption);

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Continue' }),
            ).toBeEnabled();
        });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        await user.click(
            await screen.findByRole('button', { name: 'Confirm' }),
        );

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(
            await screen.findByTestId('kiosk-gallery-qr-code'),
        ).toBeInTheDocument();

        // Advance past the local print-poll attempt budget (5 polls at
        // 3000ms each) without the print job ever reaching a terminal
        // status.
        for (let i = 0; i < 6; i += 1) {
            await act(async () => {
                vi.advanceTimersByTime(3000);
            });
        }

        const printingStatus = await screen.findByTestId(
            'kiosk-printing-status',
        );

        // Feedback must stay explicit and non-ambiguous instead of
        // silently disappearing once the poll budget is exhausted.
        expect(printingStatus).toHaveTextContent(
            'Your receipt is taking longer than expected to print.',
        );
        expect(
            screen.queryByTestId('kiosk-error-print-failure'),
        ).not.toBeInTheDocument();
    });

    it('resets an idle payment session back to the welcome screen', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        paymentStatusState.status = 'pending';

        render(<Kiosk idleTimeoutSeconds={5} paymentTimeoutSeconds={9999} />);

        await user.click(screen.getByRole('button', { name: 'Pay via QR' }));

        expect(
            await screen.findByTestId('kiosk-pay-via-qr'),
        ).toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(5000);
        });

        expect(
            await screen.findByTestId('kiosk-idle-overlay'),
        ).toBeInTheDocument();
    });

    it('runs the full happy-path session through to the QR gallery screen', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });

        render(<Kiosk />);

        // Phase 2: start flow via voucher redemption.
        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));
        await user.type(screen.getByTestId('kiosk-voucher-input'), 'FREE-2026');
        await user.click(
            screen.getByRole('button', { name: 'Redeem Voucher' }),
        );

        // Phase 5: template selection.
        const templateOption = await screen.findByTestId('kiosk-template-1');
        await user.click(templateOption);

        // Phase 4: capture workflow. The component is tested separately and
        // stubbed here so this test can focus on the complete kiosk state flow.
        expect(
            await screen.findByTestId('kiosk-capture-stub'),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole('button', { name: 'complete capture' }),
        );

        expect(await screen.findByTestId('kiosk-captured')).toBeInTheDocument();

        await user.click(
            screen.getByRole('button', { name: 'Choose a Sticker' }),
        );

        // Phase 5: sticker selection.
        const stickerOption = await screen.findByTestId('kiosk-sticker-1');
        await user.click(stickerOption);

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Continue' }),
            ).toBeEnabled();
        });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        // Preview confirmation queues final composition and enters processing.
        await user.click(
            await screen.findByRole('button', { name: 'Confirm' }),
        );

        expect(
            await screen.findByTestId('kiosk-processing'),
        ).toBeInTheDocument();

        // The real kiosk polls durable session state every two seconds until
        // the queued composition job publishes its gallery token.
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        // Phase 7: the session poll exposes the generated gallery token.
        const galleryQr = await screen.findByTestId('kiosk-gallery-qr-code');

        expect(galleryQr.getAttribute('src')).toContain('gallery-token-xyz');
    });

    it('resets session state when returning to the welcome screen (session reset)', async () => {
        const user = userEvent.setup();

        render(<Kiosk />);

        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));
        await user.type(screen.getByTestId('kiosk-voucher-input'), 'FREE-2026');
        await user.click(
            screen.getByRole('button', { name: 'Redeem Voucher' }),
        );

        await user.click(await screen.findByTestId('kiosk-template-1'));

        await user.click(
            await screen.findByRole('button', { name: 'complete capture' }),
        );

        expect(await screen.findByTestId('kiosk-captured')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Back to Start' }));

        expect(screen.getByTestId('kiosk-welcome')).toBeInTheDocument();
        expect(screen.queryByTestId('kiosk-captured')).not.toBeInTheDocument();

        // Voucher input state was cleared, so restarting the enter-voucher
        // flow starts from a blank field rather than the previous code.
        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));

        expect(screen.getByTestId('kiosk-voucher-input')).toHaveValue('');
    });
});
