import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCamera } from '@/hooks/use-camera';

const makeStream = () =>
    ({
        getTracks: () => [],
        getVideoTracks: () => [
            { getSettings: () => ({ deviceId: 'device-1' }) },
        ],
    }) as unknown as MediaStream;

describe('useCamera', () => {
    let getUserMedia: ReturnType<typeof vi.fn>;
    let enumerateDevices: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        getUserMedia = vi.fn();
        enumerateDevices = vi.fn().mockResolvedValue([]);

        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: {
                getUserMedia,
                enumerateDevices,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('requests an ideal facingMode and resolution without exact constraints', async () => {
        getUserMedia.mockResolvedValue(makeStream());

        const { result } = renderHook(() => useCamera());

        await act(async () => {
            await result.current.start();
        });

        const [{ video }] = getUserMedia.mock.calls[0];

        expect(video.facingMode).toEqual({ ideal: 'user' });
        expect(video.width).toEqual({ ideal: 1280 });
        expect(video.deviceId).toBeUndefined();
        expect(result.current.error).toBeNull();
    });

    it('retries with relaxed constraints on OverconstrainedError and succeeds', async () => {
        getUserMedia
            .mockRejectedValueOnce(
                new DOMException('constraints', 'OverconstrainedError'),
            )
            .mockResolvedValueOnce(makeStream());

        const { result } = renderHook(() => useCamera());

        await act(async () => {
            await result.current.start();
        });

        expect(getUserMedia).toHaveBeenCalledTimes(2);
        expect(getUserMedia.mock.calls[1][0]).toEqual({ video: true });
        expect(result.current.error).toBeNull();
        await waitFor(() => expect(result.current.stream).not.toBeNull());
    });

    it('surfaces not-found when the relaxed retry also fails', async () => {
        getUserMedia
            .mockRejectedValueOnce(
                new DOMException('constraints', 'OverconstrainedError'),
            )
            .mockRejectedValueOnce(
                new DOMException('constraints', 'OverconstrainedError'),
            );

        const { result } = renderHook(() => useCamera());

        await act(async () => {
            await result.current.start();
        });

        expect(getUserMedia).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBe('not-found');
    });

    it('does not retry on non-constraint errors', async () => {
        getUserMedia.mockRejectedValue(
            new DOMException('denied', 'NotAllowedError'),
        );

        const { result } = renderHook(() => useCamera());

        await act(async () => {
            await result.current.start();
        });

        expect(getUserMedia).toHaveBeenCalledTimes(1);
        expect(result.current.error).toBe('permission-denied');
    });
});
