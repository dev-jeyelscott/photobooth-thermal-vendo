import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PaymentSettingsEdit from './edit';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    setLayoutProps: () => {},
    Form: ({
        children,
    }: {
        children: (state: {
            processing: boolean;
            errors: Record<string, string>;
        }) => ReactNode;
    }) => (
        <form>
            {children({
                processing: false,
                errors: {},
            })}
        </form>
    ),
}));

vi.mock(
    '@/actions/App/Http/Controllers/Admin/PaymentSettingController',
    () => ({
        default: {
            replace: {
                form: (mode: string) => ({
                    action: `/admin/payment-settings/${mode}`,
                    method: 'put',
                }),
            },
            test: {
                form: (mode: string) => ({
                    action: `/admin/payment-settings/${mode}/test`,
                    method: 'post',
                }),
            },
            reprovision: {
                form: (mode: string) => ({
                    action: `/admin/payment-settings/${mode}/webhook/reprovision`,
                    method: 'post',
                }),
            },
            activate: {
                form: (mode: string) => ({
                    action: `/admin/payment-settings/${mode}/activate`,
                    method: 'post',
                }),
            },
        },
    }),
);

vi.mock('@/routes/admin/payment-settings', () => ({
    edit: () => '/admin/payment-settings',
}));

const props = {
    businessName: 'Acme Photo',
    activeMode: 'test' as const,
    accounts: {
        test: {
            mode: 'test' as const,
            configured: true,
            webhookReady: true,
            maskedPublicKey: 'pk_test_••••1234',
            maskedSecretKey: 'sk_test_••••5678',
            verifiedAt: '2026-08-28T08:00:00+08:00',
            webhookStatus: 'enabled',
            webhookProvisionedAt: '2026-08-28T08:01:00+08:00',
            supersededAt: null,
        },
        live: {
            mode: 'live' as const,
            configured: false,
            webhookReady: false,
            maskedPublicKey: null,
            maskedSecretKey: null,
            verifiedAt: null,
            webhookStatus: null,
            webhookProvisionedAt: null,
            supersededAt: null,
        },
    },
};

describe('admin payment settings', () => {
    it('renders separate test and live credential sections', () => {
        render(<PaymentSettingsEdit {...props} />);

        expect(
            screen.getByRole('heading', {
                name: 'Test credentials',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('heading', {
                name: 'Live credentials',
            }),
        ).toBeInTheDocument();

        expect(screen.getByText('Acme Photo')).toBeInTheDocument();
    });

    it('shows masked metadata without rehydrating credential values', () => {
        render(<PaymentSettingsEdit {...props} />);

        expect(screen.getByText('pk_test_••••1234')).toBeInTheDocument();
        expect(screen.getByText('sk_test_••••5678')).toBeInTheDocument();

        expect(screen.queryByDisplayValue(/pk_test_/)).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue(/sk_test_/)).not.toBeInTheDocument();
    });

    it('keeps credential inputs empty and excludes tenant ownership fields', () => {
        render(<PaymentSettingsEdit {...props} />);

        expect(screen.getByLabelText('Test public key')).toHaveValue('');
        expect(screen.getByLabelText('Test secret key')).toHaveValue('');
        expect(screen.getByLabelText('Live public key')).toHaveValue('');
        expect(screen.getByLabelText('Live secret key')).toHaveValue('');

        expect(
            document.querySelector('[name="business_id"]'),
        ).not.toBeInTheDocument();

        expect(document.querySelector('[name="mode"]')).not.toBeInTheDocument();
    });

    it('renders connection replacement webhook recovery and activation actions', () => {
        render(<PaymentSettingsEdit {...props} />);

        expect(
            screen.getByRole('button', {
                name: 'Replace credentials',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Save credentials',
            }),
        ).toBeInTheDocument();

        expect(
            screen.getAllByRole('button', {
                name: 'Test connection',
            }),
        ).toHaveLength(2);

        expect(
            screen.getAllByRole('button', {
                name: 'Recover webhook',
            }),
        ).toHaveLength(2);

        expect(
            screen.getByRole('button', {
                name: 'Activate Live',
            }),
        ).toBeDisabled();

        expect(
            screen.getByRole('button', {
                name: 'Active mode',
            }),
        ).toBeDisabled();
    });

    it('blocks activation until webhook provisioning is complete', () => {
        render(
            <PaymentSettingsEdit
                {...props}
                accounts={{
                    ...props.accounts,
                    live: {
                        mode: 'live',
                        configured: true,
                        webhookReady: false,
                        maskedPublicKey: 'pk_live_••••1111',
                        maskedSecretKey: 'sk_live_••••2222',
                        verifiedAt: '2026-08-28T08:00:00+08:00',
                        webhookStatus: null,
                        webhookProvisionedAt: null,
                        supersededAt: null,
                    },
                }}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: 'Activate Live',
            }),
        ).toBeDisabled();

        expect(screen.getAllByText('Webhook required')).not.toHaveLength(0);
    });

    it('allows activation when the target account is fully webhook ready', () => {
        render(
            <PaymentSettingsEdit
                {...props}
                accounts={{
                    ...props.accounts,
                    live: {
                        mode: 'live',
                        configured: true,
                        webhookReady: true,
                        maskedPublicKey: 'pk_live_••••1111',
                        maskedSecretKey: 'sk_live_••••2222',
                        verifiedAt: '2026-08-28T08:00:00+08:00',
                        webhookStatus: 'enabled',
                        webhookProvisionedAt: '2026-08-28T08:01:00+08:00',
                        supersededAt: null,
                    },
                }}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: 'Activate Live',
            }),
        ).toBeEnabled();
    });

    it('uses password-style inputs for newly supplied credentials', () => {
        render(<PaymentSettingsEdit {...props} />);

        expect(screen.getByLabelText('Test public key')).toHaveAttribute(
            'type',
            'password',
        );

        expect(screen.getByLabelText('Test secret key')).toHaveAttribute(
            'type',
            'password',
        );

        expect(screen.getByLabelText('Test secret key')).toHaveAttribute(
            'autocomplete',
            'new-password',
        );
    });
});
