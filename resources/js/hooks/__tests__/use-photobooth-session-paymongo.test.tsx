import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoboothSession } from '@/hooks/use-photobooth-session';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: {
            businessSlug: 'acme-photo',
        },
    }),
}));

/**
 * Creates the minimal Response-compatible object required by the hook tests.
 */
function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

describe('usePhotoboothSession PayMongo payment contract', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('accepts a native PayMongo QR response without requiring a checkout URL', async () => {
        const qrImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse(201, {
                    sessionToken: 'session-token-abc',
                    status: 'new',
                    startedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 120_000).toISOString(),
                    paymentStatus: null,
                    printJobStatus: null,
                    requiredCaptureCount: 3,
                    galleryToken: null,
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse(201, {
                    payment: {
                        id: 19,
                        status: 'pending',
                        providerStatus: 'awaiting_next_action',
                        amount: '50.00',
                        currency: 'PHP',
                        expiresAt: new Date(
                            Date.now() + 120_000,
                        ).toISOString(),
                    },
                    qrImageUrl,
                }),
            );

        global.fetch = fetchMock as unknown as typeof fetch;

        const { result } = renderHook(() => usePhotoboothSession());

        await act(async () => {
            const started = await result.current.startSession();

            expect(started.ok).toBe(true);
        });

        let paymentResult:
            | Awaited<ReturnType<typeof result.current.createPayment>>
            | undefined;

        await act(async () => {
            paymentResult = await result.current.createPayment();
        });

        expect(paymentResult).toEqual({
            ok: true,
            checkoutUrl: null,
            checkoutQrCode: qrImageUrl,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);

        const paymentRequestUrl = String(fetchMock.mock.calls[1][0]);

        expect(paymentRequestUrl).toContain(
            '/b/acme-photo/kiosk/sessions/session-token-abc/payments',
        );
        expect(paymentRequestUrl).not.toContain('api.paymongo.com');
    });
});
