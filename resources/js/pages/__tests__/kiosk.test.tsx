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
        onComplete: (
            photos: string[],
            photoPaths: (string | null)[],
        ) => void;
    }) => (
        <div data-testid="kiosk-capture-stub">
            <button
                type="button"
                onClick={() =>
                    onComplete(
                        ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'],
                        ['captures/token/1.jpg', 'captures/token/2.jpg', 'captures/token/3.jpg'],
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

const jsonResponse = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

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
        handler: () => ({
            status: 200,
            body: { status: 'complete', galleryToken: 'gallery-token-xyz' },
        }),
    },
];

describe('Kiosk', () => {
    beforeEach(() => {
        paymentStatusState.status = 'paid';
        paymentStatusState.paymentStatus = 'succeeded';
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

        expect(
            await screen.findByTestId('kiosk-payment-checkout-link'),
        ).toHaveAttribute('href', 'https://pay.example.test/checkout');

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(
            await screen.findByTestId('kiosk-select-template'),
        ).toBeInTheDocument();
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
        const user = userEvent.setup();

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

        // Phase 4: capture workflow (component under test elsewhere; stubbed here).
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

        // Preview confirmation kicks off processing.
        await user.click(
            await screen.findByRole('button', { name: 'Confirm' }),
        );

        // Phase 6: processing state, then Phase 7: QR result screen.
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
