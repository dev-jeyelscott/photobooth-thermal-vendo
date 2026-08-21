import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureStep } from '@/components/capture-step';

vi.mock('@/components/camera-preview', () => ({
    CameraPreview: ({
        videoRef,
    }: {
        videoRef: React.RefObject<HTMLVideoElement | null>;
    }) => <video data-testid="capture-video" ref={videoRef} />,
}));

const advanceCountdown = async () => {
    await act(async () => {
        vi.advanceTimersByTime(3000);
    });
};

describe('CaptureStep', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderCaptureStep = (
        overrides: Partial<{
            shotCount: number;
            retakeLimit: number;
            countdownSeconds: number;
            uploadShot: (dataUrl: string) => Promise<string | null>;
            onComplete: (
                photos: string[],
                photoPaths: (string | null)[],
            ) => void;
            onActivity: () => void;
        }> = {},
    ) => {
        const uploadShot =
            overrides.uploadShot ?? vi.fn().mockResolvedValue(null);
        const onComplete = overrides.onComplete ?? vi.fn();
        const onActivity = overrides.onActivity ?? vi.fn();

        render(
            <CaptureStep
                shotCount={overrides.shotCount ?? 2}
                retakeLimit={overrides.retakeLimit ?? 1}
                countdownSeconds={overrides.countdownSeconds}
                uploadShot={uploadShot}
                onComplete={onComplete}
                onActivity={onActivity}
            />,
        );

        Object.defineProperty(
            screen.getByTestId('capture-video'),
            'videoWidth',
            { value: 640, configurable: true },
        );
        Object.defineProperty(
            screen.getByTestId('capture-video'),
            'videoHeight',
            { value: 480, configurable: true },
        );

        return { uploadShot, onComplete, onActivity };
    };

    it('runs the countdown and captures a shot for review', async () => {
        renderCaptureStep();

        expect(
            screen.getByTestId('kiosk-capture-countdown'),
        ).toBeInTheDocument();

        await advanceCountdown();

        expect(screen.getByTestId('kiosk-capture-review')).toBeInTheDocument();
    });

    it('allows retaking a shot up to the retake limit', async () => {
        renderCaptureStep({ retakeLimit: 1 });

        await advanceCountdown();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
        });

        expect(
            screen.getByTestId('kiosk-capture-countdown'),
        ).toBeInTheDocument();

        await advanceCountdown();

        expect(screen.getByRole('button', { name: 'Retake' })).toBeDisabled();
    });

    it('keeps a shot and calls onComplete once shotCount is reached', async () => {
        const uploadShot = vi.fn().mockResolvedValue('captures/token/shot.jpg');
        const { onComplete } = renderCaptureStep({
            shotCount: 1,
            uploadShot,
        });

        await advanceCountdown();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
        });

        expect(uploadShot).toHaveBeenCalledWith('data:image/jpeg;base64,mock');
        expect(onComplete).toHaveBeenCalledWith(
            ['data:image/jpeg;base64,mock'],
            ['captures/token/shot.jpg'],
        );
    });

    it('surfaces an upload failure and does not complete until a retry succeeds', async () => {
        const uploadShot = vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('captures/token/shot.jpg');
        const { onComplete } = renderCaptureStep({
            shotCount: 1,
            uploadShot,
        });

        await advanceCountdown();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
        });

        expect(uploadShot).toHaveBeenCalledTimes(1);
        expect(onComplete).not.toHaveBeenCalled();
        expect(
            screen.getByText(
                'Could not save this shot. Please retry the upload.',
            ),
        ).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Retry Upload' }),
            );
        });

        expect(uploadShot).toHaveBeenCalledTimes(2);
        expect(onComplete).toHaveBeenCalledWith(
            ['data:image/jpeg;base64,mock'],
            ['captures/token/shot.jpg'],
        );
    });

    it('uses the configured countdownSeconds instead of the default', async () => {
        renderCaptureStep({ countdownSeconds: 1 });

        expect(screen.getByText('1')).toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });

        expect(screen.getByTestId('kiosk-capture-review')).toBeInTheDocument();
    });
});
