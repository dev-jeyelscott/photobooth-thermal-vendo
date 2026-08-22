import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CameraPreview } from '@/components/camera-preview';

const mockUseCamera = vi.fn();

vi.mock('@/hooks/use-camera', () => ({
    useCamera: () => mockUseCamera(),
}));

describe('CameraPreview', () => {
    it('renders a large touch-target camera selector when multiple cameras are available', () => {
        mockUseCamera.mockReturnValue({
            stream: null,
            error: null,
            devices: [
                { deviceId: 'a', label: 'Front Camera' },
                { deviceId: 'b', label: 'Back Camera' },
            ],
            selectedDeviceId: 'a',
            start: vi.fn(),
            stop: vi.fn(),
            selectDevice: vi.fn(),
        });

        render(<CameraPreview />);

        const trigger = screen.getByTestId('camera-preview-device-select');
        expect(trigger.className).toContain('data-[size=default]:h-10');
    });

    it('does not render a selector when only one camera is available', () => {
        mockUseCamera.mockReturnValue({
            stream: null,
            error: null,
            devices: [{ deviceId: 'a', label: 'Front Camera' }],
            selectedDeviceId: 'a',
            start: vi.fn(),
            stop: vi.fn(),
            selectDevice: vi.fn(),
        });

        render(<CameraPreview />);

        expect(
            screen.queryByTestId('camera-preview-device-select'),
        ).not.toBeInTheDocument();
    });
});
