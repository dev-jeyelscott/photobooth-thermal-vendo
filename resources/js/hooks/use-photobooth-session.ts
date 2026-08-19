import { useCallback, useEffect, useState } from 'react';
import { store as composeColorOutput } from '@/actions/App/Http/Controllers/ColorCompositionController';
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

export type PhotoboothSession = {
    sessionToken: string;
    status: string;
    startedAt: string;
    expiresAt: string;
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

    const startSession = useCallback(async (): Promise<PhotoboothSession> => {
        const response = await fetch(store.url(), {
            method: 'post',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': readXsrfToken() ?? '',
            },
        });

        const created = (await response.json()) as PhotoboothSession;

        storeToken(created.sessionToken);
        setSession(created);

        return created;
    }, []);

    const redeemVoucher = useCallback(
        async (
            code: string,
        ): Promise<{ ok: true } | { ok: false; message: string }> => {
            if (!session) {
                return { ok: false, message: 'No active session.' };
            }

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
                        body.message ?? 'This voucher could not be redeemed.',
                };
            }

            setSession({ ...session, status: body.status ?? session.status });

            return { ok: true };
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
        ): Promise<{ ok: true } | { ok: false; message: string }> => {
            if (!session) {
                return { ok: false, message: 'No active session.' };
            }

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
                message?: string;
            };

            if (!response.ok) {
                return {
                    ok: false,
                    message:
                        body.message ?? 'This template could not be selected.',
                };
            }

            setSession({ ...session, status: body.status ?? session.status });

            return { ok: true };
        },
        [session],
    );

    const fetchStickers = useCallback(async (): Promise<
        StickerDesignOption[]
    > => {
        const response = await fetch(listStickers.url(), {
            headers: { Accept: 'application/json' },
        });

        const body = (await response.json()) as {
            stickers: StickerDesignOption[];
        };

        return body.stickers;
    }, []);

    const selectSticker = useCallback(
        async (
            stickerDesignId: number,
        ): Promise<{ ok: true } | { ok: false; message: string }> => {
            if (!session) {
                return { ok: false, message: 'No active session.' };
            }

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
                        body.message ?? 'This sticker could not be selected.',
                };
            }

            setSession({ ...session, status: body.status ?? session.status });

            return { ok: true };
        },
        [session],
    );

    const confirmPreview = useCallback(async (): Promise<
        { ok: true } | { ok: false; message: string }
    > => {
        if (!session) {
            return { ok: false, message: 'No active session.' };
        }

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
                message: body.message ?? 'This preview could not be confirmed.',
            };
        }

        setSession({ ...session, status: body.status ?? session.status });

        return { ok: true };
    }, [session]);

    const composeFinalOutput = useCallback(
        async (
            photos: string[],
        ): Promise<
            { ok: true; galleryToken: string } | { ok: false; message: string }
        > => {
            if (!session) {
                return { ok: false, message: 'No active session.' };
            }

            const response = await fetch(
                composeColorOutput.url(session.sessionToken),
                {
                    method: 'post',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': readXsrfToken() ?? '',
                    },
                    body: JSON.stringify({ photos }),
                },
            );

            const body = (await response.json()) as {
                status?: string;
                galleryToken?: string;
                message?: string;
            };

            if (!response.ok || !body.galleryToken) {
                return {
                    ok: false,
                    message:
                        body.message ?? 'This session could not be processed.',
                };
            }

            setSession({ ...session, status: body.status ?? session.status });

            return { ok: true, galleryToken: body.galleryToken };
        },
        [session],
    );

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
        composeFinalOutput,
    };
}
