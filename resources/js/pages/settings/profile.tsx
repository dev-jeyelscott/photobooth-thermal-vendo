import { Form, Head, Link, setLayoutProps, usePage } from '@inertiajs/react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useInitials } from '@/hooks/use-initials';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { send } from '@/routes/verification';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
};

type Props = {
    mustVerifyEmail: boolean;
    status?: string;
    canManageTwoFactor: boolean;
    twoFactorEnabled: boolean;
};

/**
 * Format the persisted account creation timestamp using the application's
 * current UTC timezone contract.
 */
function formatMemberSince(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Unavailable';
    }

    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(date);
}

/**
 * Render the authenticated profile management page using only persisted user
 * fields and existing security-management routes.
 */
export default function Profile({
    mustVerifyEmail,
    status,
    canManageTwoFactor,
    twoFactorEnabled,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const getInitials = useInitials();

    const emailVerified = auth.user.email_verified_at !== null;
    const twoFactorLabel = !canManageTwoFactor
        ? 'Unavailable'
        : twoFactorEnabled
          ? 'Enabled'
          : 'Not enabled';

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Profile settings',
                href: edit(),
            },
        ],
    });

    return (
        <>
            <Head title="Profile settings" />

            <main className="mx-auto w-full max-w-content px-page py-section md:px-page-desktop">
                <header className="mb-section">
                    <h1 className="text-display">Profile Settings</h1>
                    <p className="mt-2 text-body text-muted-foreground">
                        Manage your personal information and account security.
                    </p>
                </header>

                <div className="grid gap-section xl:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="space-y-section">
                        <Card className="gap-0 py-0 shadow-xs">
                            <CardHeader className="border-b px-6 py-4">
                                <h2 className="text-section-title">
                                    Profile Information
                                </h2>
                                <p className="text-body text-muted-foreground">
                                    Update the account details currently
                                    supported by ThermaSnap.
                                </p>
                            </CardHeader>

                            <CardContent className="p-6">
                                <Form
                                    {...ProfileController.update.form()}
                                    options={{
                                        preserveScroll: true,
                                    }}
                                    className="grid gap-form"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-6 lg:grid-cols-[7rem_minmax(0,1fr)]">
                                                <div className="flex flex-col items-center gap-3 lg:items-start">
                                                    <Avatar className="size-24 border border-primary/15">
                                                        <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                                                            {getInitials(
                                                                auth.user.name,
                                                            )}
                                                        </AvatarFallback>
                                                    </Avatar>

                                                    <p className="max-w-28 text-center text-caption text-muted-foreground lg:text-left">
                                                        Initials are generated
                                                        from your account name.
                                                    </p>
                                                </div>

                                                <div className="grid gap-5 sm:grid-cols-2">
                                                    <div className="grid gap-field">
                                                        <Label htmlFor="name">
                                                            Full name
                                                        </Label>

                                                        <Input
                                                            id="name"
                                                            name="name"
                                                            required
                                                            autoComplete="name"
                                                            defaultValue={
                                                                auth.user.name
                                                            }
                                                            placeholder="Full name"
                                                            className="h-control-lg"
                                                            aria-invalid={
                                                                errors.name
                                                                    ? true
                                                                    : undefined
                                                            }
                                                            aria-describedby={
                                                                errors.name
                                                                    ? 'profile-name-error'
                                                                    : undefined
                                                            }
                                                        />

                                                        <InputError
                                                            id="profile-name-error"
                                                            message={
                                                                errors.name
                                                            }
                                                        />
                                                    </div>

                                                    <div className="grid gap-field">
                                                        <Label htmlFor="email">
                                                            Email address
                                                        </Label>

                                                        <Input
                                                            id="email"
                                                            name="email"
                                                            type="email"
                                                            required
                                                            autoComplete="username"
                                                            defaultValue={
                                                                auth.user.email
                                                            }
                                                            placeholder="Email address"
                                                            className="h-control-lg"
                                                            aria-invalid={
                                                                errors.email
                                                                    ? true
                                                                    : undefined
                                                            }
                                                            aria-describedby={
                                                                errors.email
                                                                    ? 'profile-email-error'
                                                                    : undefined
                                                            }
                                                        />

                                                        <InputError
                                                            id="profile-email-error"
                                                            message={
                                                                errors.email
                                                            }
                                                        />
                                                    </div>

                                                    {mustVerifyEmail &&
                                                        !emailVerified && (
                                                            <div className="sm:col-span-2">
                                                                <div className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-foreground">
                                                                    <p>
                                                                        Your
                                                                        email
                                                                        address
                                                                        is not
                                                                        verified.{' '}
                                                                        <Link
                                                                            href={send()}
                                                                            as="button"
                                                                            className="font-semibold underline underline-offset-4 hover:no-underline"
                                                                        >
                                                                            Resend
                                                                            verification
                                                                            email
                                                                        </Link>
                                                                        .
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                    {status ===
                                                        'verification-link-sent' && (
                                                        <div
                                                            role="status"
                                                            className="rounded-lg border border-success/30 bg-success-subtle p-4 text-sm font-medium text-success-foreground sm:col-span-2"
                                                        >
                                                            A new verification
                                                            link has been sent
                                                            to your email
                                                            address.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 border-t pt-6">
                                                <Button
                                                    type="submit"
                                                    size="lg"
                                                    disabled={processing}
                                                    data-test="update-profile-button"
                                                >
                                                    {processing && <Spinner />}
                                                    Save changes
                                                </Button>

                                                <Button
                                                    type="button"
                                                    size="lg"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <Link href={edit()}>
                                                        Cancel
                                                    </Link>
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            </CardContent>
                        </Card>

                        <Card className="gap-0 py-0 shadow-xs">
                            <CardHeader className="border-b px-6 py-4">
                                <h2 className="text-section-title">Security</h2>
                                <p className="text-body text-muted-foreground">
                                    Review password and two-factor protection
                                    using the existing security settings.
                                </p>
                            </CardHeader>

                            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                                <section className="flex flex-col justify-between gap-5 rounded-lg border p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                            <KeyRound
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                        </div>

                                        <div>
                                            <h3 className="text-card-title">
                                                Password
                                            </h3>
                                            <p className="mt-1 text-caption text-muted-foreground">
                                                Password changes remain
                                                protected by your current
                                                password.
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-fit"
                                        asChild
                                    >
                                        <Link href={editSecurity()}>
                                            <LockKeyhole
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                            Change password
                                        </Link>
                                    </Button>
                                </section>

                                <section className="flex flex-col justify-between gap-5 rounded-lg border p-4">
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                                    <ShieldCheck
                                                        aria-hidden="true"
                                                        className="size-4"
                                                    />
                                                </div>

                                                <div>
                                                    <h3 className="text-card-title">
                                                        Two-factor
                                                        authentication
                                                    </h3>
                                                </div>
                                            </div>

                                            <Badge
                                                variant="outline"
                                                className={
                                                    twoFactorEnabled &&
                                                    canManageTwoFactor
                                                        ? 'border-success/30 bg-success-subtle text-success-foreground'
                                                        : 'border-border bg-muted text-muted-foreground'
                                                }
                                            >
                                                {twoFactorLabel}
                                            </Badge>
                                        </div>

                                        <p className="mt-3 text-caption text-muted-foreground">
                                            Manage authenticator setup and
                                            recovery codes from Security
                                            settings.
                                        </p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-fit"
                                        asChild
                                    >
                                        <Link href={editSecurity()}>
                                            <ShieldCheck
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                            {canManageTwoFactor
                                                ? twoFactorEnabled
                                                    ? 'Manage 2FA'
                                                    : 'Enable 2FA'
                                                : 'Security settings'}
                                        </Link>
                                    </Button>
                                </section>
                            </CardContent>
                        </Card>

                        <DeleteUser />
                    </div>

                    <aside>
                        <Card className="gap-0 py-0 shadow-xs">
                            <CardHeader className="border-b px-6 py-4">
                                <h2 className="text-section-title">
                                    Account Summary
                                </h2>
                            </CardHeader>

                            <CardContent className="p-6">
                                <dl className="grid gap-5 text-sm">
                                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                                        <dt className="text-muted-foreground">
                                            User ID
                                        </dt>
                                        <dd className="font-medium">
                                            #{auth.user.id}
                                        </dd>
                                    </div>

                                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                                        <dt className="text-muted-foreground">
                                            Member since
                                        </dt>
                                        <dd>
                                            <time
                                                dateTime={auth.user.created_at}
                                                className="font-medium"
                                            >
                                                {formatMemberSince(
                                                    auth.user.created_at,
                                                )}
                                            </time>
                                        </dd>
                                    </div>

                                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
                                        <dt className="text-muted-foreground">
                                            Email
                                        </dt>
                                        <dd>
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
                                        </dd>
                                    </div>

                                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
                                        <dt className="text-muted-foreground">
                                            2FA
                                        </dt>
                                        <dd>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    twoFactorEnabled &&
                                                    canManageTwoFactor
                                                        ? 'border-success/30 bg-success-subtle text-success-foreground'
                                                        : 'border-border bg-muted text-muted-foreground'
                                                }
                                            >
                                                {twoFactorLabel}
                                            </Badge>
                                        </dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </main>
        </>
    );
}
