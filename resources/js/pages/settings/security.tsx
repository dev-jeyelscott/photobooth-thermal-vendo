import { Form, Head, Link, setLayoutProps, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    KeyRound,
    LockKeyhole,
    Mail,
    MonitorSmartphone,
    ShieldCheck,
} from 'lucide-react';
import { useRef } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import ManageTwoFactor from '@/components/manage-two-factor';
import PasswordInput from '@/components/password-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { edit as editProfile } from '@/routes/profile';
import { edit } from '@/routes/security';
import type { Auth } from '@/types';

type ActiveSession = {
    id: string;
    device: string;
    ipAddress: string | null;
    lastActiveAt: string;
    isCurrent: boolean;
};

type Props = {
    passwordRules: string;
    activeSessions: ActiveSession[] | null;
} & ManagePasskeysProps &
    ManageTwoFactorProps;

type PageProps = {
    auth: Auth;
};

/**
 * Format one persisted Laravel session timestamp for the account-security view.
 */
function formatLastActive(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Unavailable';
    }

    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

/**
 * Render a truthful security fact without implying unsupported monitoring.
 */
function SecurityFact({
    label,
    value,
    positive = false,
}: {
    label: string;
    value: string;
    positive?: boolean;
}) {
    return (
        <div className="flex items-start gap-3">
            <CheckCircle2
                aria-hidden="true"
                className={cn(
                    'mt-0.5 size-4 shrink-0',
                    positive ? 'text-success' : 'text-muted-foreground',
                )}
            />

            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-caption text-muted-foreground">{value}</p>
            </div>
        </div>
    );
}

/**
 * Render ThermaSnap account security using existing Fortify and passkey
 * contracts plus database-backed Laravel session evidence.
 */
