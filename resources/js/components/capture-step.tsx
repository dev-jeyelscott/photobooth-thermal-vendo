import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraPreview } from '@/components/camera-preview';
import { Button } from '@/components/ui/button';

const DEFAULT_COUNTDOWN_SECONDS = 3;
const AUTO_ADVANCE_SECONDS = 4;

type CapturePhase = 'countdown' | 'review';

/**
 * Drives the sequential camera workflow while preserving full-resolution frame
 * capture, bounded retakes, backend shot uploads, and automatic advancement.
 */
export function CaptureStep({
    shotCount,
    retakeLimit,
    countdownSeconds = DEFAULT_COUNTDOWN_SECONDS,
    uploadShot,
    onComplete,
    onActivity,
    onExit,
}: {
    shotCount: number;
    retakeLimit: number;
    countdownSeconds?: number;
    /** Uploads a kept shot to the backend and returns its public-disk path. */
    uploadShot?: (dataUrl: string) => Promise<string | null>;
    onComplete: (photos: string[], photoPaths: (string | null)[]) => void;
    onActivity: () => void;
    onExit?: () => void;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [shots, setShots] = useState<string[]>([]);
    const [shotPaths, setShotPaths] = useState<(string | null)[]>([]);
    const [phase, setPhase] = useState<CapturePhase>('countdown');
    const [countdown, setCountdown] = useState(countdownSeconds);
    const [retakesRemaining, setRetakesRemaining] = useState(retakeLimit);
    const [currentShot, setCurrentShot] = useState<string | null>(null);
    const [autoAdvanceIn, setAutoAdvanceIn] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadFailed, setUploadFailed] = useState(false);

    /**
     * Captures the camera's native video frame into an off-screen canvas so
     * the higher-quality source, not a CSS-sized preview, becomes the shot.
     */
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

    // Ticks the configured countdown and captures the frame when it completes.
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

    /**
     * Persists the reviewed shot before it can count toward the required shot
     * total, retrying in place when the upload fails.
     */
    const keepShot = useCallback(async () => {
        if (!currentShot || isSaving) {
            return;
        }

        const shot = currentShot;
        setIsSaving(true);
        setUploadFailed(false);

        const path = uploadShot ? await uploadShot(shot) : null;

        if (uploadShot && path === null) {
            setIsSaving(false);
            setUploadFailed(true);
            setAutoAdvanceIn(null);

            return;
        }

        const nextShots = [...shots, shot];
        const nextShotPaths = [...shotPaths, path];

        setShots(nextShots);
        setShotPaths(nextShotPaths);
        setCurrentShot(null);
        setIsSaving(false);
        onActivity();

        if (nextShots.length >= shotCount) {
            onComplete(nextShots, nextShotPaths);

            return;
        }

        setRetakesRemaining(retakeLimit);
        setCountdown(countdownSeconds);
        setPhase('countdown');
    }, [
        currentShot,
        isSaving,
        shots,
        shotPaths,
        shotCount,
        retakeLimit,
        countdownSeconds,
        uploadShot,
        onComplete,
        onActivity,
    ]);

    /**
     * Re-enters countdown for the current shot while enforcing the configured
     * per-shot retake budget.
     */
    const retakeShot = useCallback(() => {
        if (isSaving) {
            return;
        }

        setRetakesRemaining((remaining) => {
            if (remaining <= 0) {
                return remaining;
            }

            setCurrentShot(null);
            setUploadFailed(false);
            setCountdown(countdownSeconds);
            setPhase('countdown');
            onActivity();

            return remaining - 1;
        });
    }, [isSaving, countdownSeconds, onActivity]);

    // Auto-keeps a reviewed shot unless upload recovery requires explicit action.
    useEffect(() => {
        if (phase !== 'review' || uploadFailed) {
            return;
        }

        const interval = setInterval(() => {
            setAutoAdvanceIn((remaining) => {
                if (remaining === null || remaining <= 1) {
                    clearInterval(interval);
                    void keepShot();

                    return null;
                }

                return remaining - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [phase, uploadFailed, keepShot]);

    const currentShotNumber = Math.min(shots.length + 1, shotCount);

    return (
        <div
            data-testid="kiosk-capture"
            className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.65fr)] lg:gap-10"
        >
            <div className="relative min-w-0">
                <CameraPreview videoRef={videoRef} onBackToStart={onExit} />

                <span className="pointer-events-none absolute top-4 right-4 z-30 rounded-full border border-neutral-700 bg-neutral-950/80 px-4 py-2 text-xs text-neutral-300 shadow-lg backdrop-blur sm:top-5 sm:right-5 sm:text-sm">
                    Shot {currentShotNumber} of {shotCount}
                </span>

                <span className="pointer-events-none absolute bottom-4 left-4 z-30 rounded-full border border-neutral-700 bg-neutral-950/80 px-4 py-2 text-xs text-neutral-300 shadow-lg backdrop-blur sm:bottom-5 sm:left-5 sm:text-sm">
                    Retakes available: {retakesRemaining}
                </span>

                {phase === 'countdown' && (
                    <div
                        data-testid="kiosk-capture-countdown"
                        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                    >
                        <span
                            key={countdown}
                            className="text-7xl font-semibold tracking-[-0.06em] text-white drop-shadow-2xl sm:text-8xl lg:text-9xl"
                        >
                            {countdown}
                        </span>
                    </div>
                )}

                {phase === 'review' && currentShot && (
                    <img
                        data-testid="kiosk-capture-review-image"
                        src={currentShot}
                        alt={`Captured shot ${currentShotNumber}`}
                        className="absolute inset-0 z-10 h-full w-full rounded-2xl object-cover"
                    />
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mx-auto w-full max-w-md lg:mx-0">
                <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                    Capture
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-neutral-50 lg:text-[2.8rem] lg:leading-[1.05]">
                    {phase === 'countdown'
                        ? 'Look at the camera'
                        : 'Review this shot'}
                </h2>
                <p className="mt-4 text-sm leading-6 text-neutral-400 sm:text-base">
                    {phase === 'countdown'
                        ? 'ThermaSnap counts down, captures a full-resolution frame, then gives you a brief review before the next shot.'
                        : 'Keep the shot to continue automatically, or use a bounded retake while one is still available.'}
                </p>

                <div className="mt-7 rounded-xl border border-neutral-800 p-5">
                    <p className="text-xs text-neutral-500">Next action</p>
                    <p className="mt-2 text-base font-semibold text-neutral-100 sm:text-lg">
                        {phase === 'countdown'
                            ? 'Automatic capture at zero'
                            : uploadFailed
                              ? 'Retry this shot upload'
                              : isSaving
                                ? 'Saving captured frame'
                                : 'Keep or retake this shot'}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-neutral-400">
                        {phase === 'countdown'
                            ? 'Keep the shot or use a bounded retake if enabled.'
                            : uploadFailed
                              ? 'The shot remains on screen and will not auto-advance until it is stored safely.'
                              : autoAdvanceIn !== null
                                ? `Continuing automatically in ${autoAdvanceIn}s.`
                                : 'The next shot starts after this frame is saved.'}
                    </p>
                </div>

                {phase === 'review' && currentShot && (
                    <div
                        data-testid="kiosk-capture-review"
                        className="mt-5 space-y-4"
                    >
                        {uploadFailed && (
                            <p className="rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                                Could not save this shot. Please retry the
                                upload.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                disabled={retakesRemaining <= 0 || isSaving}
                                onClick={retakeShot}
                                className="min-h-12 border-neutral-800 bg-neutral-950 px-6 text-neutral-100 hover:bg-neutral-900 hover:text-white"
                            >
                                Retake
                            </Button>
                            <Button
                                type="button"
                                size="lg"
                                disabled={isSaving}
                                onClick={() => void keepShot()}
                                className="min-h-12 bg-neutral-100 px-6 text-neutral-950 hover:bg-white"
                            >
                                {uploadFailed
                                    ? 'Retry Upload'
                                    : isSaving
                                      ? 'Saving…'
                                      : shots.length + 1 >= shotCount
                                        ? 'Finish'
                                        : 'Keep & Continue'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
