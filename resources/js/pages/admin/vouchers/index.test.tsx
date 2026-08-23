import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VouchersIndex, {
    filterVouchers,
    getLastRedemption,
    getUsagePercentage,
    getVoucherAvailability,
    getVoucherSummary,
} from './index';
import type { Voucher } from './index';

const { patchMock } = vi.hoisted(() => ({
    patchMock: vi.fn(),
}));

type MockFormState = {
    processing: boolean;
    errors: Record<string, string>;
};

vi.mock('@inertiajs/react', () => ({
    Form: ({
        action,
        method,
        children,
    }: {
        action?: string;
        method?: string;
        children?: ReactNode | ((state: MockFormState) => ReactNode);
    }) => (
        <form action={action} method={method}>
            {typeof children === 'function'
                ? children({
                      processing: false,
                      errors: {},
                  })
                : children}
        </form>
    ),
    Head: () => null,
    Link: ({
        href,
        children,
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => <a href={typeof href === 'string' ? href : href.url}>{children}</a>,
    router: {
        patch: patchMock,
    },
    setLayoutProps: vi.fn(),
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
        open ? <div>{children}</div> : null,
    DialogClose: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DialogDescription: ({ children }: { children: ReactNode }) => (
        <p>{children}</p>
    ),
    DialogFooter: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
        <>{children}</>
    ),
    DropdownMenuItem: ({
        children,
        onSelect,
        disabled,
    }: {
        children: ReactNode;
        onSelect?: () => void;
        disabled?: boolean;
    }) => (
        <button type="button" disabled={disabled} onClick={() => onSelect?.()}>
            {children}
        </button>
    ),
    DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectContent: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    SelectItem: ({
        children,
        value,
    }: {
        children: ReactNode;
        value: string;
    }) => <div data-value={value}>{children}</div>,
    SelectTrigger: ({
        children,
        'aria-label': ariaLabel,
    }: {
        children: ReactNode;
        'aria-label'?: string;
    }) => (
        <button type="button" aria-label={ariaLabel}>
            {children}
        </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
        <span>{placeholder}</span>
    ),
}));

/**
 * Build a stable voucher fixture while allowing each test to override only the
 * fields relevant to the behavior being verified.
 */
function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
    return {
        id: 1,
        code: 'THERMA-FRIENDS',
        active: true,
        validFrom: null,
        expiresAt: '2026-09-22T12:00:00+08:00',
        usageLimit: 10,
        usageCount: 2,
        redemptions: [],
        ...overrides,
    };
}

