import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';

export type KioskErrorKind =
    | 'no-camera-permission'
    | 'camera-unavailable'
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
        title: 'Camera Access Needed',
        message:
            'Camera access was denied. Please allow camera access in your browser and try again.',
        retryLabel: 'Try Again',
    },
    'camera-unavailable': {
        title: 'Camera Unavailable',
        message:
            'The camera could not be started. Please check the connection and try again.',
        retryLabel: 'Try Again',
    },
    'payment-timeout': {
        title: 'Payment Timed Out',
        message: 'We did not receive your payment in time. Please try again.',
        retryLabel: 'Retry Payment',
    },
    'payment-failed': {
        title: 'Payment Failed',
        message: 'Your payment could not be completed. Please try again.',
        retryLabel: 'Retry Payment',
    },
    'invalid-voucher': {
        title: 'Invalid Voucher',
        message: 'This voucher code is invalid or can no longer be used.',
        retryLabel: 'Try Another Code',
    },
    'processing-failure': {
        title: 'Processing Failed',
        message: 'Your photos could not be processed. Please try again.',
        retryLabel: 'Try Again',
    },
    'print-failure': {
        title: 'Printing Failed',
        message:
            'Your receipt could not be printed, but your digital photos are still available in your gallery.',
        retryLabel: null,
    },
    'network-interruption': {
        title: 'Connection Lost',
        message:
            'We lost connection to the server. Please check the network and try again.',
        retryLabel: 'Try Again',
    },
    'expired-session': {
        title: 'Session Expired',
        message:
            'This session has expired due to inactivity. Please start a new session.',
        retryLabel: null,
    },
};

/**
 * Shared kiosk error surface for predictable operational failures. Always
 * pairs a short customer-safe message with an explicit recovery action so
 * the customer is never left stuck mid-flow.
 */
export function KioskErrorState({
    kind,
    message,
    onRetry,
    onBackToStart,
}: {
    kind: KioskErrorKind;
    /** Overrides the default message, e.g. with a specific customer-safe server message. */
    message?: string;
    onRetry?: () => void;
    /** Only offered when recovering in place isn't possible; omit to keep the customer on this step. */
    onBackToStart?: () => void;
}) {
    const config = ERROR_CONFIG[kind];

    return (
        <div
            data-testid={`kiosk-error-${kind}`}
            className="flex w-full max-w-md flex-col items-center gap-4 text-center sm:gap-6"
        >
            <AlertError
                title={config.title}
                errors={[message ?? config.message]}
            />
            <div className="flex gap-3">
                {config.retryLabel && onRetry && (
                    <Button type="button" size="lg" onClick={onRetry}>
                        {config.retryLabel}
                    </Button>
                )}
                {onBackToStart && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        onClick={onBackToStart}
                    >
                        Back to Start
                    </Button>
                )}
            </div>
        </div>
    );
}
