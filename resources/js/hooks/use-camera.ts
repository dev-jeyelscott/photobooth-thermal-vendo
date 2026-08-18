import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorReason =
    | 'permission-denied'
    | 'not-found'
    | 'in-use'
    | 'unknown';

const resolveErrorReason = (error: unknown): CameraErrorReason => {
    if (!(error instanceof DOMException)) {
        return 'unknown';
    }

    switch (error.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'permission-denied';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'not-found';
        case 'NotReadableError':
        case 'TrackStartError':
            return 'in-use';
        default:
            return 'unknown';
    }
};

/**
 * Wraps navigator.mediaDevices.getUserMedia for a live camera preview,
 * exposing the active stream and any permission/device error, while
 * guaranteeing every track is stopped when the caller stops or unmounts.
 */
export function useCamera() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<CameraErrorReason | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);

    const stop = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
    }, []);

    const start = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
            setError('unknown');

            return;
        }

        stop();
        setIsStarting(true);
        setError(null);

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
            });

            streamRef.current = mediaStream;
            setStream(mediaStream);
        } catch (caughtError) {
            setError(resolveErrorReason(caughtError));
        } finally {
            setIsStarting(false);
        }
    }, [stop]);

    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    return { stream, error, isStarting, start, stop };
}
