import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { CameraErrorReason } from '@/hooks/use-camera';
import { useCamera } from '@/hooks/use-camera';

const ERROR_MESSAGES: Record<CameraErrorReason, string> = {
    'permission-denied':
        'Camera access was denied. Please allow camera access and try again.',
    'not-found': 'No camera was found on this device.',
    'in-use': 'The camera is currently in use by another application.',
    disconnected:
        'The camera was disconnected. Please reconnect a camera and try again.',
    unknown: 'The camera could not be started. Please try again.',
};

/**
 * Live camera preview backed by useCamera. Starts the stream on mount and
 * stops it on unmount so the camera light is released as soon as this step ends.
 * When more than one camera is available, a selector lets the customer pick
 * which one to use for the rest of the session.
 */
export function CameraPreview({
    videoRef: externalVideoRef,
}: {
    /** Exposes the underlying <video> element to callers that need to capture frames from it. */
    videoRef?: RefObject<HTMLVideoElement | null>;
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
        return (
            <div
                data-testid="camera-preview-error"
                className="flex flex-col items-center gap-3 text-center"
            >
                <p role="alert" className="text-sm text-red-400">
                    {ERROR_MESSAGES[error]}
                </p>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => start()}
                >
                    Retry
                </Button>
            </div>
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
