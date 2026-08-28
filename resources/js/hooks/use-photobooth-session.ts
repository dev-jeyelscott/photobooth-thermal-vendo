import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { store as uploadCaptureShotFile } from '@/actions/App/Http/Controllers/CaptureShotController';
import { store as composeColorOutput } from '@/actions/App/Http/Controllers/ColorCompositionController';
import { store as createPaymentCheckout } from '@/actions/App/Http/Controllers/PaymentController';
import {
    show,
    store,
} from '@/actions/App/Http/Controllers/PhotoboothSessionController';
import {
    index as listTemplates,
    store as selectTemplateId,
} from '@/actions/App/Http/Controllers/PhotoTemplateController';
import { store as confirmSessionPreview } from '@/actions/App/Http/Controllers/PreviewController';
import {
    index as listStickers,
    store as selectStickerId,
} from '@/actions/App/Http/Controllers/StickerDesignController';
import { store as redeemVoucherCode } from '@/actions/App/Http/Controllers/VoucherController';

const STORAGE_KEY_PREFIX = 'photobooth.session_token';

type KioskPageProps = Record<string, unknown> & {
    businessSlug: string;
};

/** Returned as the failure message whenever a kiosk request never reaches the server. */
export const NETWORK_ERROR_MESSAGE =
    'We lost connection to the server. Please check the network and try again.';

export type PhotoboothSession = {
    sessionToken: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    paymentStatus: string | null;
    printJobStatus: string | null;
    requiredCaptureCount: number | null;
    galleryToken: string | null;
};

type ActionFailure = { ok: false; message: string; expired: boolean };

type StartSessionFailure = {
    ok: false;
    message: string;
    maintenance: boolean;
};

export type PhotoTemplateOption = {
    id: number;
    name: string;
    layoutUrl?: string | null;
    thumbnailPath: string | null;
    photoSlots: number;
    layoutConfig: Record<string, unknown> | null;
    printWidthMm: number;
    printHeightMm: number;
};

export type StickerDesignOption = {
    id: number;
    name: string;
    assetPath: string;
    thumbnailPath: string | null;
};

/** Reads the active session token from tenant-specific per-tab storage. */
const readStoredToken = (storageKey: string): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.sessionStorage.getItem(storageKey);
};

/** Stores or clears the tenant-specific session token. */
const storeToken = (storageKey: string, token: string | null): void => {
    if (typeof window === 'undefined') {
        return;
    }

    if (token) {
        window.sessionStorage.setItem(storageKey, token);
    } else {
        window.sessionStorage.removeItem(storageKey);
    }
};

/** Reads Laravel's XSRF cookie for standalone public kiosk requests. */
const readXsrfToken = (): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);

    return match ? decodeURIComponent(match[1]) : null;
};

/**
 * Creates or resumes the active Business-scoped photobooth session while
 * keeping Laravel authoritative for all durable state transitions.
 */
