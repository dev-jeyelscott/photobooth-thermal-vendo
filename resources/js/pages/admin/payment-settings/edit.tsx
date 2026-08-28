import { Form, Head, setLayoutProps } from '@inertiajs/react';
import {
    CheckCircle2,
    KeyRound,
    RefreshCw,
    RotateCcw,
    ShieldCheck,
} from 'lucide-react';
import PaymentSettingController from '@/actions/App/Http/Controllers/Admin/PaymentSettingController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/admin/payment-settings';

type PayMongoMode = 'test' | 'live';

export type PayMongoAccountSummary = {
    mode: PayMongoMode;
    configured: boolean;
    webhookReady: boolean;
    maskedPublicKey: string | null;
    maskedSecretKey: string | null;
    verifiedAt: string | null;
    webhookStatus: string | null;
    webhookProvisionedAt: string | null;
    supersededAt: string | null;
};

type PaymentSettingsProps = {
    businessName: string;
    activeMode: PayMongoMode;
    accounts: Record<PayMongoMode, PayMongoAccountSummary>;
};

/**
 * Format an ISO timestamp for concise operator-facing status copy.
 */
function formatTimestamp(value: string | null): string {
    if (value === null) {
        return 'Never';
    }

    return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

/**
 * Render one independent Test or Live tenant credential workspace.
 */
function PayMongoModePanel({
    mode,
    account,
    activeMode,
}: {
    mode: PayMongoMode;
    account: PayMongoAccountSummary;
    activeMode: PayMongoMode;
}) {
    const label = mode === 'test' ? 'Test' : 'Live';
    const isActive = activeMode === mode;
    const connectionErrorKey = `${mode}_connection`;
    const webhookErrorKey = `${mode}_webhook`;
    const activationErrorKey = `${mode}_activation`;

    return (
        <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-xs">
            <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-card-title">{label} credentials</h2>
                        {isActive && (
                            <Badge
                                variant="outline"
                                className="border-primary/30 bg-primary/10 text-primary"
                            >
                                Active mode
                            </Badge>
                        )}
                    </div>
                    <p className="mt-1 text-caption text-muted-foreground">
                        {mode === 'test'
                            ? 'Use PayMongo sandbox credentials without moving real money.'
                            : 'Use production credentials only after the PayMongo account is ready for live transactions.'}
                    </p>
                </div>

                {account.webhookReady ? (
                    <Badge
                        variant="outline"
                        className="w-fit border-success/30 bg-success-subtle text-success-foreground"
                    >
                        <CheckCircle2 aria-hidden="true" />
                        Ready
                    </Badge>
                ) : account.verifiedAt ? (
                    <Badge
                        variant="outline"
                        className="w-fit border-warning/30 bg-warning-subtle text-warning-foreground"
                    >
                        Webhook required
                    </Badge>
                ) : account.configured ? (
                    <Badge
                        variant="outline"
                        className="w-fit border-warning/30 bg-warning-subtle text-warning-foreground"
                    >
                        Verification required
                    </Badge>
                ) : (
                    <Badge variant="outline" className="w-fit">
                        Not configured
                    </Badge>
                )}
            </header>

            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0 space-y-5">
                    <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                        <div>
                            <p className="text-caption text-muted-foreground">
                                Current public key
                            </p>
                            <p className="mt-1 font-mono text-sm break-all">
                                {account.maskedPublicKey ?? 'Not configured'}
                            </p>
                        </div>

                        <div>
                            <p className="text-caption text-muted-foreground">
                                Current secret key
                            </p>
                            <p className="mt-1 font-mono text-sm break-all">
                                {account.maskedSecretKey ?? 'Not configured'}
                            </p>
                        </div>

                        <div>
                            <p className="text-caption text-muted-foreground">
                                Last verified
                            </p>
                            <p className="mt-1 text-sm font-medium">
                                {formatTimestamp(account.verifiedAt)}
                            </p>
                        </div>

                        <div>
                            <p className="text-caption text-muted-foreground">
                                Webhook
                            </p>
                            <p className="mt-1 text-sm font-medium">
                                {account.webhookProvisionedAt
                                    ? (account.webhookStatus ?? 'Provisioned')
                                    : 'Not provisioned'}
                            </p>
                        </div>
                    </div>

                    <Form
                        {...PaymentSettingController.replace.form(mode)}
                        options={{ preserveScroll: true }}
                        className="grid gap-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div>
                                    <h3 className="text-sm font-medium">
                                        {account.configured
                                            ? 'Replace credentials'
                                            : 'Configure credentials'}
                                    </h3>
                                    <p className="mt-1 text-caption text-muted-foreground">
                                        Saving verifies the account, provisions
                                        its dedicated webhook, then selects the
                                        new credential version.
                                    </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-field">
                                        <Label htmlFor={`${mode}-public-key`}>
                                            {label} public key
                                        </Label>
                                        <Input
                                            id={`${mode}-public-key`}
                                            name="public_key"
                                            type="password"
                                            autoComplete="off"
                                            required
                                            placeholder={
                                                mode === 'test'
                                                    ? 'pk_test_...'
                                                    : 'pk_live_...'
                                            }
                                            aria-invalid={!!errors.public_key}
                                            aria-describedby={
                                                errors.public_key
                                                    ? `${mode}-public-key-error`
                                                    : undefined
                                            }
                                        />
                                        <InputError
                                            id={`${mode}-public-key-error`}
                                            message={errors.public_key}
                                        />
                                    </div>

                                    <div className="grid gap-field">
                                        <Label htmlFor={`${mode}-secret-key`}>
                                            {label} secret key
                                        </Label>
                                        <Input
                                            id={`${mode}-secret-key`}
                                            name="secret_key"
                                            type="password"
                                            autoComplete="new-password"
                                            required
                                            placeholder={
                                                mode === 'test'
                                                    ? 'sk_test_...'
                                                    : 'sk_live_...'
                                            }
                                            aria-invalid={!!errors.secret_key}
                                            aria-describedby={
                                                errors.secret_key
                                                    ? `${mode}-secret-key-error`
                                                    : undefined
                                            }
                                        />
                                        <InputError
                                            id={`${mode}-secret-key-error`}
                                            message={errors.secret_key}
                                        />
                                    </div>
                                </div>

                                <InputError
                                    id={`${mode}-connection-error`}
                                    message={errors[connectionErrorKey]}
                                />

                                <div>
                                    <Button type="submit" disabled={processing}>
                                        <RotateCcw aria-hidden="true" />
                                        {processing
                                            ? 'Provisioning...'
                                            : account.configured
                                              ? 'Replace credentials'
                                              : 'Save credentials'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </div>

                <aside className="grid content-start gap-3">
                    <Form
                        {...PaymentSettingController.test.form(mode)}
                        options={{ preserveScroll: true }}
                    >
                        {({ processing, errors }) => (
                            <div className="grid gap-2">
                                <Button
                                    type="submit"
                                    variant="outline"
                                    className="w-full"
                                    disabled={processing || !account.configured}
                                >
                                    <ShieldCheck aria-hidden="true" />
                                    {processing
                                        ? 'Testing...'
                                        : 'Test connection'}
                                </Button>

                                <InputError
                                    message={errors[connectionErrorKey]}
                                />
                            </div>
                        )}
                    </Form>

                    <Form
                        {...PaymentSettingController.reprovision.form(mode)}
                        options={{ preserveScroll: true }}
                    >
                        {({ processing, errors }) => (
                            <div className="grid gap-2">
                                <Button
                                    type="submit"
                                    variant="outline"
                                    className="w-full"
                                    disabled={processing || !account.configured}
                                >
                                    <RefreshCw aria-hidden="true" />
                                    {processing
                                        ? 'Recovering...'
                                        : 'Recover webhook'}
                                </Button>

                                <InputError message={errors[webhookErrorKey]} />
                            </div>
                        )}
                    </Form>

                    <Form
                        {...PaymentSettingController.activate.form(mode)}
                        options={{ preserveScroll: true }}
                    >
                        {({ processing, errors }) => (
                            <div className="grid gap-2">
                                <Button
                                    type="submit"
                                    variant={isActive ? 'outline' : 'default'}
                                    className="w-full"
                                    disabled={
                                        processing ||
                                        isActive ||
                                        !account.webhookReady
                                    }
                                >
                                    <KeyRound aria-hidden="true" />
                                    {isActive
                                        ? 'Active mode'
                                        : processing
                                          ? 'Activating...'
                                          : `Activate ${label}`}
                                </Button>

                                <InputError
                                    message={errors[activationErrorKey]}
                                />
                            </div>
                        )}
                    </Form>

                    <p className="text-caption leading-relaxed text-muted-foreground">
                        Credential replacement, webhook recovery, and
                        environment activation require recent password
                        confirmation where sensitive state changes occur.
                    </p>
                </aside>
            </div>
        </Card>
    );
}

/**
 * Render the owner-only tenant PayMongo configuration workspace.
 */
export default function PaymentSettingsEdit({
    businessName,
    activeMode,
    accounts,
}: PaymentSettingsProps) {
    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Payment settings',
                href: edit(),
            },
        ],
    });

    return (
        <>
            <Head title="Payment settings" />

            <main className="p-4 lg:p-6">
                <div className="mx-auto grid w-full gap-6">
                    <header>
                        <h1 className="text-page-title">Payment settings</h1>
                        <p className="mt-1 text-body text-muted-foreground">
                            Manage PayMongo QR Ph credentials for{' '}
                            <strong className="font-medium text-foreground">
                                {businessName}
                            </strong>
                            . ThermaSnap platform billing credentials are
                            isolated and are never used as a booth-payment
                            fallback.
                        </p>
                    </header>

                    <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-xs">
                        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
                            <div>
                                <p className="text-caption text-muted-foreground">
                                    Active environment
                                </p>
                                <div className="mt-2">
                                    <Badge
                                        variant="outline"
                                        className={
                                            activeMode === 'live'
                                                ? 'border-warning/30 bg-warning-subtle text-warning-foreground'
                                                : 'border-info/30 bg-info-subtle text-info-foreground'
                                        }
                                    >
                                        {activeMode === 'test'
                                            ? 'Test'
                                            : 'Live'}
                                    </Badge>
                                </div>
                            </div>

                            <div>
                                <p className="text-caption text-muted-foreground">
                                    Test account
                                </p>
                                <p className="mt-2 text-sm font-medium">
                                    {accounts.test.webhookReady
                                        ? 'Ready'
                                        : accounts.test.verifiedAt
                                          ? 'Webhook required'
                                          : accounts.test.configured
                                            ? 'Needs verification'
                                            : 'Not configured'}
                                </p>
                            </div>

                            <div>
                                <p className="text-caption text-muted-foreground">
                                    Live account
                                </p>
                                <p className="mt-2 text-sm font-medium">
                                    {accounts.live.webhookReady
                                        ? 'Ready'
                                        : accounts.live.verifiedAt
                                          ? 'Webhook required'
                                          : accounts.live.configured
                                            ? 'Needs verification'
                                            : 'Not configured'}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <PayMongoModePanel
                        mode="test"
                        account={accounts.test}
                        activeMode={activeMode}
                    />

                    <PayMongoModePanel
                        mode="live"
                        account={accounts.live}
                        activeMode={activeMode}
                    />
                </div>
            </main>
        </>
    );
}
