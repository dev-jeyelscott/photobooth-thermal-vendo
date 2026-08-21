import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { KioskErrorKind } from '@/components/kiosk-error-state';
import { KioskErrorState } from '@/components/kiosk-error-state';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { CameraErrorReason } from '@/hooks/use-camera';
import { useCamera } from '@/hooks/use-camera';

const cameraErrorKind = (reason: CameraErrorReason): KioskErrorKind =>
    reason === 'permission-denied'
        ? 'no-camera-permission'
        : 'camera-unavailable';

/**
 * Live camera preview backed by useCamera. Starts the stream on mount and
 * stops it on unmount so the camera light is released as soon as this step ends.
 * When more than one camera is available, a selector lets the customer pick
 * which one to use for the rest of the session.
 */
export function CameraPreview({
    videoRef: externalVideoRef,
    onBackToStart,
}: {
    /** Exposes the underlying <video> element to callers that need to capture frames from it. */
    videoRef?: RefObject<HTMLVideoElement | null>;
    onBackToStart?: () => void;
} = {}) {
    const {
        stream,
        error,
        devices,
        selectedDeviceId,
        start,
        stop,
        selectDevice,
    } = useCamera();
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    const videoRef = externalVideoRef ?? internalVideoRef;

    useEffect(() => {
        void start();

        return () => {
            stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, videoRef]);

    if (error) {
        // 'disconnected' is only set once the active camera drops with no
        // fallback device available (see useCamera's devicechange handler),
        // making it the sole unrecoverable case that should offer a full exit.
        const isUnrecoverable = error === 'disconnected';

        return (
            <KioskErrorState
                kind={cameraErrorKind(error)}
                onRetry={() => start()}
                onBackToStart={isUnrecoverable ? onBackToStart : undefined}
            />
        );
    }

    return (
        <div className="flex w-full flex-col items-center gap-3">
            <video
                data-testid="camera-preview-video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full rounded-xl bg-black object-cover"
            />
            {devices.length > 1 && (
                <Select
                    value={selectedDeviceId ?? undefined}
                    onValueChange={selectDevice}
                >
                    <SelectTrigger
                        data-testid="camera-preview-device-select"
                        className="w-full"
                    >
                        <SelectValue placeholder="Choose a camera" />
                    </SelectTrigger>
                    <SelectContent>
                        {devices.map((device, index) => (
                            <SelectItem
                                key={device.deviceId}
                                value={device.deviceId}
                            >
                                {device.label || `Camera ${index + 1}`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    );
}
