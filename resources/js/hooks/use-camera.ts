import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorReason =
    'permission-denied' | 'not-found' | 'in-use' | 'disconnected' | 'unknown';

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

const listVideoInputDevices = async (): Promise<MediaDeviceInfo[]> => {
    const allDevices = await navigator.mediaDevices.enumerateDevices();

    return allDevices.filter((device) => device.kind === 'videoinput');
};

const buildVideoConstraints = (deviceId?: string): MediaTrackConstraints => ({
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'user' } }),
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: { ideal: 16 / 9 },
});

const buildRelaxedVideoConstraints = (
    deviceId?: string,
): MediaTrackConstraints | boolean => (deviceId ? { deviceId } : true);

/**
 * Wraps navigator.mediaDevices.getUserMedia for a live camera preview,
 * exposing the active stream and any permission/device error, while
 * guaranteeing every track is stopped when the caller stops or unmounts.
 *
 * Also enumerates available cameras (once permission has been granted, since
 * browsers redact device labels until then) and lets the caller switch the
 * active camera by deviceId. If the currently selected camera disconnects,
 * it falls back to another available camera or surfaces a 'disconnected'
 * error when none remain.
 */
export function useCamera() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<CameraErrorReason | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
        null,
    );
    const streamRef = useRef<MediaStream | null>(null);
    const hasPermissionRef = useRef(false);
    const selectedDeviceIdRef = useRef<string | null>(null);

    const stop = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
    }, []);

    const start = useCallback(async (deviceId?: string) => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
            setError('unknown');

            return;
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
        setIsStarting(true);
        setError(null);

        try {
            let mediaStream: MediaStream;

            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: buildVideoConstraints(deviceId),
                });
            } catch (constraintError) {
                if (
                    !(constraintError instanceof DOMException) ||
                    constraintError.name !== 'OverconstrainedError'
                ) {
                    throw constraintError;
                }

                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: buildRelaxedVideoConstraints(deviceId),
                });
            }

            streamRef.current = mediaStream;
            setStream(mediaStream);
            hasPermissionRef.current = true;

            const activeDeviceId =
                mediaStream.getVideoTracks()[0]?.getSettings().deviceId ??
                deviceId ??
                null;
            selectedDeviceIdRef.current = activeDeviceId;
            setSelectedDeviceId(activeDeviceId);

            const videoInputDevices = await listVideoInputDevices();
            setDevices(videoInputDevices);
        } catch (caughtError) {
            setError(resolveErrorReason(caughtError));
        } finally {
            setIsStarting(false);
        }
    }, []);

    const selectDevice = useCallback(
        (deviceId: string) => {
            void start(deviceId);
        },
        [start],
    );

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
            return;
        }

        const handleDeviceChange = async () => {
            if (!hasPermissionRef.current) {
                return;
            }

            const videoInputDevices = await listVideoInputDevices();
            setDevices(videoInputDevices);

            const currentDeviceId = selectedDeviceIdRef.current;
            const stillAvailable = videoInputDevices.some(
                (device) => device.deviceId === currentDeviceId,
            );

            if (stillAvailable) {
                return;
            }

            const fallbackDevice = videoInputDevices[0];

            if (fallbackDevice) {
                void start(fallbackDevice.deviceId);

                return;
            }

            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            selectedDeviceIdRef.current = null;
            setStream(null);
            setSelectedDeviceId(null);
            setError('disconnected');
        };

        navigator.mediaDevices.addEventListener(
            'devicechange',
            handleDeviceChange,
        );

        return () => {
            navigator.mediaDevices.removeEventListener(
                'devicechange',
                handleDeviceChange,
            );
        };
    }, [start]);

    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    return {
        stream,
        error,
        isStarting,
        devices,
        selectedDeviceId,
        start,
        stop,
        selectDevice,
    };
}
