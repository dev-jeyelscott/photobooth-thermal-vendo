import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
});

// jsdom does not implement ResizeObserver. Radix UI uses it to measure
// primitives such as Select, so provide the minimal browser contract required
// by component tests without changing production component behavior.
class MockResizeObserver {
    /**
     * Begin observing an element. No measurement callback is required for the
     * current component tests because layout itself is not under test.
     */
    observe(): void {}

    /**
     * Stop observing an element.
     */
    unobserve(): void {}

    /**
     * Stop all observations owned by this observer.
     */
    disconnect(): void {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

// jsdom does not implement document.elementFromPoint. input-otp uses this
// browser API while managing its invisible input and password-manager
// interaction behavior. Component tests do not perform physical hit testing,
// so returning null supplies the required browser contract without changing
// production OTP behavior.
document.elementFromPoint = vi.fn(() => null);

// jsdom does not implement the canvas 2D API; stub it out so components that
// draw previews (capture, sticker overlay, print preview) don't crash.
HTMLCanvasElement.prototype.getContext = vi.fn() as never;
HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => 'data:image/jpeg;base64,mock',
);

// jsdom never fires image load events; resolve them on the next tick so
// components awaiting `onload` (sticker overlay, print preview) settle.
class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string | null = null;

    /**
     * Simulate a successfully loaded image on the next event-loop turn.
     */
    set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
    }
}

vi.stubGlobal('Image', MockImage);