describe('voucher availability helpers', () => {
    const now = new Date('2026-08-23T12:00:00+08:00');

    it('matches server redemption precedence', () => {
        expect(
            getVoucherAvailability(
                makeVoucher({
                    active: false,
                    usageLimit: 1,
                    usageCount: 1,
                }),
                now,
            ),
        ).toBe('disabled');

        expect(
            getVoucherAvailability(
                makeVoucher({
                    validFrom: '2026-08-24T12:00:00+08:00',
                    expiresAt: '2026-09-24T12:00:00+08:00',
                }),
                now,
            ),
        ).toBe('scheduled');

        expect(
            getVoucherAvailability(
                makeVoucher({
                    expiresAt: '2026-08-22T12:00:00+08:00',
                }),
                now,
            ),
        ).toBe('expired');

        expect(
            getVoucherAvailability(
                makeVoucher({
                    usageLimit: 2,
                    usageCount: 2,
                }),
                now,
            ),
        ).toBe('exhausted');

        expect(getVoucherAvailability(makeVoucher(), now)).toBe('usable');
    });

    it('calculates summary values without treating scheduled vouchers as attention items', () => {
        const vouchers = [
            makeVoucher({
                id: 1,
                redemptions: [
                    {
                        sessionToken: 'one',
                        startedAt: '2026-08-22T12:00:00+08:00',
                    },
                    {
                        sessionToken: 'two',
                        startedAt: '2026-08-22T13:00:00+08:00',
                    },
                ],
            }),
            makeVoucher({
                id: 2,
                active: false,
            }),
            makeVoucher({
                id: 3,
                expiresAt: '2026-08-22T12:00:00+08:00',
            }),
            makeVoucher({
                id: 4,
                usageLimit: 1,
                usageCount: 1,
                redemptions: [
                    {
                        sessionToken: 'three',
                        startedAt: '2026-08-20T12:00:00+08:00',
                    },
                ],
            }),
            makeVoucher({
                id: 5,
                validFrom: '2026-08-24T12:00:00+08:00',
                expiresAt: '2026-09-24T12:00:00+08:00',
            }),
        ];

        expect(getVoucherSummary(vouchers, now)).toEqual({
            total: 5,
            usable: 1,
            totalRedemptions: 3,
            needsAttention: 3,
        });
    });

    it('bounds the usage percentage between zero and one hundred', () => {
        expect(getUsagePercentage(makeVoucher({ usageCount: 2 }))).toBe(20);

        expect(
            getUsagePercentage(
                makeVoucher({
                    usageLimit: 5,
                    usageCount: 10,
                }),
            ),
        ).toBe(100);

        expect(
            getUsagePercentage(
                makeVoucher({
                    usageLimit: 0,
                    usageCount: 0,
                }),
            ),
        ).toBe(0);
    });

    it('filters by voucher code and derived availability', () => {
        const vouchers = [
            makeVoucher({
                id: 1,
                code: 'THERMA-FRIENDS',
            }),
            makeVoucher({
                id: 2,
                code: 'THERMA-EXPIRED',
                expiresAt: '2026-08-22T12:00:00+08:00',
            }),
        ];

        expect(filterVouchers(vouchers, 'friends', 'all', now)).toHaveLength(1);
        expect(filterVouchers(vouchers, '', 'expired', now)).toEqual([
            vouchers[1],
        ]);
    });

    it('returns the latest timestamped redemption', () => {
        const voucher = makeVoucher({
            redemptions: [
                {
                    sessionToken: 'older',
                    startedAt: '2026-08-20T12:00:00+08:00',
                },
                {
                    sessionToken: 'newer',
                    startedAt: '2026-08-22T18:00:00+08:00',
                },
            ],
        });

        expect(getLastRedemption(voucher)?.sessionToken).toBe('newer');
    });
});

describe('Voucher Management page', () => {
    beforeEach(() => {
        patchMock.mockReset();
    });

    it('renders operator-focused information without exposing raw session tokens', () => {
        const voucher = makeVoucher({
            redemptions: [
                {
                    sessionToken: '11111111-1111-4111-8111-000000000003',
                    startedAt: '2026-08-22T17:12:00+08:00',
                },
                {
                    sessionToken: '11111111-1111-4111-8111-000000000005',
                    startedAt: '2026-08-22T17:13:00+08:00',
                },
            ],
        });

        render(
            <VouchersIndex
                vouchers={[voucher]}
                serverNow="2026-08-23T12:00:00+08:00"
            />,
        );

        expect(
            screen.getByRole('link', { name: /new voucher/i }),
        ).toHaveAttribute('href', '/admin/vouchers/create');

        expect(screen.getByText('2 redemptions')).toBeInTheDocument();

        expect(
            screen.queryByText('11111111-1111-4111-8111-000000000003'),
        ).not.toBeInTheDocument();

        const usage = screen.getByRole('progressbar', {
            name: 'Usage for THERMA-FRIENDS',
        });

        expect(usage).toHaveAttribute('aria-valuenow', '20');
        expect(usage).toHaveAttribute('aria-valuetext', '2 of 10 uses');

        expect(
            screen.getByRole('button', {
                name: 'More actions for THERMA-FRIENDS',
            }),
        ).toBeInTheDocument();
    });

    it('keeps the toggle action connected to the generated Wayfinder route', async () => {
        const user = userEvent.setup();

        render(
            <VouchersIndex
                vouchers={[makeVoucher()]}
                serverNow="2026-08-23T12:00:00+08:00"
            />,
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Disable voucher',
            }),
        );

        expect(patchMock).toHaveBeenCalledWith(
            '/admin/vouchers/1/toggle',
            {},
            {
                preserveScroll: true,
            },
        );
    });

    it('renders a truthful empty state', () => {
        render(
            <VouchersIndex
                vouchers={[]}
                serverNow="2026-08-23T12:00:00+08:00"
            />,
        );

        expect(screen.getByText('No vouchers yet.')).toBeInTheDocument();

        const totalCard = screen.getByLabelText('Total vouchers');

        expect(within(totalCard).getByText('0')).toBeInTheDocument();
    });
});
