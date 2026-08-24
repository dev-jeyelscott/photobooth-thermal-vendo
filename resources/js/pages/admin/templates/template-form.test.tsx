import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TemplateForm from './template-form';

const formErrors = vi.hoisted(() => ({
    current: {} as Record<string, string>,
}));

/**
 * Resolve an Inertia or Wayfinder href into the URL expected by the test anchor.
 */
function resolveHref(href: unknown): string {
    if (typeof href === 'string') {
        return href;
    }

    if (
        typeof href === 'object' &&
        href !== null &&
        'url' in href &&
        typeof href.url === 'string'
    ) {
        return href.url;
    }

    return '#';
}

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        className,
        children,
    }: {
        action: string;
        method: string;
        className?: string;
        children: (state: {
            processing: boolean;
            errors: Record<string, string>;
        }) => ReactNode;
    }) => (
        <form action={action} method={method} className={className}>
            {children({
                processing: false,
                errors: formErrors.current,
            })}
        </form>
    ),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: unknown;
        children: ReactNode;
    }) => (
        <a href={resolveHref(href)} {...props}>
            {children}
        </a>
    ),
}));

const existingTemplate = {
    id: 42,
    name: 'Classic',
    slug: 'classic',
    orientation: 'portrait' as const,
    layoutPath: 'templates/classic.png',
    layoutUrl: '/storage/templates/classic.png',
    thumbnailPath: 'templates/thumbnails/classic.png',
    thumbnailUrl: '/storage/templates/thumbnails/classic.png',
    photoSlots: 3,
    layoutConfig: {
        slots: [
            {
                slot: 1,
                x: 0,
                y: 0,
                width: 100,
                height: 50,
            },
            {
                slot: 2,
                x: 0,
                y: 50,
                width: 100,
                height: 50,
            },
            {
                slot: 3,
                x: 0,
                y: 100,
                width: 100,
                height: 50,
            },
        ],
    },
    printWidthMm: 100,
    printHeightMm: 150,
    active: false,
    sortOrder: 2,
    printerCompatibility: null,
    createdAt: '2026-08-18T08:00:00+00:00',
    updatedAt: '2026-08-24T08:00:00+00:00',
};

beforeEach(() => {
    formErrors.current = {};

    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: vi.fn((file: File) => `blob:${encodeURIComponent(file.name)}`),
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: vi.fn(),
    });
});

