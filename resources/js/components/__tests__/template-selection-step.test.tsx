import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TemplateSelectionStep } from '@/components/template-selection-step';
import { NETWORK_ERROR_MESSAGE } from '@/hooks/use-photobooth-session';
import type { PhotoTemplateOption } from '@/hooks/use-photobooth-session';

const template: PhotoTemplateOption = {
    id: 1,
    name: 'Classic Strip',
    thumbnailPath: null,
    photoSlots: 3,
    layoutConfig: null,
    printWidthMm: 50,
    printHeightMm: 150,
};

describe('TemplateSelectionStep', () => {
    it('lists fetched templates and selects one', async () => {
        const user = userEvent.setup();
        const onSelected = vi.fn();

        render(
            <TemplateSelectionStep
                fetchTemplates={vi.fn().mockResolvedValue([template])}
                selectTemplate={vi.fn().mockResolvedValue({ ok: true })}
                onSelected={onSelected}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        const option = await screen.findByTestId('kiosk-template-1');
        await user.click(option);

        await waitFor(() => {
            expect(onSelected).toHaveBeenCalledWith(template);
        });
    });

    it('shows an inline error when selection is rejected', async () => {
        const user = userEvent.setup();

        render(
            <TemplateSelectionStep
                fetchTemplates={vi.fn().mockResolvedValue([template])}
                selectTemplate={vi.fn().mockResolvedValue({
                    ok: false,
                    message: 'This template could not be selected.',
                    expired: false,
                })}
                onSelected={vi.fn()}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        await user.click(await screen.findByTestId('kiosk-template-1'));

        expect(
            await screen.findByTestId('kiosk-template-error'),
        ).toHaveTextContent('This template could not be selected.');
    });

    it('raises the expired-session callback when the session has expired', async () => {
        const user = userEvent.setup();
        const onExpired = vi.fn();

        render(
            <TemplateSelectionStep
                fetchTemplates={vi.fn().mockResolvedValue([template])}
                selectTemplate={vi.fn().mockResolvedValue({
                    ok: false,
                    message: 'Session expired.',
                    expired: true,
                })}
                onSelected={vi.fn()}
                onActivity={vi.fn()}
                onExpired={onExpired}
                onBackToStart={vi.fn()}
            />,
        );

        await user.click(await screen.findByTestId('kiosk-template-1'));

        await waitFor(() => {
            expect(onExpired).toHaveBeenCalled();
        });
    });

    it('shows a network error state and allows retrying', async () => {
        const user = userEvent.setup();

        render(
            <TemplateSelectionStep
                fetchTemplates={vi.fn().mockResolvedValue([template])}
                selectTemplate={vi.fn().mockResolvedValue({
                    ok: false,
                    message: NETWORK_ERROR_MESSAGE,
                    expired: false,
                })}
                onSelected={vi.fn()}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        await user.click(await screen.findByTestId('kiosk-template-1'));

        await user.click(
            await screen.findByRole('button', { name: 'Try Again' }),
        );

        expect(await screen.findByTestId('kiosk-template-1')).toBeInTheDocument();
    });
});
