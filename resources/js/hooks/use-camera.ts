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
    facingMode: { ideal: 'user' },
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
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
    const handleTrackEndedRef = useRef<
        ((this: MediaStreamTrack, event: Event) => void) | null
    >(null);

    const detachTrackEndedListeners = useCallback(
        (mediaStream: MediaStream) => {
            if (!handleTrackEndedRef.current) {
                return;
            }

            mediaStream
                .getTracks()
                .forEach((track) =>
                    track.removeEventListener(
                        'ended',
                        handleTrackEndedRef.current!,
                    ),
                );
        },
        [],
    );

    const stop = useCallback(() => {
        if (streamRef.current) {
            detachTrackEndedListeners(streamRef.current);
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
    }, [detachTrackEndedListeners]);

    const start = useCallback(
        async (deviceId?: string) => {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
                setError('unknown');

                return;
            }

            if (streamRef.current) {
                detachTrackEndedListeners(streamRef.current);
                streamRef.current.getTracks().forEach((track) => track.stop());
            }

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

                if (handleTrackEndedRef.current) {
                    mediaStream
                        .getTracks()
                        .forEach((track) =>
                            track.addEventListener(
                                'ended',
                                handleTrackEndedRef.current!,
                            ),
                        );
                }
            } catch (caughtError) {
                setError(resolveErrorReason(caughtError));
            } finally {
                setIsStarting(false);
            }
        },
        [detachTrackEndedListeners],
    );

    const selectDevice = useCallback(
        (deviceId: string) => {
            void start(deviceId);
        },
        [start],
    );

    // Marks the active camera as disconnected without discarding any caller
    // state (e.g. already-captured shots): stops the dead stream, clears
    // selection, and surfaces a 'disconnected' error that Reconnect can retry.
    const markDisconnected = useCallback(() => {
        if (streamRef.current) {
            detachTrackEndedListeners(streamRef.current);
            streamRef.current.getTracks().forEach((track) => track.stop());
        }

        streamRef.current = null;
        selectedDeviceIdRef.current = null;
        setStream(null);
        setSelectedDeviceId(null);
        setError('disconnected');
    }, [detachTrackEndedListeners]);

    // An active track can end while its device remains enumerated (e.g. the
    // browser or camera driver terminates the stream). Unlike a devicechange
    // event, the device list can't tell us the stream is still usable, so
    // always surface 'disconnected' and let Reconnect retry in place.
    useEffect(() => {
        const handleTrackEnded = () => {
            markDisconnected();
        };

        handleTrackEndedRef.current = handleTrackEnded;

        return () => {
            handleTrackEndedRef.current = null;
        };
    }, [markDisconnected]);

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

            markDisconnected();
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
    }, [start, markDisconnected]);

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