export default function Security(props: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    const { auth } = usePage<PageProps>().props;
    const { density } = useAppearance();

    const canManageTwoFactor = props.canManageTwoFactor ?? false;
    const twoFactorEnabled = props.twoFactorEnabled ?? false;
    const canManagePasskeys = props.canManagePasskeys ?? false;
    const passkeys = props.passkeys ?? [];

    const emailVerified = auth.user.email_verified_at !== null;
    const activeSessionCount = props.activeSessions?.length ?? null;

    const workspaceGap = {
        comfortable: 'gap-8',
        balanced: 'gap-6',
        compact: 'gap-4',
    }[density];

    const sectionSpacing = {
        comfortable: 'space-y-6',
        balanced: 'space-y-4',
        compact: 'space-y-3',
    }[density];

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Security settings',
                href: edit(),
            },
        ],
    });

    return (
        <>
            <Head title="Security settings" />

            <main className="p-4 lg:p-6">
                <div className="mx-auto w-full max-w-content">
                    <header className="mb-6">
                        <h1 className="text-display">Security Settings</h1>
                        <p className="mt-2 text-body text-muted-foreground">
                            Manage your password, two-factor authentication,
                            passkeys, sessions, and recovery options.
                        </p>
                    </header>

                    <div
                        className={cn(
                            'grid items-start xl:grid-cols-[minmax(0,1fr)_20rem]',
                            workspaceGap,
                        )}
                    >
                        <div className={sectionSpacing}>
                            <Form
                                {...SecurityController.update.form()}
                                options={{
                                    preserveScroll: true,
                                }}
                                resetOnError={[
                                    'password',
                                    'password_confirmation',
                                    'current_password',
                                ]}
                                resetOnSuccess
                                onError={(errors) => {
                                    if (errors.password) {
                                        passwordInput.current?.focus();
                                    }

                                    if (errors.current_password) {
                                        currentPasswordInput.current?.focus();
                                    }
                                }}
                            >
                                {({ errors, processing }) => (
                                    <Card className="gap-0 py-0 shadow-xs">
                                        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b px-5 py-4">
                                            <div>
                                                <h2 className="text-section-title">
                                                    Password
                                                </h2>
                                                <p className="mt-1 text-caption text-muted-foreground">
                                                    Keep your password unique
                                                    and difficult to guess.
                                                </p>
                                            </div>

                                            <Button
                                                type="submit"
                                                variant="outline"
                                                disabled={processing}
                                                data-test="update-password-button"
                                                className="shrink-0"
                                            >
                                                <LockKeyhole
                                                    aria-hidden="true"
                                                    className="size-4"
                                                />
                                                Change Password
                                            </Button>
                                        </CardHeader>

                                        <CardContent className="grid gap-4 p-5 lg:grid-cols-3">
                                            <div className="grid content-start gap-2">
                                                <Label htmlFor="current_password">
                                                    Current Password
                                                </Label>

                                                <PasswordInput
                                                    id="current_password"
                                                    ref={currentPasswordInput}
                                                    name="current_password"
                                                    autoComplete="current-password"
                                                    placeholder="Enter current password"
                                                    aria-invalid={
                                                        errors.current_password
                                                            ? true
                                                            : undefined
                                                    }
                                                    aria-describedby={
                                                        errors.current_password
                                                            ? 'current-password-error'
                                                            : undefined
                                                    }
                                                />

                                                <InputError
                                                    id="current-password-error"
                                                    message={
                                                        errors.current_password
                                                    }
                                                />
                                            </div>

                                            <div className="grid content-start gap-2">
                                                <Label htmlFor="password">
                                                    New Password
                                                </Label>

                                                <PasswordInput
                                                    id="password"
                                                    ref={passwordInput}
                                                    name="password"
                                                    autoComplete="new-password"
                                                    placeholder="Enter new password"
                                                    passwordrules={
                                                        props.passwordRules
                                                    }
                                                    aria-invalid={
                                                        errors.password
                                                            ? true
                                                            : undefined
                                                    }
                                                    aria-describedby={
                                                        errors.password
                                                            ? 'new-password-error'
                                                            : undefined
                                                    }
                                                />

                                                <InputError
                                                    id="new-password-error"
                                                    message={errors.password}
                                                />
                                            </div>

                                            <div className="grid content-start gap-2">
                                                <Label htmlFor="password_confirmation">
                                                    Confirm New Password
                                                </Label>

                                                <PasswordInput
                                                    id="password_confirmation"
                                                    name="password_confirmation"
                                                    autoComplete="new-password"
                                                    placeholder="Confirm new password"
                                                    passwordrules={
                                                        props.passwordRules
                                                    }
                                                    aria-invalid={
                                                        errors.password_confirmation
                                                            ? true
                                                            : undefined
                                                    }
                                                    aria-describedby={
                                                        errors.password_confirmation
                                                            ? 'confirm-password-error'
                                                            : undefined
                                                    }
                                                />

                                                <InputError
                                                    id="confirm-password-error"
                                                    message={
                                                        errors.password_confirmation
                                                    }
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </Form>

                            {canManageTwoFactor && (
                                <div id="two-factor-recovery">
                                    <Card className="gap-0 py-0 shadow-xs">
                                        <CardContent className="p-5">
                                            <ManageTwoFactor
                                                canManageTwoFactor={
                                                    canManageTwoFactor
                                                }
                                                requiresConfirmation={
                                                    props.requiresConfirmation
                                                }
                                                twoFactorEnabled={
                                                    twoFactorEnabled
                                                }
                                            />
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <h2 className="text-section-title">
                                        Active sessions
                                    </h2>
                                    <p className="mt-1 text-caption text-muted-foreground">
                                        Devices and browsers with authenticated
                                        Laravel sessions for your account.
                                    </p>
                                </CardHeader>

                                <CardContent className="p-0">
                                    {props.activeSessions === null ? (
                                        <div className="p-5 text-sm text-muted-foreground">
                                            Session listing is unavailable for
                                            the configured Laravel session
                                            driver.
                                        </div>
                                    ) : props.activeSessions.length === 0 ? (
                                        <div className="p-5 text-sm text-muted-foreground">
                                            No database-backed account sessions
                                            are currently available to display.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[680px] text-left text-sm">
                                                <thead className="border-b bg-muted/30 text-caption text-muted-foreground">
                                                    <tr>
                                                        <th className="px-5 py-3 font-medium">
                                                            Device / Browser
                                                        </th>
                                                        <th className="px-5 py-3 font-medium">
                                                            IP address
                                                        </th>
                                                        <th className="px-5 py-3 font-medium">
                                                            Last active
                                                        </th>
                                                        <th className="px-5 py-3 text-right font-medium">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y">
                                                    {props.activeSessions.map(
                                                        (session) => (
                                                            <tr
                                                                key={session.id}
                                                            >
                                                                <td className="px-5 py-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <MonitorSmartphone
                                                                            aria-hidden="true"
                                                                            className="size-5 shrink-0 text-muted-foreground"
                                                                        />
                                                                        <span className="font-medium">
                                                                            {
                                                                                session.device
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-3 font-mono text-xs">
                                                                    {session.ipAddress ??
                                                                        'Not available'}
                                                                </td>

                                                                <td className="px-5 py-3">
                                                                    {session.isCurrent ? (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="border-success/30 bg-success-subtle text-success-foreground"
                                                                        >
                                                                            Active
                                                                            now
                                                                        </Badge>
                                                                    ) : (
                                                                        formatLastActive(
                                                                            session.lastActiveAt,
                                                                        )
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-3 text-right">
                                                                    {session.isCurrent ? (
                                                                        <Badge variant="outline">
                                                                            Current
                                                                            session
                                                                        </Badge>
                                                                    ) : (
                                                                        <Form
                                                                            {...SecurityController.destroySession.form(
                                                                                session.id,
                                                                            )}
                                                                            options={{
                                                                                preserveScroll: true,
                                                                            }}
                                                                        >
                                                                            {({
                                                                                processing,
                                                                            }) => (
                                                                                <Button
                                                                                    type="submit"
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    disabled={
                                                                                        processing
                                                                                    }
                                                                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                                >
                                                                                    Revoke
                                                                                </Button>
                                                                            )}
                                                                        </Form>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {canManagePasskeys && (
                                <Card className="gap-0 py-0 shadow-xs">
                                    <CardContent className="p-5">
                                        <ManagePasskeys
                                            canManagePasskeys={
                                                canManagePasskeys
                                            }
                                            passkeys={passkeys}
                                        />
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <h2 className="text-section-title">
                                        Recovery options
                                    </h2>
                                    <p className="mt-1 text-caption text-muted-foreground">
                                        Keep account recovery information
                                        current and protected.
                                    </p>
                                </CardHeader>

                                <CardContent className="divide-y p-0">
                                    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <Mail
                                                aria-hidden="true"
                                                className="mt-0.5 size-5 text-muted-foreground"
                                            />

                                            <div>
                                                <p className="text-sm font-medium">
                                                    Recovery email
                                                </p>
                                                <p className="text-caption text-muted-foreground">
                                                    {auth.user.email}
                                                </p>
                                            </div>

                                            <Badge
                                                variant="outline"
                                                className={
                                                    emailVerified
                                                        ? 'border-success/30 bg-success-subtle text-success-foreground'
                                                        : 'border-warning/30 bg-warning-subtle text-warning-foreground'
                                                }
                                            >
                                                {emailVerified
                                                    ? 'Verified'
                                                    : 'Unverified'}
                                            </Badge>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                        >
                                            <Link href={editProfile()}>
                                                Edit
                                            </Link>
                                        </Button>
                                    </div>

                                    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <KeyRound
                                                aria-hidden="true"
                                                className="mt-0.5 size-5 text-muted-foreground"
                                            />

                                            <div>
                                                <p className="text-sm font-medium">
                                                    Backup codes
                                                </p>
                                                <p className="text-caption text-muted-foreground">
                                                    {twoFactorEnabled
                                                        ? 'Recovery codes are managed by the existing protected 2FA flow.'
                                                        : 'Enable two-factor authentication before recovery codes are available.'}
                                                </p>
                                            </div>
                                        </div>

                                        {twoFactorEnabled && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                asChild
                                            >
                                                <a href="#two-factor-recovery">
                                                    View codes
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <aside className={sectionSpacing}>
                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck
                                            aria-hidden="true"
                                            className="size-5 text-primary"
                                        />
                                        <h2 className="text-section-title">
                                            Security summary
                                        </h2>
                                    </div>
                                </CardHeader>

                                <CardContent className="grid gap-5 p-5">
                                    <SecurityFact
                                        label="Email verification"
                                        value={
                                            emailVerified
                                                ? 'Verified'
                                                : 'Verification required'
                                        }
                                        positive={emailVerified}
                                    />

                                    <SecurityFact
                                        label="Two-factor authentication"
                                        value={
                                            !canManageTwoFactor
                                                ? 'Unavailable'
                                                : twoFactorEnabled
                                                  ? 'Enabled'
                                                  : 'Not enabled'
                                        }
                                        positive={twoFactorEnabled}
                                    />

                                    <SecurityFact
                                        label="Passkeys"
                                        value={
                                            !canManagePasskeys
                                                ? 'Unavailable'
                                                : passkeys.length === 0
                                                  ? 'No passkeys enrolled'
                                                  : `${passkeys.length} enrolled`
                                        }
                                        positive={passkeys.length > 0}
                                    />

                                    <SecurityFact
                                        label="Active sessions"
                                        value={
                                            activeSessionCount === null
                                                ? 'Unavailable'
                                                : `${activeSessionCount} available`
                                        }
                                    />
                                </CardContent>
                            </Card>

                            <Card className="gap-0 py-0 shadow-xs">
                                <CardHeader className="border-b px-5 py-4">
                                    <h2 className="text-section-title">
                                        Security tips
                                    </h2>
                                </CardHeader>

                                <CardContent className="grid gap-4 p-5">
                                    <SecurityFact
                                        label="Use a unique password"
                                        value="Avoid reusing credentials from other services."
                                    />

                                    <SecurityFact
                                        label="Enable 2FA"
                                        value="Add an authenticator-based second factor when available."
                                    />

                                    <SecurityFact
                                        label="Review sessions"
                                        value="Revoke sessions you no longer recognize or use."
                                    />
                                </CardContent>
                            </Card>
                        </aside>
                    </div>
                </div>
            </main>
        </>
    );
}
