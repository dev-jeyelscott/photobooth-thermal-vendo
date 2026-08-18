import { Head } from '@inertiajs/react';
import { QrCode, Ticket } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useIdleTimer } from '@/hooks/use-idle-timer';

type KioskStep = 'welcome' | 'pay-via-qr' | 'enter-voucher';

const DEFAULT_IDLE_TIMEOUT_SECONDS = 60;

export default function Kiosk({
    idleTimeoutSeconds = DEFAULT_IDLE_TIMEOUT_SECONDS,
}: {
    idleTimeoutSeconds?: number;
}) {
    const [step, setStep] = useState<KioskStep>('welcome');
    const { isIdle, resetTimer } = useIdleTimer(idleTimeoutSeconds * 1000);

    // Abandoned sessions reset back to the start screen once the customer goes idle.
    const activeStep = isIdle ? 'welcome' : step;

    const startOver = () => {
        setStep('welcome');
        resetTimer();
    };

    return (
        <>
            <Head title="Photobooth Kiosk" />
            <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-950 to-neutral-900 p-6 text-white select-none">
                {activeStep === 'welcome' && (
                    <div
                        data-testid="kiosk-welcome"
                        className="flex w-full max-w-3xl flex-col items-center gap-10 text-center"
                    >
                        <div className="space-y-3">
                            <p className="text-lg font-medium tracking-wide text-neutral-400 uppercase">
                                Photobooth
                            </p>
                            <h1 className="text-5xl font-bold sm:text-6xl">
                                Tap to Begin
                            </h1>
                            <p className="text-xl text-neutral-300">
                                Touch the screen to start your photobooth
                                session
                            </p>
                        </div>

                        <Button
                            type="button"
                            size="lg"
                            onClick={startOver}
                            className="h-24 w-full max-w-md rounded-2xl text-2xl font-semibold shadow-lg"
                        >
                            Click to Start
                        </Button>

                        <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={() => {
                                    setStep('pay-via-qr');
                                    resetTimer();
                                }}
                                className="h-20 gap-3 rounded-xl border-white/20 bg-white/5 text-lg text-white hover:bg-white/10"
                            >
                                <QrCode className="size-6" aria-hidden="true" />
                                Pay via QR
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={() => {
                                    setStep('enter-voucher');
                                    resetTimer();
                                }}
                                className="h-20 gap-3 rounded-xl border-white/20 bg-white/5 text-lg text-white hover:bg-white/10"
                            >
                                <Ticket className="size-6" aria-hidden="true" />
                                Enter Voucher
                            </Button>
                        </div>
                    </div>
                )}

                {activeStep === 'pay-via-qr' && (
                    <div
                        data-testid="kiosk-pay-via-qr"
                        className="flex w-full max-w-md flex-col items-center gap-6 text-center"
                    >
                        <QrCode className="size-16" aria-hidden="true" />
                        <h2 className="text-3xl font-semibold">Pay via QR</h2>
                        <p className="text-neutral-300">
                            Scan the QR code to complete your payment. This
                            screen will reset automatically if left idle.
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

                {activeStep === 'enter-voucher' && (
                    <div
                        data-testid="kiosk-enter-voucher"
                        className="flex w-full max-w-md flex-col items-center gap-6 text-center"
                    >
                        <Ticket className="size-16" aria-hidden="true" />
                        <h2 className="text-3xl font-semibold">
                            Enter Voucher
                        </h2>
                        <p className="text-neutral-300">
                            Enter your voucher code to redeem a session. This
                            screen will reset automatically if left idle.
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

                {isIdle && (
                    <div
                        data-testid="kiosk-idle-overlay"
                        role="button"
                        tabIndex={0}
                        onClick={resetTimer}
                        onKeyDown={resetTimer}
                        className="absolute inset-0 flex animate-pulse cursor-pointer flex-col items-center justify-center gap-4 bg-black/90 text-center"
                    >
                        <p className="text-4xl font-bold">
                            Tap Anywhere to Start
                        </p>
                        <p className="text-neutral-400">
                            Free photobooth session available now
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
