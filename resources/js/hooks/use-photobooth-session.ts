import { useCallback, useEffect, useState } from 'react';
import {
    show,
    store,
} from '@/actions/App/Http/Controllers/PhotoboothSessionController';
import { store as redeemVoucherCode } from '@/actions/App/Http/Controllers/VoucherController';

const STORAGE_KEY = 'photobooth.session_token';

export type PhotoboothSession = {
    sessionToken: string;
    status: string;
    startedAt: string;
    expiresAt: string;
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

    return { session, startSession, isResuming, redeemVoucher };
}
