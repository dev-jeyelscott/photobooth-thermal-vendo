import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = [
    'pointerdown',
    'pointermove',
    'keydown',
    'touchstart',
    'wheel',
] as const;

/**
 * Tracks user (in)activity and reports whether the visitor has been idle
 * for longer than `timeoutMs`. Any listened-to activity event resets the timer.
 */
export function useIdleTimer(timeoutMs: number) {
    const [isIdle, setIsIdle] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    const resetTimer = useCallback(() => {
        setIsIdle(false);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => setIsIdle(true), timeoutMs);
    }, [timeoutMs]);

    useEffect(() => {
        timerRef.current = setTimeout(() => setIsIdle(true), timeoutMs);

        ACTIVITY_EVENTS.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });

        return () => {
            ACTIVITY_EVENTS.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [resetTimer, timeoutMs]);

    return { isIdle, resetTimer };
}
