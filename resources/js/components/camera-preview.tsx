import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { CameraErrorReason } from '@/hooks/use-camera';
import { useCamera } from '@/hooks/use-camera';

const ERROR_MESSAGES: Record<CameraErrorReason, string> = {
    'permission-denied':
        'Camera access was denied. Please allow camera access and try again.',
    'not-found': 'No camera was found on this device.',
    'in-use': 'The camera is currently in use by another application.',
    unknown: 'The camera could not be started. Please try again.',
};

/**
 * Live camera preview backed by useCamera. Starts the stream on mount and
 * stops it on unmount so the camera light is released as soon as this step ends.
 */
export function CameraPreview() {
    const { stream, error, start, stop } = useCamera();
    const videoRef = useRef<HTMLVideoElement | null>(null);

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
    }, [stream]);

    if (error) {
        return (
            <div
                data-testid="camera-preview-error"
                className="flex flex-col items-center gap-3 text-center"
            >
                <p role="alert" className="text-sm text-red-400">
                    {ERROR_MESSAGES[error]}
                </p>
                <Button type="button" variant="secondary" onClick={start}>
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <video
            data-testid="camera-preview-video"
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full rounded-xl bg-black object-cover"
        />
    );
}
