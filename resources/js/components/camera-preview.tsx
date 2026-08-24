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

/**
 * Maps low-level camera hook failures to the customer-safe kiosk recovery
 * surfaces already used throughout the photobooth flow.
 */
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
 * Live browser camera surface. It owns stream start/stop lifecycle and exposes
 * the video element to CaptureStep while presenting device selection as an
 * overlay so the camera remains the dominant kiosk visual.
 */
export function CameraPreview({
    videoRef: externalVideoRef,
    onBackToStart,
}: {
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
        return (
            <div className="grid min-h-[22rem] w-full place-items-center rounded-2xl bg-neutral-950 p-5">
                <KioskErrorState
                    kind={cameraErrorKind(error)}
                    onRetry={() => start()}
                    onBackToStart={
                        error === 'disconnected' ? onBackToStart : undefined
                    }
                />
            </div>
        );
    }

    const selectedIndex = Math.max(
        devices.findIndex((device) => device.deviceId === selectedDeviceId),
        0,
    );
    const selectedDevice = devices[selectedIndex];
    const selectedLabel =
        selectedDevice?.label || `Camera ${selectedIndex + 1}`;

    return (
        <div className="relative w-full overflow-hidden rounded-2xl bg-black">
            <video
                data-testid="camera-preview-video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video min-h-[20rem] w-full bg-black object-cover sm:min-h-[28rem] lg:min-h-[32rem]"
            />

            <div className="absolute top-4 left-4 z-20 max-w-[70%] sm:top-5 sm:left-5">
                {devices.length > 1 ? (
                    <Select
                        value={selectedDeviceId ?? undefined}
                        onValueChange={selectDevice}
                    >
                        <SelectTrigger
                            data-testid="camera-preview-device-select"
                            aria-label="Choose camera"
                            className="min-h-10 w-auto max-w-full border-neutral-700 bg-neutral-950/80 px-4 text-xs text-neutral-200 shadow-lg backdrop-blur data-[size=default]:h-10 sm:text-sm"
                        >
                            <span className="mr-1 text-neutral-400">
                                Camera:
                            </span>
                            <SelectValue placeholder="Choose a camera" />
                        </SelectTrigger>
                        <SelectContent>
                            {devices.map((device, index) => (
                                <SelectItem
                                    key={device.deviceId}
                                    value={device.deviceId}
                                    className="min-h-11"
                                >
                                    {device.label || `Camera ${index + 1}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <span className="inline-flex min-h-10 items-center rounded-full border border-neutral-700 bg-neutral-950/80 px-4 text-xs text-neutral-300 shadow-lg backdrop-blur sm:text-sm">
                        Camera: {selectedLabel}
                    </span>
                )}
            </div>

            {stream && (
                <span className="absolute right-4 bottom-4 z-20 rounded-full border border-neutral-700 bg-neutral-950/80 px-4 py-2 text-xs text-neutral-300 shadow-lg backdrop-blur sm:right-5 sm:bottom-5 sm:text-sm">
                    Camera ready
                </span>
            )}
        </div>
    );
}
