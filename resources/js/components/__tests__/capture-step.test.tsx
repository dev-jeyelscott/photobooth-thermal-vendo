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
            onComplete: (photos: string[]) => void;
            onActivity: () => void;
        }> = {},
    ) => {
        const onComplete = overrides.onComplete ?? vi.fn();
        const onActivity = overrides.onActivity ?? vi.fn();

        render(
            <CaptureStep
                shotCount={overrides.shotCount ?? 2}
                retakeLimit={overrides.retakeLimit ?? 1}
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

        return { onComplete, onActivity };
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
        const { onComplete } = renderCaptureStep({ shotCount: 1 });

        await advanceCountdown();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
        });

        expect(onComplete).toHaveBeenCalledWith([
            'data:image/jpeg;base64,mock',
        ]);
    });
});
