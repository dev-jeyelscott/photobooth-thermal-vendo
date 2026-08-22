import { Head } from '@inertiajs/react';
import { QrCode, Ticket } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { qrCode as galleryQrCode } from '@/actions/App/Http/Controllers/GalleryController';
import { CaptureStep } from '@/components/capture-step';
import type { KioskErrorKind } from '@/components/kiosk-error-state';
import { KioskErrorState } from '@/components/kiosk-error-state';
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
    | 'captured'
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
const PRINT_POLL_MAX_CONSECUTIVE_FAILURES = 5;
const PROCESSING_POLL_INTERVAL_MS = 2000;
const PROCESSING_POLL_ATTEMPTS = 30;

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
    const [paymentAttempt, setPaymentAttempt] = useState(0);
    const [printFailed, setPrintFailed] = useState(false);
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

    // Keep the latest session-bound callbacks available to polling effects
    // without re-running them every time the underlying session updates.
    const createPaymentRef = useRef(createPayment);
    const refreshSessionRef = useRef(refreshSession);

    useEffect(() => {
        createPaymentRef.current = createPayment;
        refreshSessionRef.current = refreshSession;
    }, [createPayment, refreshSession]);

    // Abandoned sessions reset back to the start screen once the customer goes idle.
    const activeStep = isIdle ? 'welcome' : step;
    const showKioskError = kioskError !== null && !isIdle;

    const clearKioskError = () => {
        setKioskError(null);
        setKioskErrorMessage(null);
        setKioskErrorRetry(null);
    };

    const raiseKioskError = (
        kind: KioskErrorKind,
        options?: { message?: string; retry?: () => void },
    ) => {
        setKioskError(kind);
        setKioskErrorMessage(options?.message ?? null);
        setKioskErrorRetry(() => options?.retry ?? null);
    };

    const startOver = () => {
        setStep('welcome');
        setVoucherCode('');
        setCapturedPhotos([]);
        setCapturedPhotoPaths([]);
        setSelectedTemplate(null);
        setSelectedSticker(null);
        setGalleryToken(null);
        setCheckoutUrl(null);
        setPrintFailed(false);
        clearKioskError();
        resetTimer();
    };

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

    // Creates a Maya checkout for the pay-via-qr step and polls the session
    // until payment succeeds, fails, or the configured timeout elapses.
    // Once a checkout has been created, transient poll failures never
    // re-issue a checkout request; they only back off and retry the poll so
    // a single Maya checkout stays authoritative for the session.
    useEffect(() => {
        if (step !== 'pay-via-qr') {
            return;
        }

        let cancelled = false;
        let pollTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let paymentTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const stopPolling = () => {
            if (pollTimeoutHandle) {
                clearTimeout(pollTimeoutHandle);
            }

            if (paymentTimeoutHandle) {
                clearTimeout(paymentTimeoutHandle);
            }
        };

        const retryPayment = () => {
            clearKioskError();
            setPaymentAttempt((attempt) => attempt + 1);
        };

        const startCheckout = async () => {
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

            let consecutiveFailures = 0;

            const resumePolling = () => {
                clearKioskError();
                consecutiveFailures = 0;
                schedulePoll(PAYMENT_POLL_INTERVAL_MS);
            };

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
                            PAYMENT_POLL_INTERVAL_MS *
                                2 ** consecutiveFailures,
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
                } else if (refreshed.status === 'paid') {
                    stopPolling();
                    clearKioskError();
                    setStep('select-template');
                    resetTimer();
                } else {
                    schedulePoll(PAYMENT_POLL_INTERVAL_MS);
                }
            };

            function schedulePoll(delayMs: number) {
                pollTimeoutHandle = setTimeout(() => {
                    void poll();
                }, delayMs);
            }

            schedulePoll(PAYMENT_POLL_INTERVAL_MS);

            paymentTimeoutHandle = setTimeout(() => {
                stopPolling();
                raiseKioskError('payment-timeout', { retry: retryPayment });
            }, paymentTimeoutSeconds * 1000);
        };

        void startCheckout();

        return () => {
            cancelled = true;
            stopPolling();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, paymentAttempt, paymentTimeoutSeconds]);

    // Polls the session until the queued composition job publishes a
    // gallery token, then advances to the completion step.
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

    // Advisory poll for print-job failures once the receipt has been queued;
    // this never blocks the customer, who already has their digital gallery.
    // Transient network failures don't count against the attempt budget, so
    // a brief connectivity drop still resolves to the real terminal PrintJob
    // state instead of the poll silently stopping mid-flight.
    useEffect(() => {
        if (step !== 'complete') {
            return;
        }

        let cancelled = false;
        let attempts = 0;
        let consecutiveFailures = 0;
        let pollHandle: ReturnType<typeof setTimeout> | undefined;

        const schedulePoll = (delayMs: number) => {
            pollHandle = setTimeout(() => {
                void poll();
            }, delayMs);
        };

        const poll = async () => {
            const refreshed = await refreshSessionRef.current();

            if (cancelled) {
                return;
            }

            if (!refreshed) {
                consecutiveFailures += 1;

                if (
                    consecutiveFailures >= PRINT_POLL_MAX_CONSECUTIVE_FAILURES
                ) {
                    return;
                }

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
            } else if (
                refreshed.printJobStatus !== 'printed' &&
                attempts < PRINT_POLL_ATTEMPTS
            ) {
                schedulePoll(PRINT_POLL_INTERVAL_MS);
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

    return (
        <>
            <Head title="Photobooth Kiosk" />
            <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-neutral-950 to-neutral-900 p-4 text-white select-none sm:p-6">
                {showKioskError && kioskError && (
                    <KioskErrorState
                        kind={kioskError}
                        message={kioskErrorMessage ?? undefined}
                        onRetry={
                            kioskErrorRetry
                                ? () => kioskErrorRetry()
                                : undefined
                        }
                        onBackToStart={startOver}
                    />
                )}

                {!showKioskError && (
                    <>
                        {activeStep === 'welcome' && (
                            <div
                                data-testid="kiosk-welcome"
                                className="flex w-full max-w-3xl flex-col items-center gap-6 text-center sm:gap-10 landscape:gap-5"
                            >
                                <div className="space-y-2 sm:space-y-3">
                                    <p className="text-base font-medium tracking-wide text-neutral-400 uppercase sm:text-lg">
                                        Photobooth
                                    </p>
                                    <h1 className="text-3xl font-bold sm:text-5xl lg:text-6xl">
                                        Tap to Begin
                                    </h1>
                                    <p className="text-base text-neutral-300 sm:text-xl">
                                        Touch the screen to start your
                                        photobooth session
                                    </p>
                                </div>

                                {isUnderMaintenance && (
                                    <p
                                        data-testid="kiosk-maintenance-message"
                                        className="max-w-md rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 sm:text-base"
                                    >
                                        {activeMaintenanceMessage}
                                    </p>
                                )}

                                <Button
                                    type="button"
                                    size="lg"
                                    disabled={isResuming || isUnderMaintenance}
                                    onClick={async () => {
                                        if (isResuming || isUnderMaintenance) {
                                            return;
                                        }

                                        if (!session) {
                                            const result =
                                                await startSession();

                                            if (!result.ok) {
                                                if (result.maintenance) {
                                                    setIsUnderMaintenance(
                                                        true,
                                                    );
                                                    setActiveMaintenanceMessage(
                                                        result.message,
                                                    );
                                                }

                                                return;
                                            }
                                        }

                                        resetTimer();
                                    }}
                                    className="h-16 w-full max-w-md rounded-2xl text-xl font-semibold shadow-lg sm:h-24 sm:text-2xl"
                                >
                                    Click to Start
                                </Button>

                                <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        disabled={
                                            isResuming || isUnderMaintenance
                                        }
                                        onClick={() => beginStep('pay-via-qr')}
                                        className="h-16 gap-3 rounded-xl border-white/20 bg-white/5 text-base text-white hover:bg-white/10 sm:h-20 sm:text-lg"
                                    >
                                        <QrCode
                                            className="size-6"
                                            aria-hidden="true"
                                        />
                                        Pay via QR
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        disabled={
                                            isResuming || isUnderMaintenance
                                        }
                                        onClick={() =>
                                            beginStep('enter-voucher')
                                        }
                                        className="h-16 gap-3 rounded-xl border-white/20 bg-white/5 text-base text-white hover:bg-white/10 sm:h-20 sm:text-lg"
                                    >
                                        <Ticket
                                            className="size-6"
                                            aria-hidden="true"
                                        />
                                        Enter Voucher
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeStep === 'pay-via-qr' && (
                            <div
                                data-testid="kiosk-pay-via-qr"
                                className="flex w-full max-w-md flex-col items-center gap-4 text-center sm:gap-6"
                            >
                                <QrCode
                                    className="size-12 sm:size-16"
                                    aria-hidden="true"
                                />
                                <h2 className="text-2xl font-semibold sm:text-3xl">
                                    Pay via QR
                                </h2>
                                <p className="text-sm text-neutral-300 sm:text-base">
                                    Scan the QR code to complete your payment.
                                    This screen will reset automatically if left
                                    idle.
                                </p>
                                {checkoutUrl && (
                                    <a
                                        data-testid="kiosk-payment-checkout-link"
                                        href={checkoutUrl}
                                        className="text-sm text-blue-300 underline"
                                    >
                                        Open Payment Page
                                    </a>
                                )}
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="lg"
                                    onClick={startOver}
                                >
                                    Back to Start
                                </Button>
                            </div>
                        )}

                        {activeStep === 'enter-voucher' && (
                            <div
                                data-testid="kiosk-enter-voucher"
                                className="flex w-full max-w-md flex-col items-center gap-4 text-center sm:gap-6"
                            >
                                <Ticket
                                    className="size-12 sm:size-16"
                                    aria-hidden="true"
                                />
                                <h2 className="text-2xl font-semibold sm:text-3xl">
                                    Enter Voucher
                                </h2>
                                <p className="text-sm text-neutral-300 sm:text-base">
                                    Enter your voucher code to redeem a session.
                                    This screen will reset automatically if left
                                    idle.
                                </p>
                                <form
                                    onSubmit={submitVoucher}
                                    className="flex w-full flex-col items-center gap-3"
                                >
                                    <Input
                                        data-testid="kiosk-voucher-input"
                                        value={voucherCode}
                                        onChange={(event) => {
                                            setVoucherCode(event.target.value);
                                        }}
                                        placeholder="Voucher code"
                                        autoComplete="off"
                                        className="h-12 text-center text-lg text-white"
                                    />
                                    <Button
                                        type="submit"
                                        size="lg"
                                        disabled={
                                            isRedeemingVoucher ||
                                            voucherCode.trim().length === 0
                                        }
                                        className="h-12 w-full"
                                    >
                                        Redeem Voucher
                                    </Button>
                                </form>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="lg"
                                    onClick={startOver}
                                >
                                    Back to Start
                                </Button>
                            </div>
                        )}

                        {activeStep === 'select-template' && (
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
                        )}

                        {activeStep === 'capture' && (
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
                                    setStep('captured');
                                    resetTimer();
                                }}
                            />
                        )}

                        {activeStep === 'captured' && (
                            <div
                                data-testid="kiosk-captured"
                                className="flex w-full max-w-2xl flex-col items-center gap-4 text-center sm:gap-6"
                            >
                                <h2 className="text-2xl font-semibold sm:text-3xl">
                                    All Shots Captured
                                </h2>
                                <p className="text-sm text-neutral-300 sm:text-base">
                                    Great shots! Choose a sticker and preview
                                    your photos next.
                                </p>
                                <div className="grid w-full grid-cols-3 gap-2">
                                    {capturedPhotos.map((photo, index) => (
                                        <img
                                            key={index}
                                            src={photo}
                                            alt={`Captured shot ${index + 1}`}
                                            className="aspect-video w-full rounded-lg object-cover"
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        onClick={startOver}
                                    >
                                        Back to Start
                                    </Button>
                                    <Button
                                        type="button"
                                        size="lg"
                                        onClick={() => {
                                            setStep('select-sticker');
                                            resetTimer();
                                        }}
                                    >
                                        Choose a Sticker
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeStep === 'select-sticker' && (
                            <StickerSelectionStep
                                fetchStickers={fetchStickers}
                                selectSticker={selectSticker}
                                templatePreviewPath={
                                    selectedTemplate?.thumbnailPath ?? null
                                }
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
                        )}

                        {activeStep === 'preview' && selectedTemplate && (
                            <PreviewStep
                                capturedPhotos={capturedPhotos}
                                template={selectedTemplate}
                                sticker={selectedSticker}
                                confirmPreview={confirmPreview}
                                onActivity={resetTimer}
                                onRetakePhotos={() => {
                                    setCapturedPhotos([]);
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
                        )}

                        {activeStep === 'processing' && (
                            <div
                                data-testid="kiosk-processing"
                                className="flex w-full max-w-2xl flex-col items-center gap-4 text-center sm:gap-6"
                            >
                                <h2 className="text-2xl font-semibold sm:text-3xl">
                                    Processing Your Photos
                                </h2>
                                <p className="text-sm text-neutral-300 sm:text-base">
                                    Your final print is being prepared. This
                                    screen will reset automatically if left
                                    idle.
                                </p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="lg"
                                    onClick={startOver}
                                >
                                    Back to Start
                                </Button>
                            </div>
                        )}

                        {activeStep === 'complete' && galleryToken && (
                            <div
                                data-testid="kiosk-complete"
                                className="flex w-full max-w-md flex-col items-center gap-4 text-center sm:gap-6"
                            >
                                <h2 className="text-2xl font-semibold sm:text-3xl">
                                    All Done!
                                </h2>
                                <p className="text-sm text-neutral-300 sm:text-base">
                                    Scan the QR code with your phone to open
                                    your photo gallery on another device.
                                </p>
                                <img
                                    data-testid="kiosk-gallery-qr-code"
                                    src={galleryQrCode.url(galleryToken)}
                                    alt="QR code linking to your photo gallery"
                                    className="h-64 w-64 rounded-xl bg-white p-4 shadow-lg"
                                />
                                {printFailed && (
                                    <KioskErrorState
                                        kind="print-failure"
                                        onBackToStart={startOver}
                                    />
                                )}
                                <Button
                                    type="button"
                                    size="lg"
                                    onClick={startOver}
                                >
                                    Start a New Session
                                </Button>
                            </div>
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
                        className="absolute inset-0 flex animate-pulse cursor-pointer flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center sm:gap-4"
                    >
                        <p className="text-2xl font-bold sm:text-4xl">
                            Tap Anywhere to Start
                        </p>
                        <p className="text-sm text-neutral-400 sm:text-base">
                            Free photobooth session available now
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
