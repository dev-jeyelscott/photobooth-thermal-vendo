import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraPreview } from '@/components/camera-preview';
import { Button } from '@/components/ui/button';

const DEFAULT_COUNTDOWN_SECONDS = 3;
const AUTO_ADVANCE_SECONDS = 4;

type CapturePhase = 'countdown' | 'review';

/**
 * Drives the sequential photo capture flow: a 3-2-1 countdown, grabbing a
 * frame from the live camera stream onto an off-screen canvas, and a review
 * screen with a bounded retake option. When the customer doesn't retake, the
 * flow automatically keeps the shot and advances once shotCount is reached.
 */
export function CaptureStep({
    shotCount,
    retakeLimit,
    countdownSeconds = DEFAULT_COUNTDOWN_SECONDS,
    onComplete,
    onActivity,
    onExit,
}: {
    shotCount: number;
    retakeLimit: number;
    countdownSeconds?: number;
    onComplete: (photos: string[]) => void;
    onActivity: () => void;
    onExit?: () => void;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [shots, setShots] = useState<string[]>([]);
    const [phase, setPhase] = useState<CapturePhase>('countdown');
    const [countdown, setCountdown] = useState(countdownSeconds);
    const [retakesRemaining, setRetakesRemaining] = useState(retakeLimit);
    const [currentShot, setCurrentShot] = useState<string | null>(null);
    const [autoAdvanceIn, setAutoAdvanceIn] = useState<number | null>(null);

    const capture = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || video.videoWidth === 0) {
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas
            .getContext('2d')
            ?.drawImage(video, 0, 0, canvas.width, canvas.height);

        setCurrentShot(canvas.toDataURL('image/jpeg', 0.92));
        setAutoAdvanceIn(AUTO_ADVANCE_SECONDS);
        setPhase('review');
    }, []);

    // Ticks the countdown while in the countdown phase, capturing a frame at zero.
    useEffect(() => {
        if (phase !== 'countdown') {
            return;
        }

        const interval = setInterval(() => {
            setCountdown((remaining) => {
                if (remaining <= 1) {
                    clearInterval(interval);
                    capture();

                    return remaining;
                }

                return remaining - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [phase, shots.length, capture]);

    const keepShot = useCallback(() => {
        setCurrentShot((shot) => {
            if (!shot) {
                return shot;
            }

            setShots((previousShots) => {
                const nextShots = [...previousShots, shot];

                if (nextShots.length >= shotCount) {
                    onComplete(nextShots);
                } else {
                    setRetakesRemaining(retakeLimit);
                    setCountdown(countdownSeconds);
                    setPhase('countdown');
                }

                return nextShots;
            });

            return null;
        });

        onActivity();
    }, [shotCount, retakeLimit, countdownSeconds, onComplete, onActivity]);

    const retakeShot = useCallback(() => {
        setRetakesRemaining((remaining) => {
            if (remaining <= 0) {
                return remaining;
            }

            setCurrentShot(null);
            setCountdown(countdownSeconds);
            setPhase('countdown');
            onActivity();

            return remaining - 1;
        });
    }, [countdownSeconds, onActivity]);

    // Ticks the auto-advance countdown while reviewing a shot, keeping it once it reaches zero.
    useEffect(() => {
        if (phase !== 'review') {
            return;
        }

        const interval = setInterval(() => {
            setAutoAdvanceIn((remaining) => {
                if (remaining === null || remaining <= 1) {
                    clearInterval(interval);
                    keepShot();

                    return null;
                }

                return remaining - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [phase, keepShot]);

    return (
        <div
            data-testid="kiosk-capture"
            className="flex w-full max-w-2xl flex-col items-center gap-4 text-center sm:gap-6"
        >
            <h2 className="text-2xl font-semibold sm:text-3xl">
                Shot {shots.length + 1} of {shotCount}
            </h2>

            <div className="relative w-full">
                <CameraPreview videoRef={videoRef} onBackToStart={onExit} />

                {phase === 'countdown' && (
                    <div
                        data-testid="kiosk-capture-countdown"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                        <span
                            key={countdown}
                            className="animate-ping text-7xl font-bold text-white drop-shadow-lg sm:text-9xl"
                        >
                            {countdown}
                        </span>
                    </div>
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {phase === 'review' && currentShot && (
                <div
                    data-testid="kiosk-capture-review"
                    className="flex w-full flex-col items-center gap-3"
                >
                    <img
                        src={currentShot}
                        alt={`Captured shot ${shots.length + 1}`}
                        className="aspect-video w-full rounded-xl object-cover"
                    />
                    <p className="text-sm text-neutral-300">
                        {retakesRemaining > 0
                            ? `Retakes remaining: ${retakesRemaining}`
                            : 'No retakes remaining.'}
                        {autoAdvanceIn !== null &&
                            ` · Continuing in ${autoAdvanceIn}s`}
                    </p>
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={retakesRemaining <= 0}
                            onClick={retakeShot}
                        >
                            Retake
                        </Button>
                        <Button type="button" onClick={keepShot}>
                            {shots.length + 1 >= shotCount
                                ? 'Finish'
                                : 'Keep & Continue'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
