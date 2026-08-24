import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type KioskErrorKind =
    | 'no-camera-permission'
    | 'camera-unavailable'
    | 'camera-stream-lost'
    | 'payment-timeout'
    | 'payment-failed'
    | 'invalid-voucher'
    | 'processing-failure'
    | 'print-failure'
    | 'network-interruption'
    | 'expired-session';

const ERROR_CONFIG: Record<
    KioskErrorKind,
    { title: string; message: string; retryLabel: string | null }
> = {
    'no-camera-permission': {
        title: 'Camera access needed',
        message:
            'Camera access was denied. Please allow camera access in your browser and try again.',
        retryLabel: 'Try Again',
    },
    'camera-unavailable': {
        title: 'Camera unavailable',
        message:
            'The camera could not be started. Please check the connection and try again.',
        retryLabel: 'Try Again',
    },
    'camera-stream-lost': {
        title: 'Camera disconnected',
        message:
            'The camera connection was lost. Your shots so far are safe. Reconnect to keep capturing.',
        retryLabel: 'Reconnect Camera',
    },
    'payment-timeout': {
        title: 'Payment timed out',
        message:
            'We did not receive a verified payment update in time. Retry the status check without creating a second checkout.',
        retryLabel: 'Retry Payment',
    },
    'payment-failed': {
        title: 'Payment failed',
        message: 'Your payment could not be completed. Please try again.',
        retryLabel: 'Retry Payment',
    },
    'invalid-voucher': {
        title: 'Invalid voucher',
        message: 'This voucher code is invalid or can no longer be used.',
        retryLabel: 'Try Another Code',
    },
    'processing-failure': {
        title: 'Processing failed',
        message: 'Your photos could not be processed. Please try again.',
        retryLabel: 'Try Again',
    },
    'print-failure': {
        title: 'Printing failed',
        message:
            'Your receipt could not be printed, but your digital photos are still available in your gallery.',
        retryLabel: null,
    },
    'network-interruption': {
        title: 'Connection lost',
        message:
            'We lost connection to the server. Please check the network and try again.',
        retryLabel: 'Try Again',
    },
    'expired-session': {
        title: 'Session expired',
        message:
            'This session has expired due to inactivity. Please start a new session.',
        retryLabel: null,
    },
};

/**
 * Shared dark kiosk error surface for predictable operational failures. It
 * keeps recovery actions explicit and never hides successful digital output
 * behind a print-specific failure.
 */
export function KioskErrorState({
    kind,
    message,
    onRetry,
    onBackToStart,
}: {
    kind: KioskErrorKind;
    message?: string;
    onRetry?: () => void;
    onBackToStart?: () => void;
}) {
    const config = ERROR_CONFIG[kind];

    return (
        <div
            data-testid={`kiosk-error-${kind}`}
            role="alert"
            className="mx-auto flex w-full max-w-lg flex-col items-center text-center"
        >
            <span className="grid size-12 place-items-center rounded-full border border-red-900/70 bg-red-950/40 text-red-300">
                <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-neutral-50 sm:text-3xl">
                {config.title}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-neutral-400 sm:text-base">
                {message ?? config.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                {config.retryLabel && onRetry && (
                    <Button
                        type="button"
                        size="lg"
                        onClick={onRetry}
                        className="min-h-12 bg-neutral-100 px-6 text-neutral-950 hover:bg-white"
                    >
                        {config.retryLabel}
                    </Button>
                )}
                {onBackToStart && (
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={onBackToStart}
                        className="min-h-12 border-neutral-800 bg-neutral-950 px-6 text-neutral-100 hover:bg-neutral-900 hover:text-white"
                    >
                        Back to Start
                    </Button>
                )}
            </div>
        </div>
    );
}
