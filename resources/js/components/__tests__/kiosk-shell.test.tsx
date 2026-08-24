import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KioskProgress, KioskShell } from '@/components/kiosk-shell';

describe('KioskShell', () => {
    it('renders the shared kiosk branding and safety metadata', () => {
        render(
            <KioskShell step={1}>
                <div>Content</div>
            </KioskShell>,
        );

        expect(screen.getByText('ThermaSnap')).toBeInTheDocument();
        expect(screen.getByText('Thermal photobooth')).toBeInTheDocument();
        expect(screen.getByText('Secure session')).toBeInTheDocument();
        expect(screen.getByText('Touch friendly')).toBeInTheDocument();
    });

    it('marks completed, current, and upcoming progress steps truthfully', () => {
        render(<KioskProgress step={4} />);

        expect(screen.getByTestId('kiosk-progress-1')).toHaveAttribute(
            'data-state',
            'complete',
        );
        expect(screen.getByTestId('kiosk-progress-3')).toHaveAttribute(
            'data-state',
            'complete',
        );
        expect(screen.getByTestId('kiosk-progress-4')).toHaveAttribute(
            'data-state',
            'current',
        );
        expect(screen.getByTestId('kiosk-progress-7')).toHaveAttribute(
            'data-state',
            'upcoming',
        );
    });
});
