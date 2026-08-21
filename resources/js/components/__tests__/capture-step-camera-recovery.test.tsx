import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureStep } from '@/components/capture-step';
import type { CameraErrorReason } from '@/hooks/use-camera';

const makeStream = () => ({}) as MediaStream;
const makeDevice = (deviceId: string) =>
    ({ deviceId, label: `Camera ${deviceId}`, kind: 'videoinput' }) as MediaDeviceInfo;

let hookState: {
    stream: MediaStream | null;
    error: CameraErrorReason | null;
    devices: MediaDeviceInfo[];
    selectedDeviceId: string | null;
};

const start = vi.fn(() => {
    hookState = { ...hookState, error: null, stream: makeStream() };
});
const stop = vi.fn();
const selectDevice = vi.fn();

vi.mock('@/hooks/use-camera', () => ({
    useCamera: () => ({
        stream: hookState.stream,
        error: hookState.error,
        devices: hookState.devices,
        selectedDeviceId: hookState.selectedDeviceId,
        start,
        stop,
        selectDevice,
    }),
}));

const setVideoDimensions = () => {
    const video = screen.getByTestId('camera-preview-video');
    Object.defineProperty(video, 'videoWidth', {
        value: 640,
        configurable: true,
    });
    Object.defineProperty(video, 'videoHeight', {
        value: 480,
        configurable: true,
    });
};

const captureStepProps = {
    shotCount: 2,
    retakeLimit: 1,
    countdownSeconds: 1,
    onActivity: vi.fn(),
};

describe('CaptureStep camera error recovery', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        hookState = {
            stream: makeStream(),
            error: null,
            devices: [makeDevice('d1')],
            selectedDeviceId: 'd1',
        };
        start.mockClear();
        stop.mockClear();
        selectDevice.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('keeps already-captured shots across a transient camera error and recovery', async () => {
        const onComplete = vi.fn();

        const { rerender } = render(
            <CaptureStep {...captureStepProps} onComplete={onComplete} />,
        );
        const rerenderCaptureStep = () =>
            rerender(
                <CaptureStep {...captureStepProps} onComplete={onComplete} />,
            );

        setVideoDimensions();
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Keep & Continue' }),
            );
        });

        expect(screen.getByText('Shot 2 of 2')).toBeInTheDocument();

        // Camera drops mid-sequence (e.g. transiently in-use elsewhere).
        hookState = { ...hookState, error: 'in-use', stream: null };
        rerenderCaptureStep();

        expect(
            screen.getByTestId('kiosk-error-camera-unavailable'),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Back to Start' }),
        ).not.toBeInTheDocument();
        expect(screen.getByText('Shot 2 of 2')).toBeInTheDocument();

        // Customer retries and the camera reconnects without CaptureStep unmounting.
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
        });
        rerenderCaptureStep();

        expect(screen.getByTestId('camera-preview-video')).toBeInTheDocument();
        setVideoDimensions();

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete.mock.calls[0][0]).toHaveLength(2);
    });

    it('only offers Back to Start when the camera disconnects with no devices left', () => {
        hookState = {
            stream: null,
            error: 'disconnected',
            devices: [],
            selectedDeviceId: null,
        };

        render(
            <CaptureStep
                {...captureStepProps}
                onComplete={vi.fn()}
                onExit={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Back to Start' }),
        ).toBeInTheDocument();
    });
});
