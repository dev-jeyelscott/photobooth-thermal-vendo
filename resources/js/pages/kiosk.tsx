import { Head } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    LoaderCircle,
    QrCode,
    Ticket,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { qrCode as galleryQrCode } from '@/actions/App/Http/Controllers/GalleryController';
import { CaptureStep } from '@/components/capture-step';
import type { KioskErrorKind } from '@/components/kiosk-error-state';
import { KioskErrorState } from '@/components/kiosk-error-state';
import { KioskPanel, KioskShell } from '@/components/kiosk-shell';
import type { KioskProgressStep } from '@/components/kiosk-shell';
import { PreviewStep } from '@/components/preview-step';
import { StickerSelectionStep } from '@/components/sticker-selection-step';
import { TemplateSelectionStep } from '@/components/template-selection-step';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIdleTimer } from '@/hooks/use-idle-timer';
import type {
    PhotoTemplateOption,
    StickerDesignOption,
} from '@/hooks/use-photobooth-session';
import {
    NETWORK_ERROR_MESSAGE,
    usePhotoboothSession,
} from '@/hooks/use-photobooth-session';

type KioskStep =
    | 'welcome'
    | 'pay-via-qr'
    | 'enter-voucher'
    | 'select-template'
    | 'capture'
    | 'select-sticker'
    | 'preview'
    | 'processing'
    | 'complete';

const DEFAULT_IDLE_TIMEOUT_SECONDS = 60;
const DEFAULT_CAPTURE_SHOT_COUNT = 3;
const DEFAULT_CAPTURE_RETAKE_LIMIT = 2;
const DEFAULT_CAPTURE_COUNTDOWN_SECONDS = 3;
const DEFAULT_PAYMENT_TIMEOUT_SECONDS = 120;
const PAYMENT_POLL_INTERVAL_MS = 3000;
const PAYMENT_POLL_MAX_BACKOFF_MS = 15000;
const PAYMENT_POLL_MAX_CONSECUTIVE_FAILURES = 5;
const PRINT_POLL_INTERVAL_MS = 3000;
const PRINT_POLL_MAX_BACKOFF_MS = 15000;
const PRINT_POLL_ATTEMPTS = 5;
const PROCESSING_POLL_INTERVAL_MS = 2000;
const PROCESSING_POLL_ATTEMPTS = 30;

/** Maps frontend presentation steps onto the seven-step reference journey. */
const progressStepFor = (step: KioskStep): KioskProgressStep => {
    switch (step) {
        case 'welcome':
        case 'pay-via-qr':
        case 'enter-voucher':
            return 1;
        case 'select-template':
            return 2;
        case 'capture':
            return 3;
        case 'select-sticker':
            return 4;
        case 'preview':
            return 5;
        case 'processing':
            return 6;
        case 'complete':
            return 7;
    }
};

/**
 * Customer-facing ThermaSnap kiosk. Backend session/payment state remains
 * authoritative while this component coordinates the visual journey, polling,
 * camera handoff, processing feedback, and safe browser reset behavior.
 */