describe('template form browser payload contract', () => {
    it('submits one explicit Laravel boolean value for active', () => {
        const { container } = render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        expect(
            container.querySelector('input[type="hidden"][name="active"]'),
        ).toHaveAttribute('value', '1');
    });

    it('preserves an inactive template state on edit', () => {
        const { container } = render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(
            container.querySelector('input[type="hidden"][name="active"]'),
        ).toHaveAttribute('value', '0');
    });

    it('requires the layout asset only when creating a template', () => {
        const { unmount } = render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        expect(screen.getByLabelText('Layout Asset')).toBeRequired();

        unmount();

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(screen.getByLabelText('Layout Asset')).not.toBeRequired();
    });

    it('renders usable links for current stored assets', () => {
        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(
            screen.getByRole('link', {
                name: /View current layout asset/i,
            }),
        ).toHaveAttribute('href', existingTemplate.layoutUrl);

        expect(
            screen.getByRole('link', {
                name: /View current template thumbnail/i,
            }),
        ).toHaveAttribute('href', existingTemplate.thumbnailUrl);
    });

    it('previews a newly selected layout file without changing its form field contract', async () => {
        const user = userEvent.setup();

        render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        const file = new File(['layout'], 'new-layout.png', {
            type: 'image/png',
        });

        await user.upload(screen.getByLabelText('Layout Asset'), file);

        expect(screen.getByAltText('Layout Asset preview')).toHaveAttribute(
            'src',
            'blob:new-layout.png',
        );

        expect(screen.getByLabelText('Layout Asset')).toHaveAttribute(
            'name',
            'layout',
        );
    });

    it('keeps photo_slots and canonical layout_config synchronized', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        expect(screen.getByLabelText('Photo Slots')).toHaveValue(1);

        await user.click(screen.getByRole('button', { name: 'Add Slot' }));

        expect(screen.getByLabelText('Photo Slots')).toHaveValue(2);

        const layoutInput = container.querySelector(
            'input[name="layout_config"]',
        );

        expect(layoutInput).not.toBeNull();

        const layout = JSON.parse(
            layoutInput?.getAttribute('value') ?? '{}',
        ) as {
            slots: Array<{ slot: number }>;
        };

        expect(layout.slots).toHaveLength(2);
        expect(layout.slots.map((slot) => slot.slot)).toEqual([1, 2]);

        await user.click(screen.getByRole('button', { name: 'Remove slot 2' }));

        expect(screen.getByLabelText('Photo Slots')).toHaveValue(1);
    });

    it('applies valid advanced JSON back into the canonical slot state', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: /Advanced JSON Configuration/i,
            }),
        );

        const json = JSON.stringify({
            slots: [
                {
                    slot: 1,
                    x: 0,
                    y: 0,
                    width: 50,
                    height: 75,
                },
                {
                    slot: 2,
                    x: 50,
                    y: 75,
                    width: 50,
                    height: 75,
                },
            ],
        });

        fireEvent.change(screen.getByLabelText('Layout configuration JSON'), {
            target: { value: json },
        });

        await user.click(screen.getByRole('button', { name: 'Apply JSON' }));

        expect(screen.getByLabelText('Photo Slots')).toHaveValue(2);

        const layoutInput = container.querySelector(
            'input[name="layout_config"]',
        );
        const layout = JSON.parse(
            layoutInput?.getAttribute('value') ?? '{}',
        ) as {
            slots: unknown[];
        };

        expect(layout.slots).toHaveLength(2);
    });

    it('does not replace canonical layout state when advanced JSON is malformed', async () => {
        const user = userEvent.setup();

        render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: /Advanced JSON Configuration/i,
            }),
        );

        fireEvent.change(screen.getByLabelText('Layout configuration JSON'), {
            target: { value: '{invalid-json}' },
        });

        await user.click(screen.getByRole('button', { name: 'Apply JSON' }));

        expect(
            screen.getByText('Layout JSON must be valid JSON.'),
        ).toHaveAttribute('role', 'alert');

        expect(screen.getByLabelText('Photo Slots')).toHaveValue(1);
    });
});

describe('template form edit presentation', () => {
    it('renders the live summary and truthful persisted metadata', () => {
        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(screen.getByText('Template Summary')).toBeInTheDocument();
        expect(screen.getByText('100 mm × 150 mm')).toBeInTheDocument();
        expect(screen.getByText('Template Metadata')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('uses the existing Wayfinder destroy form inside the confirmation dialog', async () => {
        const user = userEvent.setup();

        render(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        await user.click(
            screen.getByRole('button', { name: 'Delete Template' }),
        );

        expect(
            screen.getByRole('heading', { name: 'Delete template?' }),
        ).toBeInTheDocument();

        const deleteForm = document.querySelector(
            'form[action="/admin/templates/42?_method=DELETE"]',
        );

        expect(deleteForm).not.toBeNull();
        expect(deleteForm).toHaveAttribute('method', 'post');
    });
});

describe('template form accessibility', () => {
    it('associates a validation error with its field via aria-describedby', () => {
        formErrors.current = {
            name: 'The name field is required.',
        };

        render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        const nameInput = screen.getByLabelText('Template Name');

        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
        expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');

        const message = screen.getByText('The name field is required.');

        expect(message).toHaveAttribute('id', 'name-error');
        expect(message).toHaveAttribute('role', 'alert');
    });
});
