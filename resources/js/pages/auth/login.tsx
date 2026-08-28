import { Form, Head } from '@inertiajs/react';
import { AlertCircle, Lock, LockKeyhole, Mail, Shield } from 'lucide-react';
import AuthInput from '@/components/auth/auth-input';
import AuthMarketingPanel from '@/components/auth/auth-marketing-panel';
import AuthPageShell from '@/components/auth/auth-page-shell';
import ThermaSnapBrand from '@/components/auth/thermasnap-brand';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

/**
 * Renders the ThermaSnap login experience while preserving Fortify,
 * passkey, remember-me, validation, and Wayfinder contracts.
 */
export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Log in" />

            <AuthPageShell
                mainClassName="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14"
                footerClassName="lg:pl-[48%]"
            >
                <div className="mx-auto grid w-full max-w-[1480px] flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(540px,0.9fr)] xl:gap-16">
                    <AuthMarketingPanel
                        eyebrow="Welcome back!"
                        title="Log in"
                        description="Sign in to access your account, orders, and photo memories."
                    />

                    <section className="flex w-full flex-col items-center lg:items-end">
                        <ThermaSnapBrand className="mb-8 lg:hidden" />

                        <Card className="w-full max-w-[650px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                            <CardContent className="p-6 sm:p-8 lg:p-10">
                                <Form
                                    {...store.form()}
                                    resetOnSuccess={['password']}
                                    disableWhileProcessing
                                >
                                    {({ processing, errors }) => {
                                        const hasAuthenticationErrors = Boolean(
                                            errors.email || errors.password,
                                        );

                                        return (
                                            <>
                                                <div className="mb-7 text-center">
                                                    <div
                                                        aria-hidden="true"
                                                        className="relative mx-auto size-16 text-primary"
                                                    >
                                                        <Shield className="size-16 stroke-[1.6]" />

                                                        <LockKeyhole className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-[42%]" />
                                                    </div>

                                                    <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] lg:sr-only">
                                                        Log in
                                                    </h1>
                                                </div>

                                                {status &&
                                                    !hasAuthenticationErrors && (
                                                        <div
                                                            role="status"
                                                            className="mb-6 rounded-lg border border-success/20 bg-success-subtle px-4 py-3 text-sm font-medium text-success-foreground"
                                                        >
                                                            {status}
                                                        </div>
                                                    )}

                                                {hasAuthenticationErrors && (
                                                    <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                                                        <AlertCircle
                                                            aria-hidden="true"
                                                            className="mt-0.5 size-5 shrink-0"
                                                        />

                                                        <p role="alert">
                                                            We couldn&apos;t
                                                            sign you in. Please
                                                            check your email or
                                                            password.
                                                        </p>
                                                    </div>
                                                )}

                                                <PasskeyVerify />

                                                <div className="grid gap-5">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="email">
                                                            Email
                                                        </Label>

                                                        <AuthInput
                                                            icon={Mail}
                                                            id="email"
                                                            type="email"
                                                            name="email"
                                                            required
                                                            autoFocus
                                                            autoComplete="email"
                                                            placeholder="you@example.com"
                                                            className="text-base md:text-base"
                                                            aria-invalid={
                                                                errors.email
                                                                    ? true
                                                                    : undefined
                                                            }
                                                            aria-describedby={
                                                                errors.email
                                                                    ? 'login-email-error'
                                                                    : undefined
                                                            }
                                                        />

                                                        <InputError
                                                            id="login-email-error"
                                                            message={
                                                                errors.email
                                                            }
                                                        />
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label htmlFor="password">
                                                            Password
                                                        </Label>

                                                        <PasswordInput
                                                            id="password"
                                                            name="password"
                                                            required
                                                            autoComplete="current-password"
                                                            placeholder="Enter your password"
                                                            leadingIcon={Lock}
                                                            className="h-12 rounded-lg bg-background text-base md:text-base"
                                                            aria-invalid={
                                                                errors.password
                                                                    ? true
                                                                    : undefined
                                                            }
                                                            aria-describedby={
                                                                errors.password
                                                                    ? 'login-password-error'
                                                                    : undefined
                                                            }
                                                        />

                                                        <InputError
                                                            id="login-password-error"
                                                            message={
                                                                errors.password
                                                            }
                                                        />
                                                    </div>

                                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <Checkbox
                                                                id="remember"
                                                                name="remember"
                                                            />

                                                            <Label
                                                                htmlFor="remember"
                                                                className="cursor-pointer font-normal"
                                                            >
                                                                Remember me
                                                            </Label>
                                                        </div>

                                                        {canResetPassword && (
                                                            <TextLink
                                                                href={request()}
                                                                className="font-semibold text-primary no-underline hover:underline"
                                                            >
                                                                Forgot password?
                                                            </TextLink>
                                                        )}
                                                    </div>

                                                    <Button
                                                        type="submit"
                                                        className="mt-1 h-12 w-full rounded-lg text-base"
                                                        disabled={processing}
                                                        data-test="login-button"
                                                    >
                                                        {processing && (
                                                            <Spinner aria-hidden="true" />
                                                        )}
                                                        Log in
                                                    </Button>
                                                </div>

                                                <div className="mt-8">
                                                    <Separator />

                                                    <p className="mt-6 text-center text-sm text-muted-foreground">
                                                        Don&apos;t have an
                                                        account?{' '}
                                                        <TextLink
                                                            href={register()}
                                                            className="font-semibold text-primary no-underline hover:underline"
                                                        >
                                                            Create account
                                                        </TextLink>
                                                    </p>
                                                </div>
                                            </>
                                        );
                                    }}
                                </Form>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </AuthPageShell>
        </>
    );
}
