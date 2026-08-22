import { render, screen } from '@testing-library/react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TemplateForm from './template-form';

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action: string;
        method: string;
        children: (state: {
            processing: boolean;
            errors: Record<string, string>;
        }) => ReactNode;
    }) => (
        <form action={action} method={method}>
            {children({ processing: false, errors: {} })}
        </form>
    ),
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: (props: InputHTMLAttributes<HTMLInputElement>) => (
        <input type="checkbox" {...props} />
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
    printWidthMm: 100,
    printHeightMm: 150,
    active: false,
    sortOrder: 0,
    printerCompatibility: null,
};

describe('template form browser payload contract', () => {
    it('submits an explicit Laravel boolean value for active', () => {
        const { container } = render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        expect(
            container.querySelector(
                'input[type="hidden"][name="active"][value="0"]',
            ),
        ).toBeInTheDocument();
        const activeCheckbox = screen.getByRole('checkbox', { name: 'Active' });
        expect(activeCheckbox).toBeChecked();
        expect(activeCheckbox).toHaveAttribute('value', '1');
    });

    it('preserves an inactive template state on edit', () => {
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
            screen.getByRole('checkbox', { name: 'Active' }),
        ).not.toBeChecked();
    });

    it('requires the layout asset only when creating a template', () => {
        const { rerender } = render(
            <TemplateForm
                form={{ action: '/admin/templates', method: 'post' }}
            />,
        );

        expect(screen.getByLabelText('Layout asset')).toBeRequired();

        rerender(
            <TemplateForm
                form={{
                    action: '/admin/templates/42?_method=PUT',
                    method: 'post',
                }}
                template={existingTemplate}
            />,
        );

        expect(screen.getByLabelText('Layout asset')).not.toBeRequired();
    });

    it('renders usable links for the current stored assets', () => {
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
            screen.getByRole('link', { name: 'View current layout asset' }),
        ).toHaveAttribute('href', existingTemplate.layoutUrl);
        expect(
            screen.getByRole('link', { name: 'View current thumbnail' }),
        ).toHaveAttribute('href', existingTemplate.thumbnailUrl);
    });
});
