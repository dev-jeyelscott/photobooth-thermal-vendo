import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureStep } from '@/components/capture-step';

const makeTrack = () => {
    const listeners: Record<string, (() => void)[]> = {};

    return {
        getSettings: () => ({ deviceId: 'device-1' }),
        stop: vi.fn(),
        addEventListener: vi.fn((event: string, handler: () => void) => {
            listeners[event] = [...(listeners[event] ?? []), handler];
        }),
        removeEventListener: vi.fn((event: string, handler: () => void) => {
            listeners[event] = (listeners[event] ?? []).filter(
                (existing) => existing !== handler,
            );
        }),
        dispatchEnded: () => {
            listeners['ended']?.forEach((handler) => handler());
        },
    };
};

const makeStream = (track: ReturnType<typeof makeTrack>) =>
    ({
        getTracks: () => [track],
        getVideoTracks: () => [track],
    }) as unknown as MediaStream;

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

describe('CaptureStep camera stream loss recovery', () => {
    let getUserMedia: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        getUserMedia = vi.fn();

        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
                getUserMedia,
                enumerateDevices: vi.fn().mockResolvedValue([
                    {
                        deviceId: 'device-1',
                        kind: 'videoinput',
                        label: 'Camera 1',
                    },
                ]),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('surfaces camera-stream-lost when the active track ends and preserves captured shots on reconnect', async () => {
        const firstTrack = makeTrack();
        getUserMedia.mockResolvedValueOnce(makeStream(firstTrack));

        const onComplete = vi.fn();
        render(<CaptureStep {...captureStepProps} onComplete={onComplete} />);

        await act(async () => {
            await Promise.resolve();
        });
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

        // The active track ends while the device stays enumerated (e.g. the
        // OS/driver terminated the stream), not a devicechange/unplug event.
        const secondTrack = makeTrack();
        getUserMedia.mockResolvedValueOnce(makeStream(secondTrack));

        await act(async () => {
            firstTrack.dispatchEnded();
        });

        expect(
            screen.getByTestId('kiosk-error-camera-stream-lost'),
        ).toBeInTheDocument();
        expect(screen.getByText('Shot 2 of 2')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Reconnect Camera' }),
            );
        });

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
});
