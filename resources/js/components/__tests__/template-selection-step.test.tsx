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

const secondTemplate: PhotoTemplateOption = {
    ...template,
    id: 2,
    name: 'Four Frame',
    photoSlots: 4,
};

describe('TemplateSelectionStep', () => {
    it('highlights a template locally and persists only after explicit confirmation', async () => {
        const user = userEvent.setup();
        const selectTemplate = vi.fn().mockResolvedValue({ ok: true });
        const onSelected = vi.fn();

        render(
            <TemplateSelectionStep
                fetchTemplates={vi
                    .fn()
                    .mockResolvedValue([template, secondTemplate])}
                selectTemplate={selectTemplate}
                onSelected={onSelected}
                onActivity={vi.fn()}
                onExpired={vi.fn()}
                onBackToStart={vi.fn()}
            />,
        );

        const firstOption = await screen.findByTestId('kiosk-template-1');
        const secondOption = screen.getByTestId('kiosk-template-2');

        expect(firstOption).toHaveAttribute('aria-pressed', 'true');
        await user.click(secondOption);

        expect(secondOption).toHaveAttribute('aria-pressed', 'true');
        expect(selectTemplate).not.toHaveBeenCalled();

        await user.click(
            screen.getByRole('button', { name: 'Use selected template' }),
        );

        await waitFor(() => {
            expect(selectTemplate).toHaveBeenCalledWith(2);
            expect(onSelected).toHaveBeenCalledWith(secondTemplate);
        });
    });

    it('shows an inline error when the confirmed selection is rejected', async () => {
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

        await screen.findByTestId('kiosk-template-1');
        await user.click(
            screen.getByRole('button', { name: 'Use selected template' }),
        );

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

        await screen.findByTestId('kiosk-template-1');
        await user.click(
            screen.getByRole('button', { name: 'Use selected template' }),
        );

        await waitFor(() => {
            expect(onExpired).toHaveBeenCalled();
        });
    });

    it('shows a network error state and allows retrying the selection screen', async () => {
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

        await screen.findByTestId('kiosk-template-1');
        await user.click(
            screen.getByRole('button', { name: 'Use selected template' }),
        );
        await user.click(
            await screen.findByRole('button', { name: 'Try Again' }),
        );

        expect(
            await screen.findByTestId('kiosk-template-1'),
        ).toBeInTheDocument();
    });
});
