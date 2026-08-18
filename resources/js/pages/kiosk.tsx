import { Head } from '@inertiajs/react';
import { QrCode, Ticket } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIdleTimer } from '@/hooks/use-idle-timer';
import { usePhotoboothSession } from '@/hooks/use-photobooth-session';

type KioskStep = 'welcome' | 'pay-via-qr' | 'enter-voucher';

const DEFAULT_IDLE_TIMEOUT_SECONDS = 60;

export default function Kiosk({
    idleTimeoutSeconds = DEFAULT_IDLE_TIMEOUT_SECONDS,
}: {
    idleTimeoutSeconds?: number;
}) {
    const [step, setStep] = useState<KioskStep>('welcome');
    const [voucherCode, setVoucherCode] = useState('');
    const [voucherError, setVoucherError] = useState<string | null>(null);
    const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);
    const { isIdle, resetTimer } = useIdleTimer(idleTimeoutSeconds * 1000);
    const { session, startSession, isResuming, redeemVoucher } =
        usePhotoboothSession();

    // Abandoned sessions reset back to the start screen once the customer goes idle.
    const activeStep = isIdle ? 'welcome' : step;

    const startOver = () => {
        setStep('welcome');
        setVoucherCode('');
        setVoucherError(null);
        resetTimer();
    };

    const submitVoucher = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isRedeemingVoucher) {
            return;
        }

        setIsRedeemingVoucher(true);
        setVoucherError(null);

        const result = await redeemVoucher(voucherCode.trim());

        setIsRedeemingVoucher(false);

        if (!result.ok) {
            setVoucherError(result.message);

            return;
        }

        resetTimer();
    };

    const beginStep = async (next: KioskStep) => {
        if (isResuming) {
            return;
        }

        if (!session) {
            await startSession();
        }

        setStep(next);
        resetTimer();
    };

    return (
        <>
            <Head title="Photobooth Kiosk" />
            <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-neutral-950 to-neutral-900 p-4 text-white select-none sm:p-6">
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
                                Touch the screen to start your photobooth
                                session
                            </p>
                        </div>

                        <Button
                            type="button"
                            size="lg"
                            disabled={isResuming}
                            onClick={async () => {
                                if (isResuming) {
                                    return;
                                }

                                if (!session) {
                                    await startSession();
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
                                disabled={isResuming}
                                onClick={() => beginStep('pay-via-qr')}
                                className="h-16 gap-3 rounded-xl border-white/20 bg-white/5 text-base text-white hover:bg-white/10 sm:h-20 sm:text-lg"
                            >
                                <QrCode className="size-6" aria-hidden="true" />
                                Pay via QR
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                disabled={isResuming}
                                onClick={() => beginStep('enter-voucher')}
                                className="h-16 gap-3 rounded-xl border-white/20 bg-white/5 text-base text-white hover:bg-white/10 sm:h-20 sm:text-lg"
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
                            Enter your voucher code to redeem a session. This
                            screen will reset automatically if left idle.
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
                                    setVoucherError(null);
                                }}
                                placeholder="Voucher code"
                                autoComplete="off"
                                className="h-12 text-center text-lg text-white"
                            />
                            {voucherError && (
                                <p
                                    role="alert"
                                    data-testid="kiosk-voucher-error"
                                    className="text-sm text-red-400"
                                >
                                    {voucherError}
                                </p>
                            )}
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