export default function Kiosk({
    idleTimeoutSeconds = DEFAULT_IDLE_TIMEOUT_SECONDS,
    captureShotCount = DEFAULT_CAPTURE_SHOT_COUNT,
    captureRetakeLimit = DEFAULT_CAPTURE_RETAKE_LIMIT,
    captureCountdownSeconds = DEFAULT_CAPTURE_COUNTDOWN_SECONDS,
    paymentTimeoutSeconds = DEFAULT_PAYMENT_TIMEOUT_SECONDS,
    maintenanceMode = false,
    maintenanceMessage = '',
}: {
    idleTimeoutSeconds?: number;
    captureShotCount?: number;
    captureRetakeLimit?: number;
    captureCountdownSeconds?: number;
    paymentTimeoutSeconds?: number;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
}) {
    const [step, setStep] = useState<KioskStep>('welcome');
    const [isUnderMaintenance, setIsUnderMaintenance] =
        useState(maintenanceMode);
    const [activeMaintenanceMessage, setActiveMaintenanceMessage] =
        useState(maintenanceMessage);
    const [voucherCode, setVoucherCode] = useState('');
    const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);
    const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
    const [capturedPhotoPaths, setCapturedPhotoPaths] = useState<
        (string | null)[]
    >([]);
    const [selectedTemplate, setSelectedTemplate] =
        useState<PhotoTemplateOption | null>(null);
    const [selectedSticker, setSelectedSticker] =
        useState<StickerDesignOption | null>(null);
    const [galleryToken, setGalleryToken] = useState<string | null>(null);
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
    const [checkoutQrCode, setCheckoutQrCode] = useState<string | null>(null);
    const [paymentAttempt, setPaymentAttempt] = useState(0);
    const [printFailed, setPrintFailed] = useState(false);
    const [isPrinting, setIsPrinting] = useState(true);
    const [printDelayed, setPrintDelayed] = useState(false);
    const [kioskError, setKioskError] = useState<KioskErrorKind | null>(null);
    const [kioskErrorMessage, setKioskErrorMessage] = useState<string | null>(
        null,
    );
    const [kioskErrorRetry, setKioskErrorRetry] = useState<(() => void) | null>(
        null,
    );
    const { isIdle, resetTimer } = useIdleTimer(idleTimeoutSeconds * 1000);
    const {
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
    } = usePhotoboothSession();

    const createPaymentRef = useRef(createPayment);
    const refreshSessionRef = useRef(refreshSession);

    useEffect(() => {
        createPaymentRef.current = createPayment;
        refreshSessionRef.current = refreshSession;
    }, [createPayment, refreshSession]);

    const activeStep = isIdle ? 'welcome' : step;
    const showKioskError = kioskError !== null && !isIdle;
    const hasLiveCheckout = checkoutQrCode !== null;

    /** Clears the current recoverable error state. */
    const clearKioskError = () => {
        setKioskError(null);
        setKioskErrorMessage(null);
        setKioskErrorRetry(null);
    };

    /** Raises a customer-safe kiosk error with an optional in-place recovery. */
    const raiseKioskError = (
        kind: KioskErrorKind,
        options?: { message?: string; retry?: () => void },
    ) => {
        setKioskError(kind);
        setKioskErrorMessage(options?.message ?? null);
        setKioskErrorRetry(() => options?.retry ?? null);
    };

    /**
     * Fully resets browser-visible state after completion or unrecoverable exit,
     * including the stored session token so the next customer receives a new
     * backend session.
     */
    const startOver = () => {
        resetSession();
        setStep('welcome');
        setVoucherCode('');
        setCapturedPhotos([]);
        setCapturedPhotoPaths([]);
        setSelectedTemplate(null);
        setSelectedSticker(null);
        setGalleryToken(null);
        setCheckoutUrl(null);
        setCheckoutQrCode(null);
        setPrintFailed(false);
        setIsPrinting(true);
        setPrintDelayed(false);
        clearKioskError();
        resetTimer();
    };

    /**
     * Returns to the authorization choice without discarding an already-created
     * payment QR. Voucher switching remains blocked while the payment attempt
     * is still active.
     */
    const backToAuthorization = () => {
        setStep('welcome');
        clearKioskError();
        resetTimer();
    };

    /** Queues final media composition and exposes recoverable processing errors. */
    const finalizeSession = async () => {
        const result = await composeFinalOutput(
            capturedPhotos,
            capturedPhotoPaths,
        );

        if (!result.ok) {
            if (result.expired) {
                raiseKioskError('expired-session');
            } else if (result.message === NETWORK_ERROR_MESSAGE) {
                raiseKioskError('network-interruption', {
                    retry: () => {
                        clearKioskError();
                        void finalizeSession();
                    },
                });
            } else {
                raiseKioskError('processing-failure', {
                    message: result.message,
                    retry: () => {
                        clearKioskError();
                        void finalizeSession();
                    },
                });
            }
        }
    };

    /** Redeems the entered voucher and advances only after backend acceptance. */
    const submitVoucher = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isRedeemingVoucher) {
            return;
        }

        setIsRedeemingVoucher(true);
        clearKioskError();

        const result = await redeemVoucher(voucherCode.trim());

        setIsRedeemingVoucher(false);

        if (!result.ok) {
            if (result.expired) {
                raiseKioskError('expired-session');
            } else if (result.message === NETWORK_ERROR_MESSAGE) {
                raiseKioskError('network-interruption', {
                    retry: () => clearKioskError(),
                });
            } else {
                raiseKioskError('invalid-voucher', {
                    message: result.message,
                    retry: () => clearKioskError(),
                });
            }

            return;
        }

        setStep('select-template');
        resetTimer();
    };

    /** Creates a session when required, then opens the requested authorization step. */
    const beginStep = async (next: KioskStep) => {
        if (isResuming || isUnderMaintenance) {
            return;
        }

        if (!session) {
            const result = await startSession();

            if (!result.ok) {
                if (result.maintenance) {
                    setIsUnderMaintenance(true);
                    setActiveMaintenanceMessage(result.message);
                }

                return;
            }
        }

        clearKioskError();
        setStep(next);
        resetTimer();
    };

    // Creates one payment QR, or resumes polling the existing payment attempt,
    // until the backend reports a verified terminal payment state.
    useEffect(() => {
        if (step !== 'pay-via-qr') {
            return;
        }

        let cancelled = false;
        let pollTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let paymentTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

        /** Clears all payment polling timers owned by this effect instance. */
        const stopPolling = () => {
            if (pollTimeoutHandle) {
                clearTimeout(pollTimeoutHandle);
            }

            if (paymentTimeoutHandle) {
                clearTimeout(paymentTimeoutHandle);
            }
        };

        /** Clears a failed payment QR so a user-triggered retry can create a new one. */
        const retryPayment = () => {
            clearKioskError();
            setCheckoutUrl(null);
            setCheckoutQrCode(null);
            setPaymentAttempt((attempt) => attempt + 1);
        };

        /** Starts authoritative backend polling for the current payment attempt. */
        const startPolling = () => {
            let consecutiveFailures = 0;

            /** Schedules the next status poll with the requested delay. */
            const schedulePoll = (delayMs: number) => {
                pollTimeoutHandle = setTimeout(() => {
                    void poll();
                }, delayMs);
            };

            /** Restarts polling after a recoverable network/timeout error. */
            const resumePolling = () => {
                clearKioskError();
                consecutiveFailures = 0;
                schedulePoll(PAYMENT_POLL_INTERVAL_MS);
            };

            /** Reads Laravel payment state and never authorizes payment from React. */
            const poll = async () => {
                const refreshed = await refreshSessionRef.current();

                if (cancelled) {
                    return;
                }

                if (!refreshed) {
                    consecutiveFailures += 1;

                    if (
                        consecutiveFailures >=
                        PAYMENT_POLL_MAX_CONSECUTIVE_FAILURES
                    ) {
                        raiseKioskError('network-interruption', {
                            retry: resumePolling,
                        });

                        return;
                    }

                    schedulePoll(
                        Math.min(
                            PAYMENT_POLL_INTERVAL_MS * 2 ** consecutiveFailures,
                            PAYMENT_POLL_MAX_BACKOFF_MS,
                        ),
                    );

                    return;
                }

                consecutiveFailures = 0;

                if (
                    refreshed.paymentStatus === 'failed' ||
                    refreshed.paymentStatus === 'cancelled'
                ) {
                    stopPolling();
                    raiseKioskError('payment-failed', { retry: retryPayment });
                } else if (refreshed.status === 'expired') {
                    stopPolling();
                    raiseKioskError('expired-session');
                } else if (refreshed.status === 'paid') {
                    stopPolling();
                    clearKioskError();
                    setCheckoutUrl(null);
                    setCheckoutQrCode(null);
                    setStep('select-template');
                    resetTimer();
                } else {
                    schedulePoll(PAYMENT_POLL_INTERVAL_MS);
                }
            };

            schedulePoll(PAYMENT_POLL_INTERVAL_MS);

            paymentTimeoutHandle = setTimeout(() => {
                stopPolling();
                raiseKioskError('payment-timeout', { retry: resumePolling });
            }, paymentTimeoutSeconds * 1000);
        };

        /** Creates the payment QR once, then polls only the Laravel session state. */
        const startCheckout = async () => {
            if (hasLiveCheckout) {
                startPolling();

                return;
            }

            const result = await createPaymentRef.current();

            if (cancelled) {
                return;
            }

            if (!result.ok) {
                if (result.message === NETWORK_ERROR_MESSAGE) {
                    raiseKioskError('network-interruption', {
                        retry: retryPayment,
                    });
                } else {
                    raiseKioskError('payment-failed', {
                        message: result.message,
                        retry: retryPayment,
                    });
                }

                return;
            }

            setCheckoutUrl(result.checkoutUrl);
            setCheckoutQrCode(result.checkoutQrCode);
            startPolling();
        };

        void startCheckout();

        return () => {
            cancelled = true;
            stopPolling();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        step,
        paymentAttempt,
        paymentTimeoutSeconds,
        checkoutUrl,
        checkoutQrCode,
    ]);

    // Waits for the durable captured-media record to publish a gallery token.
    useEffect(() => {
        if (step !== 'processing') {
            return;
        }

        let cancelled = false;
        let attempts = 0;

        const pollHandle = setInterval(async () => {
            attempts += 1;

            const refreshed = await refreshSessionRef.current();

            if (cancelled || !refreshed) {
                if (!cancelled && attempts >= PROCESSING_POLL_ATTEMPTS) {
                    clearInterval(pollHandle);
                    raiseKioskError('network-interruption', {
                        retry: () => {
                            clearKioskError();
                            setStep('processing');
                            resetTimer();
                            void finalizeSession();
                        },
                    });
                }

                return;
            }

            if (refreshed.galleryToken) {
                clearInterval(pollHandle);
                setGalleryToken(refreshed.galleryToken);
                setStep('complete');
                resetTimer();
            } else if (attempts >= PROCESSING_POLL_ATTEMPTS) {
                clearInterval(pollHandle);
                raiseKioskError('processing-failure', {
                    retry: () => {
                        clearKioskError();
                        setStep('processing');
                        resetTimer();
                        void finalizeSession();
                    },
                });
            }
        }, PROCESSING_POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(pollHandle);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    // Advises the customer about the durable print job without blocking access
    // to already-generated digital media.
    useEffect(() => {
        if (step !== 'complete') {
            return;
        }

        let cancelled = false;
        let attempts = 0;
        let consecutiveFailures = 0;
        let pollHandle: ReturnType<typeof setTimeout> | undefined;

        /** Schedules the next print-status check. */
        const schedulePoll = (delayMs: number) => {
            pollHandle = setTimeout(() => {
                void poll();
            }, delayMs);
        };

        /** Reads the backend PrintJob projection and updates advisory UI only. */
        const poll = async () => {
            const refreshed = await refreshSessionRef.current();

            if (cancelled) {
                return;
            }

            if (!refreshed) {
                consecutiveFailures += 1;
                schedulePoll(
                    Math.min(
                        PRINT_POLL_INTERVAL_MS * 2 ** consecutiveFailures,
                        PRINT_POLL_MAX_BACKOFF_MS,
                    ),
                );

                return;
            }

            consecutiveFailures = 0;
            attempts += 1;

            if (refreshed.printJobStatus === 'failed') {
                setPrintFailed(true);
                setIsPrinting(false);
            } else if (refreshed.printJobStatus === 'printed') {
                setIsPrinting(false);
            } else if (attempts < PRINT_POLL_ATTEMPTS) {
                schedulePoll(PRINT_POLL_INTERVAL_MS);
            } else {
                setPrintDelayed(true);
            }
        };

        schedulePoll(PRINT_POLL_INTERVAL_MS);

        return () => {
            cancelled = true;

            if (pollHandle) {
                clearTimeout(pollHandle);
            }
        };
    }, [step]);

    const progressStep = progressStepFor(activeStep);
    const mediaReady =
        session?.galleryToken !== null && session?.galleryToken !== undefined;
    const printStatus = session?.printJobStatus;

    return (
        <>
            <Head title="Photobooth Kiosk" />
            <KioskShell step={progressStep}>
                {showKioskError && kioskError && (
                    <KioskPanel className="max-w-3xl py-14 sm:py-16">
                        <KioskErrorState
                            kind={kioskError}
                            message={kioskErrorMessage ?? undefined}
                            onRetry={
                                kioskErrorRetry
                                    ? () => kioskErrorRetry()
                                    : undefined
                            }
                            onBackToStart={
                                activeStep === 'pay-via-qr' &&
                                hasLiveCheckout &&
                                kioskError !== 'expired-session'
                                    ? backToAuthorization
                                    : startOver
                            }
                        />
                    </KioskPanel>
                )}

                {!showKioskError && (
                    <>
                        {activeStep === 'welcome' && (
                            <KioskPanel className="max-w-6xl px-6 py-10 sm:px-10 sm:py-12 lg:px-14 landscape:py-8">
                                <div
                                    data-testid="kiosk-welcome"
                                    className="mx-auto max-w-4xl text-center"
                                >
                                    <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                                        Start a new session
                                    </p>
                                    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-neutral-50 sm:text-4xl lg:text-[2.7rem]">
                                        How would you like to continue?
                                    </h1>
                                    <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                                        One verified payment or one valid
                                        voucher unlocks one photobooth session.
                                    </p>

                                    {isUnderMaintenance && (
                                        <p
                                            data-testid="kiosk-maintenance-message"
                                            className="mx-auto mt-6 max-w-xl rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200"
                                        >
                                            {activeMaintenanceMessage}
                                        </p>
                                    )}

                                    <div className="mt-8 grid gap-4 text-left md:grid-cols-2">
                                        <div className="rounded-xl border border-neutral-800 p-6 sm:p-7">
                                            <div className="grid size-14 place-items-center rounded-xl bg-neutral-800 text-neutral-100">
                                                <QrCode
                                                    aria-hidden="true"
                                                    className="size-6"
                                                />
                                            </div>
                                            <h2 className="mt-5 text-xl font-semibold text-neutral-50 sm:text-2xl">
                                                Pay via QR
                                            </h2>
                                            <p className="mt-2 max-w-sm text-sm leading-5 text-neutral-400 sm:text-base">
                                                Generate a secure PayMongo QR Ph
                                                code and scan it using your
                                                supported payment app.
                                            </p>
                                            <Button
                                                type="button"
                                                size="lg"
                                                aria-label="Pay via QR"
                                                disabled={
                                                    isResuming ||
                                                    isUnderMaintenance
                                                }
                                                onClick={() =>
                                                    void beginStep('pay-via-qr')
                                                }
                                                className="mt-6 min-h-12 w-full max-w-56 bg-neutral-100 text-neutral-950 hover:bg-white"
                                            >
                                                {hasLiveCheckout
                                                    ? 'Resume payment'
                                                    : 'Pay to start'}
                                            </Button>
                                        </div>

                                        <div className="rounded-xl border border-neutral-800 p-6 sm:p-7">
                                            <div className="grid size-14 place-items-center rounded-xl bg-neutral-800 text-neutral-100">
                                                <Ticket
                                                    aria-hidden="true"
                                                    className="size-6"
                                                />
                                            </div>
                                            <h2 className="mt-5 text-xl font-semibold text-neutral-50 sm:text-2xl">
                                                Use a voucher
                                            </h2>
                                            <p className="mt-2 max-w-sm text-sm leading-5 text-neutral-400 sm:text-base">
                                                Redeem an active voucher code.
                                                Valid vouchers unlock the same
                                                normal session flow.
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="lg"
                                                aria-label="Enter Voucher"
                                                disabled={
                                                    isResuming ||
                                                    isUnderMaintenance ||
                                                    hasLiveCheckout
                                                }
                                                onClick={() =>
                                                    void beginStep(
                                                        'enter-voucher',
                                                    )
                                                }
                                                className="mt-6 min-h-12 w-full max-w-56 border-neutral-800 bg-neutral-950 text-neutral-100 hover:bg-neutral-900 hover:text-white"
                                            >
                                                {hasLiveCheckout
                                                    ? 'Payment in progress'
                                                    : 'Enter voucher'}
                                            </Button>
                                        </div>
                                    </div>

                                    <p className="mt-6 text-xs leading-5 text-neutral-500">
                                        Session price is loaded from the
                                        configured photobooth settings and
                                        snapshotted when payment begins.
                                    </p>
                                </div>
                            </KioskPanel>
                        )}

                        {activeStep === 'pay-via-qr' && (
                            <KioskPanel className="max-w-5xl px-6 py-10 sm:px-10 lg:px-12">
                                <div
                                    data-testid="kiosk-pay-via-qr"
                                    className="grid items-center gap-8 md:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)] md:gap-12"
                                >
                                    <div className="flex flex-col items-center">
                                        {checkoutQrCode ? (
                                            <img
                                                data-testid="kiosk-payment-qr-code"
                                                src={checkoutQrCode}
                                                alt="PayMongo QR Ph payment code"
                                                className="aspect-square w-full max-w-64 rounded-2xl bg-white p-6 shadow-2xl shadow-black/40"
                                            />
                                        ) : (
                                            <div className="aspect-square w-full max-w-64 animate-pulse rounded-2xl bg-neutral-900" />
                                        )}
                                        <span className="mt-[-1.1rem] mr-2 ml-auto inline-flex rounded-full border border-blue-900 bg-blue-950 px-3 py-1.5 text-xs font-medium text-blue-400">
                                            • QR ready
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                                            Payment pending
                                        </p>
                                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-neutral-50 sm:text-4xl lg:text-[2.6rem]">
                                            Waiting for verified payment
                                        </h2>
                                        <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400 sm:text-base">
                                            Scan the PayMongo QR Ph code to
                                            complete payment. ThermaSnap
                                            continues automatically only after
                                            the Laravel backend confirms the
                                            durable payment state.
                                        </p>

                                        <div className="mt-7 rounded-xl border border-neutral-800 p-5">
                                            <p className="text-xs text-neutral-500">
                                                Payment state
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold text-neutral-100">
                                                Pending
                                            </p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <span className="rounded-full border border-neutral-800 px-3 py-2 text-xs text-neutral-400">
                                                    Backend polling active
                                                </span>
                                                <span className="rounded-full border border-neutral-800 px-3 py-2 text-xs text-neutral-400">
                                                    Webhook authoritative
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-6 flex flex-wrap gap-3">
                                            {checkoutUrl && (
                                                <Button
                                                    asChild
                                                    size="lg"
                                                    className="min-h-12 bg-neutral-100 px-6 text-neutral-950 hover:bg-white"
                                                >
                                                    <a
                                                        data-testid="kiosk-payment-checkout-link"
                                                        href={checkoutUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Open payment page
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="lg"
                                                onClick={backToAuthorization}
                                                className="min-h-12 border-red-900 bg-neutral-950 px-6 text-red-400 hover:bg-red-950/40 hover:text-red-300"
                                            >
                                                Back to start
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </KioskPanel>
                        )}

                        {activeStep === 'enter-voucher' && (
                            <KioskPanel className="max-w-3xl px-6 py-10 sm:px-10 sm:py-12">
                                <div
                                    data-testid="kiosk-enter-voucher"
                                    className="mx-auto max-w-lg text-center"
                                >
                                    <span className="mx-auto grid size-14 place-items-center rounded-xl bg-neutral-800 text-neutral-100">
                                        <Ticket
                                            aria-hidden="true"
                                            className="size-6"
                                        />
                                    </span>
                                    <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                                        Voucher
                                    </p>
                                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-neutral-50 sm:text-4xl">
                                        Enter your voucher
                                    </h2>
                                    <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                                        Redeem an active code to unlock one
                                        normal photobooth session.
                                    </p>
                                    <form
                                        onSubmit={submitVoucher}
                                        className="mt-7 space-y-3"
                                    >
                                        <Input
                                            data-testid="kiosk-voucher-input"
                                            value={voucherCode}
                                            onChange={(event) => {
                                                setVoucherCode(
                                                    event.target.value,
                                                );
                                            }}
                                            placeholder="Voucher code"
                                            aria-label="Voucher code"
                                            autoComplete="off"
                                            className="min-h-12 border-neutral-800 bg-neutral-950 text-center text-lg text-neutral-50 placeholder:text-neutral-600"
                                        />
                                        <Button
                                            type="submit"
                                            size="lg"
                                            disabled={
                                                isRedeemingVoucher ||
                                                voucherCode.trim().length === 0
                                            }
                                            className="min-h-12 w-full bg-neutral-100 text-neutral-950 hover:bg-white"
                                        >
                                            {isRedeemingVoucher
                                                ? 'Redeeming…'
                                                : 'Redeem Voucher'}
                                        </Button>
                                    </form>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        onClick={startOver}
                                        className="mt-3 min-h-12 border-neutral-800 bg-neutral-950 px-6 text-neutral-100 hover:bg-neutral-900 hover:text-white"
                                    >
                                        Back to Start
                                    </Button>
                                </div>
                            </KioskPanel>
                        )}

                        {activeStep === 'select-template' && (
                            <KioskPanel>
                                <TemplateSelectionStep
                                    fetchTemplates={fetchTemplates}
                                    selectTemplate={selectTemplate}
                                    onActivity={resetTimer}
                                    onSelected={(template) => {
                                        setSelectedTemplate(template);
                                        setStep('capture');
                                        resetTimer();
                                    }}
                                    onExpired={() =>
                                        raiseKioskError('expired-session')
                                    }
                                    onBackToStart={startOver}
                                />
                            </KioskPanel>
                        )}

                        {activeStep === 'capture' && (
                            <KioskPanel className="max-w-6xl p-6 sm:p-8">
                                <CaptureStep
                                    shotCount={
                                        session?.requiredCaptureCount ??
                                        captureShotCount
                                    }
                                    retakeLimit={captureRetakeLimit}
                                    countdownSeconds={captureCountdownSeconds}
                                    uploadShot={uploadCaptureShot}
                                    onActivity={resetTimer}
                                    onExit={startOver}
                                    onComplete={(photos, photoPaths) => {
                                        setCapturedPhotos(photos);
                                        setCapturedPhotoPaths(photoPaths);
                                        setStep('select-sticker');
                                        resetTimer();
                                    }}
                                />
                            </KioskPanel>
                        )}

                        {activeStep === 'select-sticker' &&
                            selectedTemplate && (
                                <KioskPanel className="max-w-6xl">
                                    <StickerSelectionStep
                                        fetchStickers={fetchStickers}
                                        selectSticker={selectSticker}
                                        capturedPhotos={capturedPhotos}
                                        template={selectedTemplate}
                                        onActivity={resetTimer}
                                        onContinue={(sticker) => {
                                            setSelectedSticker(sticker);
                                            setStep('preview');
                                            resetTimer();
                                        }}
                                        onExpired={() =>
                                            raiseKioskError('expired-session')
                                        }
                                        onBackToStart={startOver}
                                    />
                                </KioskPanel>
                            )}

                        {activeStep === 'preview' && selectedTemplate && (
                            <KioskPanel className="max-w-6xl">
                                <PreviewStep
                                    capturedPhotos={capturedPhotos}
                                    template={selectedTemplate}
                                    sticker={selectedSticker}
                                    confirmPreview={confirmPreview}
                                    onActivity={resetTimer}
                                    onRetakePhotos={() => {
                                        setCapturedPhotos([]);
                                        setCapturedPhotoPaths([]);
                                        setStep('capture');
                                        resetTimer();
                                    }}
                                    onChangeSticker={() => {
                                        setStep('select-sticker');
                                        resetTimer();
                                    }}
                                    onConfirmed={() => {
                                        setStep('processing');
                                        resetTimer();
                                        void finalizeSession();
                                    }}
                                    onExpired={() =>
                                        raiseKioskError('expired-session')
                                    }
                                    onBackToStart={startOver}
                                />
                            </KioskPanel>
                        )}

                        {activeStep === 'processing' && (
                            <KioskPanel className="max-w-5xl px-6 py-10 sm:px-10 lg:px-12">
                                <div
                                    data-testid="kiosk-processing"
                                    className="grid items-center gap-9 md:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.1fr)] md:gap-12"
                                >
                                    <div className="text-center">
                                        <span className="mx-auto block size-24 rounded-full border-[10px] border-neutral-800 border-t-blue-400" />
                                        <h2 className="mt-7 text-3xl font-semibold tracking-[-0.04em] text-neutral-50 sm:text-4xl">
                                            Preparing your photos
                                        </h2>
                                        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-400 sm:text-base">
                                            Heavy media generation runs safely
                                            while the kiosk keeps the customer
                                            informed.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <ProcessingStatusRow
                                            title="Color composition"
                                            description="Template and overlay rendering"
                                            done={mediaReady}
                                        />
                                        <ProcessingStatusRow
                                            title="Black & white + thermal"
                                            description="Monochrome outputs prepared"
                                            done={mediaReady}
                                        />
                                        <ProcessingStatusRow
                                            title="Animated GIF + gallery"
                                            description="Digital outputs and public token"
                                            done={mediaReady}
                                        />
                                        <ProcessingStatusRow
                                            title="Thermal printing"
                                            description="Print job queued through the printer driver"
                                            done={printStatus === 'printed'}
                                            failed={printStatus === 'failed'}
                                            active={
                                                printStatus === 'pending' ||
                                                printStatus === 'processing' ||
                                                printStatus === null
                                            }
                                            activeLabel="Printing"
                                        />
                                    </div>
                                </div>
                            </KioskPanel>
                        )}

                        {activeStep === 'complete' && galleryToken && (
                            <KioskPanel className="max-w-5xl px-6 py-10 sm:px-10 lg:px-12">
                                <div
                                    data-testid="kiosk-complete"
                                    className="mx-auto max-w-4xl"
                                >
                                    <div className="text-center">
                                        <span className="inline-flex rounded-full border border-emerald-900 bg-emerald-950 px-3 py-1.5 text-xs font-medium text-emerald-400">
                                            ✓ Session completed
                                        </span>
                                        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-neutral-50 sm:text-4xl">
                                            Your photos are ready
                                        </h2>
                                        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
                                            Scan the QR from your phone for the
                                            temporary gallery. Digital media
                                            stays available even if printing
                                            needs operator recovery.
                                        </p>
                                    </div>

                                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                                        <div className="flex flex-col items-center rounded-xl border border-neutral-800 p-6 text-center">
                                            <img
                                                data-testid="kiosk-gallery-qr-code"
                                                src={galleryQrCode.url(
                                                    galleryToken,
                                                )}
                                                alt="QR code linking to your photo gallery"
                                                className="aspect-square w-full max-w-64 rounded-2xl bg-white p-6 shadow-2xl shadow-black/40"
                                            />
                                            <p className="mt-5 text-lg font-semibold text-neutral-100">
                                                Scan for your gallery
                                            </p>
                                            <p className="mt-1 text-sm text-neutral-500">
                                                Color photo, black & white
                                                photo, and GIF.
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-neutral-800 p-6">
                                            <p className="text-xs text-neutral-500">
                                                Gallery
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold text-neutral-100">
                                                Ready
                                            </p>

                                            <div className="mt-5 space-y-3">
                                                <CompletionStatusRow
                                                    title="Digital gallery created"
                                                    description="Random public token, temporary access"
                                                    success
                                                />
                                                {printFailed ? (
                                                    <KioskErrorState kind="print-failure" />
                                                ) : (
                                                    <CompletionStatusRow
                                                        title="Thermal print"
                                                        description={
                                                            printDelayed
                                                                ? 'Your receipt is taking longer than expected to print. Your digital photos are already available.'
                                                                : isPrinting
                                                                  ? 'Receipt is printing through the configured driver.'
                                                                  : 'Print completed successfully.'
                                                        }
                                                        success={!isPrinting}
                                                        pending={isPrinting}
                                                        descriptionTestId="kiosk-printing-status"
                                                    />
                                                )}
                                            </div>

                                            <Button
                                                type="button"
                                                size="lg"
                                                onClick={startOver}
                                                className="mt-5 min-h-12 w-full bg-neutral-100 text-neutral-950 hover:bg-white"
                                            >
                                                Start a New Session
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </KioskPanel>
                        )}
                    </>
                )}

                {isIdle && (
                    <div
                        data-testid="kiosk-idle-overlay"
                        role="button"
                        tabIndex={0}
                        onClick={resetTimer}
                        onKeyDown={resetTimer}
                        className="absolute inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-3 bg-black/95 p-6 text-center"
                    >
                        <p className="text-3xl font-semibold tracking-[-0.04em] text-neutral-50 sm:text-4xl">
                            Tap Anywhere to Start
                        </p>
                        <p className="text-sm text-neutral-500 sm:text-base">
                            Touch the screen to continue the kiosk session.
                        </p>
                    </div>
                )}
            </KioskShell>
        </>
    );
}

/** Renders one truthful processing milestone from existing backend evidence. */
function ProcessingStatusRow({
    title,
    description,
    done,
    failed = false,
    active = false,
    activeLabel = 'Processing',
}: {
    title: string;
    description: string;
    done: boolean;
    failed?: boolean;
    active?: boolean;
    activeLabel?: string;
}) {
    return (
        <div className="flex items-center gap-4 rounded-xl border border-neutral-800 px-4 py-4">
            <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                    failed
                        ? 'bg-red-950 text-red-400'
                        : done
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-blue-950 text-blue-400'
                }`}
            >
                {done ? (
                    <Check aria-hidden="true" className="size-4" />
                ) : (
                    <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                    />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-100">
                    {title}
                </p>
                <p className="text-xs text-neutral-500">{description}</p>
            </div>
            <span
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    failed
                        ? 'border-red-900 text-red-400'
                        : done
                          ? 'border-emerald-900 text-emerald-400'
                          : 'border-blue-900 text-blue-400'
                }`}
            >
                {failed
                    ? 'Failed'
                    : done
                      ? 'Done'
                      : active
                        ? activeLabel
                        : 'Processing'}
            </span>
        </div>
    );
}

/** Renders result-screen gallery or print status without blocking digital access. */
function CompletionStatusRow({
    title,
    description,
    success,
    failed = false,
    pending = false,
    dataTestId,
    descriptionTestId,
}: {
    title: string;
    description: string;
    success: boolean;
    failed?: boolean;
    pending?: boolean;
    dataTestId?: string;
    descriptionTestId?: string;
}) {
    return (
        <div
            data-testid={dataTestId}
            className="flex items-center gap-4 rounded-xl border border-neutral-800 px-4 py-4"
        >
            <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                    failed
                        ? 'bg-red-950 text-red-400'
                        : success
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-blue-950 text-blue-400'
                }`}
            >
                {failed ? (
                    <AlertTriangle aria-hidden="true" className="size-4" />
                ) : pending ? (
                    <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                    />
                ) : (
                    <Check aria-hidden="true" className="size-4" />
                )}
            </span>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-100">
                    {title}
                </p>
                <p
                    data-testid={descriptionTestId}
                    className="text-xs leading-5 text-neutral-500"
                >
                    {description}
                </p>
            </div>
        </div>
    );
}
