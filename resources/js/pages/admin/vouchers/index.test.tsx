import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VouchersIndex, {
    filterAndSortVouchers,
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
                ? children({ processing: false, errors: {} })
                : children}
        </form>
    ),
    Head: () => null,
    Link: ({
        href,
        children,
        ...props
    }: {
        href: string | { url: string };
        children: ReactNode;
        'aria-label'?: string;
    }) => (
        <a
            href={typeof href === 'string' ? href : href.url}
            aria-label={props['aria-label']}
        >
            {children}
        </a>
    ),
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
    SelectValue: () => <span />,
}));

/**
 * Build a stable voucher fixture while allowing focused field overrides.
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

describe('voucher presentation helpers', () => {
    const now = new Date('2026-08-23T12:00:00+08:00');

    it('matches server redemption precedence', () => {
        expect(
            getVoucherAvailability(
                makeVoucher({ active: false, usageLimit: 1, usageCount: 1 }),
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
                makeVoucher({ usageLimit: 2, usageCount: 2 }),
                now,
            ),
        ).toBe('exhausted');

        expect(getVoucherAvailability(makeVoucher(), now)).toBe('usable');
    });

    it('calculates the four reference-aligned summary metrics', () => {
        const vouchers = [
            makeVoucher({ id: 1, usageCount: 2 }),
            makeVoucher({
                id: 2,
                usageCount: 4,
                expiresAt: '2026-08-22T12:00:00+08:00',
            }),
            makeVoucher({
                id: 3,
                usageCount: 1,
                validFrom: '2026-08-24T12:00:00+08:00',
            }),
            makeVoucher({ id: 4, active: false, usageCount: 3 }),
        ];

        expect(getVoucherSummary(vouchers, now)).toEqual({
            total: 4,
            usable: 1,
            totalRedemptions: 10,
            expiredOrScheduled: 2,
        });
    });

    it('bounds usage percentages between zero and one hundred', () => {
        expect(getUsagePercentage(makeVoucher({ usageCount: 2 }))).toBe(20);
        expect(
            getUsagePercentage(makeVoucher({ usageLimit: 5, usageCount: 10 })),
        ).toBe(100);
        expect(
            getUsagePercentage(makeVoucher({ usageLimit: 0, usageCount: 0 })),
        ).toBe(0);
    });

    it('filters and sorts the existing page payload without mutating it', () => {
        const vouchers = [
            makeVoucher({ id: 1, code: 'ZETA', usageCount: 2 }),
            makeVoucher({
                id: 2,
                code: 'ALPHA',
                usageCount: 8,
                expiresAt: '2026-08-22T12:00:00+08:00',
            }),
        ];

        expect(
            filterAndSortVouchers(vouchers, 'alpha', 'all', 'default', now),
        ).toEqual([vouchers[1]]);
        expect(
            filterAndSortVouchers(vouchers, '', 'expired', 'default', now),
        ).toEqual([vouchers[1]]);
        expect(
            filterAndSortVouchers(vouchers, '', 'all', 'code', now).map(
                (voucher) => voucher.code,
            ),
        ).toEqual(['ALPHA', 'ZETA']);
        expect(
            filterAndSortVouchers(vouchers, '', 'all', 'usage', now).map(
                (voucher) => voucher.code,
            ),
        ).toEqual(['ALPHA', 'ZETA']);
        expect(vouchers.map((voucher) => voucher.code)).toEqual([
            'ZETA',
            'ALPHA',
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

    it('renders the redesigned management hierarchy from real voucher data', () => {
        const voucher = makeVoucher({
            usageCount: 2,
            redemptions: [
                {
                    sessionToken: '11111111-1111-4111-8111-000000000003',
                    startedAt: '2026-08-22T17:12:00+08:00',
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
            screen.getByRole('link', { name: /create voucher/i }),
        ).toHaveAttribute('href', '/admin/vouchers/create');
        expect(
            within(screen.getByLabelText('Total vouchers')).getByText('1'),
        ).toBeInTheDocument();
        expect(
            within(screen.getByLabelText('Redeemed')).getByText('2'),
        ).toBeInTheDocument();
        expect(
            screen.queryByText('11111111-1111-4111-8111-000000000003'),
        ).not.toBeInTheDocument();

        const usage = screen.getByRole('progressbar', {
            name: 'Usage for THERMA-FRIENDS',
        });

        expect(usage).toHaveAttribute('aria-valuenow', '20');
        expect(usage).toHaveAttribute('aria-valuetext', '2 of 10 uses');
        expect(
            screen.getByRole('link', { name: 'Edit THERMA-FRIENDS' }),
        ).toHaveAttribute('href', '/admin/vouchers/1/edit');
    });

    it('filters visible voucher rows from the search box', async () => {
        const user = userEvent.setup();

        render(
            <VouchersIndex
                vouchers={[
                    makeVoucher({ id: 1, code: 'SUMMER25' }),
                    makeVoucher({ id: 2, code: 'WELCOME10' }),
                ]}
                serverNow="2026-08-23T12:00:00+08:00"
            />,
        );

        await user.type(
            screen.getByRole('searchbox', { name: 'Search vouchers' }),
            'summer',
        );

        expect(screen.getByText('SUMMER25')).toBeInTheDocument();
        expect(screen.queryByText('WELCOME10')).not.toBeInTheDocument();
        expect(screen.getByText(/Showing 1 of 2 vouchers/)).toBeInTheDocument();
    });

    it('keeps toggle behavior connected to the existing Wayfinder route', async () => {
        const user = userEvent.setup();

        render(
            <VouchersIndex
                vouchers={[makeVoucher()]}
                serverNow="2026-08-23T12:00:00+08:00"
            />,
        );

        await user.click(
            screen.getByRole('button', { name: 'Disable voucher' }),
        );

        expect(patchMock).toHaveBeenCalledWith(
            '/admin/vouchers/1/toggle',
            {},
            { preserveScroll: true },
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
        expect(
            within(screen.getByLabelText('Total vouchers')).getByText('0'),
        ).toBeInTheDocument();
    });
});
