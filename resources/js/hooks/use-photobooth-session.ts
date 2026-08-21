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

const STORAGE_KEY = 'photobooth.session_token';

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

const readStoredToken = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.sessionStorage.getItem(STORAGE_KEY);
};

const storeToken = (token: string | null): void => {
    if (typeof window === 'undefined') {
        return;
    }

    if (token) {
        window.sessionStorage.setItem(STORAGE_KEY, token);
    } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
    }
};

const readXsrfToken = (): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);

    return match ? decodeURIComponent(match[1]) : null;
};

/**
 * Creates or resumes the active photobooth session for the kiosk, persisting
 * the session token client-side so a page refresh resumes the same session.
 */
export function usePhotoboothSession() {
    const [session, setSession] = useState<PhotoboothSession | null>(null);
    const [isResuming, setIsResuming] = useState(
        () => readStoredToken() !== null,
    );

    const startSession = useCallback(async (): Promise<
        { ok: true; session: PhotoboothSession } | StartSessionFailure
    > => {
        const response = await fetch(store.url(), {
            method: 'post',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': readXsrfToken() ?? '',
            },
        });

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

        storeToken(created.sessionToken);
        setSession(created);

        return { ok: true, session: created };
    }, []);

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
                    redeemVoucherCode.url(session.sessionToken),
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
        [session],
    );

    const fetchTemplates = useCallback(async (): Promise<
        PhotoTemplateOption[]
    > => {
        const response = await fetch(listTemplates.url(), {
            headers: { Accept: 'application/json' },
        });

        const body = (await response.json()) as {
            templates: PhotoTemplateOption[];
        };

        return body.templates;
    }, []);

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
                    selectTemplateId.url(session.sessionToken),
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
        [session],
    );

    const fetchStickers = useCallback(async (): Promise<
        StickerDesignOption[]
    > => {
        const response = await fetch(
            listStickers.url({
                query: session ? { sessionToken: session.sessionToken } : {},
            }),
            { headers: { Accept: 'application/json' } },
        );

        const body = (await response.json()) as {
            stickers: StickerDesignOption[];
        };

        return body.stickers;
    }, [session]);

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
                    selectStickerId.url(session.sessionToken),
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
        [session],
    );

    const confirmPreview = useCallback(async (): Promise<
        { ok: true } | ActionFailure
    > => {
        if (!session) {
            return { ok: false, message: 'No active session.', expired: false };
        }

        try {
            const response = await fetch(
                confirmSessionPreview.url(session.sessionToken),
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

            setSession({ ...session, status: body.status ?? session.status });

            return { ok: true };
        } catch {
            return {
                ok: false,
                message: NETWORK_ERROR_MESSAGE,
                expired: false,
            };
        }
    }, [session]);

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
                    uploadCaptureShotFile.url(session.sessionToken),
                    {
                        method: 'post',
                        headers: {
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': readXsrfToken() ?? '',
                        },
                        body: formData,
                    },
                );

                const body = (await response.json()) as { path?: string };

                return response.ok && body.path ? body.path : null;
            } catch {
                return null;
            }
        },
        [session],
    );

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
                    composeColorOutput.url(session.sessionToken),
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
        [session],
    );

    const createPayment = useCallback(async (): Promise<
        { ok: true; checkoutUrl: string } | ActionFailure
    > => {
        if (!session) {
            return { ok: false, message: 'No active session.', expired: false };
        }

        try {
            const response = await fetch(
                createPaymentCheckout.url(session.sessionToken),
                {
                    method: 'post',
                    headers: {
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': readXsrfToken() ?? '',
                    },
                },
            );

            const body = (await response.json()) as {
                checkoutUrl?: string;
                message?: string;
            };

            if (!response.ok || !body.checkoutUrl) {
                return {
                    ok: false,
                    message:
                        body.message ?? 'This payment could not be started.',
                    expired: false,
                };
            }

            return { ok: true, checkoutUrl: body.checkoutUrl };
        } catch {
            return {
                ok: false,
                message: NETWORK_ERROR_MESSAGE,
                expired: false,
            };
        }
    }, [session]);

    const refreshSession =
        useCallback(async (): Promise<PhotoboothSession | null> => {
            if (!session) {
                return null;
            }

            try {
                const response = await fetch(show.url(session.sessionToken), {
                    headers: { Accept: 'application/json' },
                });

                if (!response.ok) {
                    if (response.status === 410) {
                        setSession({ ...session, status: 'expired' });
                    }

                    return null;
                }

                const refreshed = (await response.json()) as PhotoboothSession;

                setSession(refreshed);

                return refreshed;
            } catch {
                return null;
            }
        }, [session]);

    useEffect(() => {
        const token = readStoredToken();

        if (!token) {
            return;
        }

        fetch(show.url(token), {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    storeToken(null);

                    return;
                }

                setSession((await response.json()) as PhotoboothSession);
            })
            .finally(() => {
                setIsResuming(false);
            });
    }, []);

    return {
        session,
        startSession,
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
