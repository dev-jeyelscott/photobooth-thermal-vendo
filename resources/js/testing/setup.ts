import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
});

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

    set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
    }
}

vi.stubGlobal('Image', MockImage);
