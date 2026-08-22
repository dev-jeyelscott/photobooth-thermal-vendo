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

const cameraErrorKind = (reason: CameraErrorReason): KioskErrorKind => {
    if (reason === 'permission-denied') {
        return 'no-camera-permission';
    }

    if (reason === 'disconnected') {
        return 'camera-stream-lost';
    }

    return 'camera-unavailable';
};

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
        // 'disconnected' is set when the active camera drops mid-session,
        // either because no fallback device remains (devicechange) or the
        // active track itself ended (see useCamera). Reconnecting still
        // retries start(), so an already-plugged camera keeps working;
        // Back to Start is offered as a fallback exit either way.
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
                        className="w-full data-[size=default]:h-10"
                    >
                        <SelectValue placeholder="Choose a camera" />
                    </SelectTrigger>
                    <SelectContent>
                        {devices.map((device, index) => (
                            <SelectItem
                                key={device.deviceId}
                                value={device.deviceId}
                                className="min-h-10"
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