export function usePhotoboothSession() {
    const { businessSlug } = usePage<KioskPageProps>().props;
    const storageKey = `${STORAGE_KEY_PREFIX}.${businessSlug}`;

    const [session, setSession] = useState<PhotoboothSession | null>(null);
    const [isResuming, setIsResuming] = useState(
        () => readStoredToken(storageKey) !== null,
    );

    /** Creates a new backend-owned Business kiosk session. */
    const startSession = useCallback(async (): Promise<
        { ok: true; session: PhotoboothSession } | StartSessionFailure
    > => {
        const response = await fetch(
            store.url({
                business: businessSlug,
            }),
            {
                method: 'post',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': readXsrfToken() ?? '',
                },
            },
        );

        if (!response.ok) {
            const body = (await response.json()) as {
                message?: string;
                maintenance?: boolean;
            };

            return {
                ok: false,
                message: body.message ?? 'This session could not be started.',
                maintenance: body.maintenance ?? false,
            };
        }

        const created = (await response.json()) as PhotoboothSession;

        storeToken(storageKey, created.sessionToken);
        setSession(created);

        return { ok: true, session: created };
    }, [businessSlug, storageKey]);

    /** Clears browser-visible session state after completion or reset. */
    const resetSession = useCallback((): void => {
        storeToken(storageKey, null);
        setSession(null);
        setIsResuming(false);
    }, [storageKey]);

    /** Redeems a voucher against the Business-scoped active session. */
    const redeemVoucher = useCallback(
        async (code: string): Promise<{ ok: true } | ActionFailure> => {
            if (!session) {
                return {
                    ok: false,
                    message: 'No active session.',
                    expired: false,
                };
            }

            try {
                const response = await fetch(
                    redeemVoucherCode.url({
                        business: businessSlug,
                        photoboothSession: session.sessionToken,
                    }),
                    {
                        method: 'post',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-XSRF-TOKEN': readXsrfToken() ?? '',
                        },
                        body: JSON.stringify({ code }),
                    },
                );

                const body = (await response.json()) as {
                    status?: string;
                    message?: string;
                };

                if (!response.ok) {
                    return {
                        ok: false,
                        message:
                            body.message ??
                            'This voucher could not be redeemed.',
                        expired: body.status === 'expired',
                    };
                }

                setSession({
                    ...session,
                    status: body.status ?? session.status,
                });

                return { ok: true };
            } catch {
                return {
                    ok: false,
                    message: NETWORK_ERROR_MESSAGE,
                    expired: false,
                };
            }
        },
        [businessSlug, session],
    );

    /** Fetches globally managed templates through the current Business route. */
    const fetchTemplates = useCallback(async (): Promise<
        PhotoTemplateOption[]
    > => {
        const response = await fetch(
            listTemplates.url({
                business: businessSlug,
            }),
            {
                headers: { Accept: 'application/json' },
            },
        );

        const body = (await response.json()) as {
            templates: PhotoTemplateOption[];
        };

        return body.templates;
    }, [businessSlug]);

    /** Persists the selected template for the Business-scoped session. */
    const selectTemplate = useCallback(
        async (
            photoTemplateId: number,
        ): Promise<{ ok: true } | ActionFailure> => {
            if (!session) {
                return {
                    ok: false,
                    message: 'No active session.',
                    expired: false,
                };
            }

            try {
                const response = await fetch(
                    selectTemplateId.url({
                        business: businessSlug,
                        photoboothSession: session.sessionToken,
                    }),
                    {
                        method: 'post',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-XSRF-TOKEN': readXsrfToken() ?? '',
                        },
                        body: JSON.stringify({ photoTemplateId }),
                    },
                );

                const body = (await response.json()) as {
                    status?: string;
                    requiredCaptureCount?: number | null;
                    message?: string;
                };

                if (!response.ok) {
                    return {
                        ok: false,
                        message:
                            body.message ??
                            'This template could not be selected.',
                        expired: body.status === 'expired',
                    };
                }

                setSession({
                    ...session,
                    status: body.status ?? session.status,
                    requiredCaptureCount:
                        body.requiredCaptureCount ??
                        session.requiredCaptureCount,
                });

                return { ok: true };
            } catch {
                return {
                    ok: false,
                    message: NETWORK_ERROR_MESSAGE,
                    expired: false,
                };
            }
        },
        [businessSlug, session],
    );

    /** Fetches enabled stickers through the current Business route. */
    const fetchStickers = useCallback(async (): Promise<
        StickerDesignOption[]
    > => {
        const response = await fetch(
            listStickers.url(
                {
                    business: businessSlug,
                },
                {
                    query: session
                        ? { sessionToken: session.sessionToken }
                        : {},
                },
            ),
            {
                headers: { Accept: 'application/json' },
            },
        );

        const body = (await response.json()) as {
            stickers: StickerDesignOption[];
        };

        return body.stickers;
    }, [businessSlug, session]);

    /** Persists the final sticker selection for the active session. */
    const selectSticker = useCallback(
        async (
            stickerDesignId: number,
        ): Promise<{ ok: true } | ActionFailure> => {
            if (!session) {
                return {
                    ok: false,
                    message: 'No active session.',
                    expired: false,
                };
            }

            try {
                const response = await fetch(
                    selectStickerId.url({
                        business: businessSlug,
                        photoboothSession: session.sessionToken,
                    }),
                    {
                        method: 'post',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-XSRF-TOKEN': readXsrfToken() ?? '',
                        },
                        body: JSON.stringify({ stickerDesignId }),
                    },
                );

                const body = (await response.json()) as {
                    status?: string;
                    message?: string;
                };

                if (!response.ok) {
                    return {
                        ok: false,
                        message:
                            body.message ??
                            'This sticker could not be selected.',
                        expired: body.status === 'expired',
                    };
                }

                setSession({
                    ...session,
                    status: body.status ?? session.status,
                });

                return { ok: true };
            } catch {
                return {
                    ok: false,
                    message: NETWORK_ERROR_MESSAGE,
                    expired: false,
                };
            }
        },
        [businessSlug, session],
    );

    /** Confirms the existing backend preview boundary. */
    const confirmPreview = useCallback(async (): Promise<
        { ok: true } | ActionFailure
    > => {
        if (!session) {
            return {
                ok: false,
                message: 'No active session.',
                expired: false,
            };
        }

        try {
            const response = await fetch(
                confirmSessionPreview.url({
                    business: businessSlug,
                    photoboothSession: session.sessionToken,
                }),
                {
                    method: 'post',
                    headers: {
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': readXsrfToken() ?? '',
                    },
                },
            );

            const body = (await response.json()) as {
                status?: string;
                message?: string;
            };

            if (!response.ok) {
                return {
                    ok: false,
                    message:
                        body.message ?? 'This preview could not be confirmed.',
                    expired: body.status === 'expired',
                };
            }

            setSession({
                ...session,
                status: body.status ?? session.status,
            });

            return { ok: true };
        } catch {
            return {
                ok: false,
                message: NETWORK_ERROR_MESSAGE,
                expired: false,
            };
        }
    }, [businessSlug, session]);

    /** Uploads one captured JPEG frame for the Business-scoped session. */
    const uploadCaptureShot = useCallback(
        async (dataUrl: string): Promise<string | null> => {
            if (!session) {
                return null;
            }

            try {
                const shotBlob = await (await fetch(dataUrl)).blob();
                const formData = new FormData();

                formData.append('shot', shotBlob, 'shot.jpg');

                const response = await fetch(
                    uploadCaptureShotFile.url({
                        business: businessSlug,
                        photoboothSession: session.sessionToken,
                    }),
                    {
                        method: 'post',
                        headers: {
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': readXsrfToken() ?? '',
                        },
                        body: formData,
                    },
                );

                const body = (await response.json()) as {
                    path?: string;
                };

                return response.ok && body.path ? body.path : null;
            } catch {
                return null;
            }
        },
        [businessSlug, session],
    );

    /** Queues final output generation using stored frame paths when possible. */
    const composeFinalOutput = useCallback(
        async (
            photos: string[],
            photoPaths: (string | null)[] = [],
        ): Promise<{ ok: true } | ActionFailure> => {
            if (!session) {
                return {
                    ok: false,
                    message: 'No active session.',
                    expired: false,
                };
            }

            const storedPaths = photoPaths.filter(
                (path): path is string => path !== null,
            );

            const usableStoredPaths =
                storedPaths.length === photos.length ? storedPaths : null;

            try {
                const response = await fetch(
                    composeColorOutput.url({
                        business: businessSlug,
                        photoboothSession: session.sessionToken,
                    }),
                    {
                        method: 'post',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-XSRF-TOKEN': readXsrfToken() ?? '',
                        },
                        body: JSON.stringify(
                            usableStoredPaths
                                ? { photo_paths: usableStoredPaths }
                                : { photos },
                        ),
                    },
                );

                const body = (await response.json()) as {
                    status?: string;
                    message?: string;
                };

                if (!response.ok) {
                    return {
                        ok: false,
                        message:
                            body.message ??
                            'This session could not be processed.',
                        expired: body.status === 'expired',
                    };
                }

                setSession({
                    ...session,
                    status: body.status ?? session.status,
                });

                return { ok: true };
            } catch {
                return {
                    ok: false,
                    message: NETWORK_ERROR_MESSAGE,
                    expired: false,
                };
            }
        },
        [businessSlug, session],
    );

    /**
     * Creates the tenant-owned payment QR for the Business-scoped session.
     *
     * Native PayMongo QR Ph returns qrImageUrl directly. Legacy checkout fields
     * remain accepted temporarily for staged migration regression coverage.
     */
    const createPayment = useCallback(async (): Promise<
        | {
              ok: true;
              checkoutUrl: string | null;
              checkoutQrCode: string;
          }
        | ActionFailure
    > => {
        if (!session) {
            return {
                ok: false,
                message: 'No active session.',
                expired: false,
            };
        }

        try {
            const response = await fetch(
                createPaymentCheckout.url({
                    business: businessSlug,
                    photoboothSession: session.sessionToken,
                }),
                {
                    method: 'post',
                    headers: {
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': readXsrfToken() ?? '',
                    },
                },
            );

            const body = (await response.json()) as {
                payment?: {
                    id?: number;
                    status?: string;
                    providerStatus?: string | null;
                    amount?: string;
                    currency?: string;
                    expiresAt?: string | null;
                };
                qrImageUrl?: string;
                checkoutUrl?: string;
                checkoutQrCode?: string;
                message?: string;
            };

            const checkoutQrCode = body.qrImageUrl ?? body.checkoutQrCode;

            if (!response.ok || !checkoutQrCode) {
                return {
                    ok: false,
                    message:
                        body.message ?? 'This payment could not be started.',
                    expired: false,
                };
            }

            return {
                ok: true,
                checkoutUrl: body.checkoutUrl ?? null,
                checkoutQrCode,
            };
        } catch {
            return {
                ok: false,
                message: NETWORK_ERROR_MESSAGE,
                expired: false,
            };
        }
    }, [businessSlug, session]);

    /** Refreshes the authoritative Business-scoped backend session. */
    const refreshSession =
        useCallback(async (): Promise<PhotoboothSession | null> => {
            if (!session) {
                return null;
            }

            try {
                const response = await fetch(
                    show.url({
                        business: businessSlug,
                        photoboothSession: session.sessionToken,
                    }),
                    {
                        headers: {
                            Accept: 'application/json',
                        },
                    },
                );

                if (!response.ok) {
                    if (response.status === 410) {
                        const expiredSession = {
                            ...session,
                            status: 'expired',
                        };

                        setSession(expiredSession);

                        return expiredSession;
                    }

                    return null;
                }

                const refreshed = (await response.json()) as PhotoboothSession;

                setSession(refreshed);

                return refreshed;
            } catch {
                return null;
            }
        }, [businessSlug, session]);

    useEffect(() => {
        const token = readStoredToken(storageKey);

        if (!token) {
            return;
        }

        fetch(
            show.url({
                business: businessSlug,
                photoboothSession: token,
            }),
            {
                headers: {
                    Accept: 'application/json',
                },
            },
        )
            .then(async (response) => {
                if (!response.ok) {
                    storeToken(storageKey, null);

                    return;
                }

                setSession((await response.json()) as PhotoboothSession);
            })
            .finally(() => {
                setIsResuming(false);
            });
    }, [businessSlug, storageKey]);

    return {
        session,
        startSession,
        resetSession,
        isResuming,
        redeemVoucher,
        fetchTemplates,
        selectTemplate,
        fetchStickers,
        selectSticker,
        confirmPreview,
        uploadCaptureShot,
        composeFinalOutput,
        createPayment,
        refreshSession,
    };
}
