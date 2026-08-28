import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoTemplateOption } from '@/hooks/use-photobooth-session';
import type { StickerDesignOption } from '@/hooks/use-photobooth-session';
import Kiosk from '@/pages/kiosk';

const KIOSK_BUSINESS_SLUG = 'acme-photo';
const KIOSK_BASE_PATH = `/b/${KIOSK_BUSINESS_SLUG}`;
const KIOSK_STORAGE_KEY = `photobooth.session_token.${KIOSK_BUSINESS_SLUG}`;

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    usePage: () => ({
        props: {
            businessSlug: 'acme-photo',
        },
    }),
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
 * method and Business-scoped pathname handlers.
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
        pattern: /^\/b\/acme-photo\/kiosk\/sessions$/,
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
        pattern: /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/voucher$/,
        handler: () => ({
            status: 200,
            body: { status: 'template_selection' },
        }),
    },
    {
        method: 'post',
        pattern: /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/payments$/,
        handler: () => ({
            status: 200,
            body: {
                checkoutUrl: 'https://pay.example.test/checkout',
                checkoutQrCode: 'data:image/svg+xml;base64,PHN2Zy8+',
            },
        }),
    },
    {
        method: 'get',
        pattern: /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+$/,
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
        pattern: /^\/b\/acme-photo\/templates$/,
        handler: () => ({
            status: 200,
            body: { templates: [template] },
        }),
    },
    {
        method: 'post',
        pattern: /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/template$/,
        handler: () => ({
            status: 200,
            body: { status: 'capture' },
        }),
    },
    {
        method: 'get',
        pattern: /^\/b\/acme-photo\/stickers$/,
        handler: () => ({
            status: 200,
            body: { stickers: [sticker] },
        }),
    },
    {
        method: 'post',
        pattern: /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/sticker$/,
        handler: () => ({
            status: 200,
            body: { status: 'preview' },
        }),
    },
    {
        method: 'post',
        pattern: /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/preview$/,
        handler: () => ({
            status: 200,
            body: { status: 'processing' },
        }),
    },
    {
        method: 'post',
        pattern: /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/color-output$/,
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
        window.sessionStorage.clear();
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

        await user.click(screen.getByRole('button', { name: 'Pay via QR' }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                `${KIOSK_BASE_PATH}/kiosk/sessions`,
                expect.objectContaining({ method: 'post' }),
            );
        });

        expect(window.sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBe(
            SESSION_TOKEN,
        );
    });

    it('waits for payment and advances once paid (payment waiting state)', async () => {
        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        paymentStatusState.status = 'pending';
        paymentStatusState.paymentStatus = 'pending';

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
        expect(checkoutLink).toHaveAttribute('data-slot', 'button');
        expect(checkoutLink.className).toContain('min-h-12');

        paymentStatusState.status = 'paid';
        paymentStatusState.paymentStatus = 'succeeded';

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(
            await screen.findByTestId('kiosk-select-template'),
        ).toBeInTheDocument();
    });

    it.each(['failed', 'cancelled'] as const)(
        'shows a recoverable payment failure when the payment is %s',
        async (paymentStatus) => {
            const user = userEvent.setup({
                advanceTimers: vi.advanceTimersByTime,
            });
            vi.useFakeTimers({ shouldAdvanceTime: true });

            paymentStatusState.status = 'pending';
            paymentStatusState.paymentStatus = paymentStatus;

            render(<Kiosk paymentTimeoutSeconds={30} />);

            await user.click(
                screen.getByRole('button', { name: 'Pay via QR' }),
            );

            expect(
                await screen.findByTestId('kiosk-payment-checkout-link'),
            ).toBeInTheDocument();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000);
            });

            expect(
                await screen.findByTestId('kiosk-error-payment-failed'),
            ).toBeInTheDocument();

            paymentStatusState.paymentStatus = 'pending';

            await user.click(
                screen.getByRole('button', { name: 'Retry Payment' }),
            );

            expect(
                await screen.findByTestId('kiosk-payment-checkout-link'),
            ).toBeInTheDocument();
        },
    );

    it('ends an expired payment session and returns the customer to start', async () => {
        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        paymentStatusState.status = 'expired';
        paymentStatusState.paymentStatus = null;

        render(<Kiosk paymentTimeoutSeconds={30} />);

        await user.click(screen.getByRole('button', { name: 'Pay via QR' }));

        expect(
            await screen.findByTestId('kiosk-payment-checkout-link'),
        ).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(
            await screen.findByTestId('kiosk-error-expired-session'),
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Back to Start' }));

        expect(screen.getByTestId('kiosk-welcome')).toBeInTheDocument();
        expect(window.sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBeNull();
    });

    it('recovers from a transient network failure during payment polling without re-issuing the checkout', async () => {
        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });
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
                    /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/payments$/.test(
                        pathname,
                    )
                ) {
                    paymentPostCalls.push(pathname);

                    return jsonResponse(200, {
                        checkoutUrl: 'https://pay.example.test/checkout',
                        checkoutQrCode: 'data:image/svg+xml;base64,PHN2Zy8+',
                    }) as unknown as Response;
                }

                if (
                    method === 'get' &&
                    /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+$/.test(pathname)
                ) {
                    sessionPollCount += 1;

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

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(
            screen.queryByTestId('kiosk-error-network-interruption'),
        ).not.toBeInTheDocument();

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
        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        paymentStatusState.status = 'pending';

        let paymentPostCount = 0;

        global.fetch = vi.fn(
            async (input: string | URL, init?: RequestInit) => {
                const method = (init?.method ?? 'get').toLowerCase();
                const { pathname } = new URL(String(input), 'http://localhost');

                if (
                    method === 'post' &&
                    /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+\/payments$/.test(
                        pathname,
                    )
                ) {
                    paymentPostCount += 1;

                    return jsonResponse(200, {
                        checkoutUrl: 'https://pay.example.test/checkout',
                        checkoutQrCode: 'data:image/svg+xml;base64,PHN2Zy8+',
                    }) as unknown as Response;
                }

                if (
                    method === 'get' &&
                    /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+$/.test(pathname)
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

        await act(async () => {
            vi.advanceTimersByTime(30_000);
        });

        expect(
            await screen.findByTestId('kiosk-error-payment-timeout'),
        ).toBeInTheDocument();
        expect(paymentPostCount).toBe(1);

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
                    /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+$/.test(pathname)
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
            screen.getByRole('button', {
                name: 'Use selected template',
            }),
        );

        await user.click(
            await screen.findByRole('button', {
                name: 'complete capture',
            }),
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
            await screen.findByRole('button', {
                name: 'Confirm preview',
            }),
        );

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(
            await screen.findByTestId('kiosk-gallery-qr-code'),
        ).toBeInTheDocument();

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
                    /^\/b\/acme-photo\/kiosk\/sessions\/[^/]+$/.test(pathname)
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
            screen.getByRole('button', {
                name: 'Use selected template',
            }),
        );

        await user.click(
            await screen.findByRole('button', {
                name: 'complete capture',
            }),
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
            await screen.findByRole('button', {
                name: 'Confirm preview',
            }),
        );

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(
            await screen.findByTestId('kiosk-gallery-qr-code'),
        ).toBeInTheDocument();

        for (let i = 0; i < 6; i += 1) {
            await act(async () => {
                vi.advanceTimersByTime(3000);
            });
        }

        const printingStatus = await screen.findByTestId(
            'kiosk-printing-status',
        );

        expect(printingStatus).toHaveTextContent(
            'Your receipt is taking longer than expected to print.',
        );
        expect(
            screen.queryByTestId('kiosk-error-print-failure'),
        ).not.toBeInTheDocument();
    });

    it('resets an idle payment session back to the welcome screen', async () => {
        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime,
        });
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

        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));
        await user.type(screen.getByTestId('kiosk-voucher-input'), 'FREE-2026');
        await user.click(
            screen.getByRole('button', { name: 'Redeem Voucher' }),
        );

        const templateOption = await screen.findByTestId('kiosk-template-1');
        await user.click(templateOption);

        await user.click(
            screen.getByRole('button', {
                name: 'Use selected template',
            }),
        );

        expect(
            await screen.findByTestId('kiosk-capture-stub'),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole('button', {
                name: 'complete capture',
            }),
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
            await screen.findByRole('button', {
                name: 'Confirm preview',
            }),
        );

        expect(
            await screen.findByTestId('kiosk-processing'),
        ).toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        const galleryQr = await screen.findByTestId('kiosk-gallery-qr-code');

        expect(galleryQr.getAttribute('src')).toContain('gallery-token-xyz');

        expect(window.sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBe(
            SESSION_TOKEN,
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Start a New Session',
            }),
        );

        expect(screen.getByTestId('kiosk-welcome')).toBeInTheDocument();
        expect(window.sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBeNull();
        expect(
            screen.queryByTestId('kiosk-gallery-qr-code'),
        ).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));

        expect(screen.getByTestId('kiosk-voucher-input')).toHaveValue('');
    });

    it('resets session state when returning to the welcome screen (session reset)', async () => {
        const user = userEvent.setup();

        render(<Kiosk />);

        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));
        await user.type(screen.getByTestId('kiosk-voucher-input'), 'FREE-2026');

        expect(window.sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBe(
            SESSION_TOKEN,
        );

        await user.click(screen.getByRole('button', { name: 'Back to Start' }));

        expect(screen.getByTestId('kiosk-welcome')).toBeInTheDocument();
        expect(window.sessionStorage.getItem(KIOSK_STORAGE_KEY)).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Enter Voucher' }));

        expect(screen.getByTestId('kiosk-voucher-input')).toHaveValue('');
    });
});
