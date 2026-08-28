import { Form, Head } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    ChevronRight,
    Info,
    Mail,
    RefreshCw,
    Send,
} from 'lucide-react';
import { useState } from 'react';
import AuthInput from '@/components/auth/auth-input';
import AuthMarketingPanel from '@/components/auth/auth-marketing-panel';
import AuthPageShell from '@/components/auth/auth-page-shell';
import ThermaSnapBrand from '@/components/auth/thermasnap-brand';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { email } from '@/routes/password';

type Props = {
    status?: string;
    passwordResetExpirationMinutes?: number;
};

/**
 * Renders the Fortify password-reset request and success states while keeping
 * the submitted email in preserved Inertia page state for safe resends.
 */
export default function ForgotPassword({
    status,
    passwordResetExpirationMinutes,
}: Props) {
    const [submittedEmail, setSubmittedEmail] = useState('');
    const hasSubmittedEmail = submittedEmail.trim().length > 0;
    const expirationUnit =
        passwordResetExpirationMinutes === 1 ? 'minute' : 'minutes';

    if (status) {
        return (
            <>
                <Head title="Password reset link sent" />

                <AuthPageShell
                    mainClassName="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14"
                    footerClassName="lg:pl-[48%]"
                >
                    <div className="mx-auto grid w-full max-w-[1480px] flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(540px,0.9fr)] xl:gap-16">
                        <AuthMarketingPanel
                            eyebrow="Forgot your password?"
                            title="Password reset link sent"
                            description="We've emailed you a link to reset your password and regain access to your account."
                        />

                        <section className="flex w-full flex-col items-center lg:items-end">
                            <ThermaSnapBrand className="mb-8 lg:hidden" />

                            <Card className="w-full max-w-[650px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                                <CardContent className="p-6 sm:p-8 lg:p-10">
                                    <p role="status" className="sr-only">
                                        {status}
                                    </p>

                                    <div className="text-center">
                                        <div
                                            aria-hidden="true"
                                            className="mx-auto flex size-16 items-center justify-center rounded-full border-[3px] border-success text-success"
                                        >
                                            <Check className="size-8 stroke-[2.4]" />
                                        </div>

                                        <h1 className="mt-7 text-3xl font-semibold tracking-[-0.03em]">
                                            Check your email
                                        </h1>

                                        <p className="mt-4 text-base text-muted-foreground">
                                            We&apos;ve sent a password reset
                                            link to:
                                        </p>

                                        <div className="mx-auto mt-5 flex min-h-14 max-w-md items-center justify-center gap-3 rounded-lg bg-primary/5 px-4 py-3 font-semibold text-foreground">
                                            <Mail
                                                aria-hidden="true"
                                                className="size-5 shrink-0 text-muted-foreground"
                                            />

                                            <span className="min-w-0 break-all">
                                                {hasSubmittedEmail
                                                    ? submittedEmail
                                                    : 'Your email address'}
                                            </span>
                                        </div>

                                        <div className="mt-6 space-y-1 text-base leading-7 text-muted-foreground">
                                            <p>
                                                Click the link in that email to
                                                reset your password.
                                            </p>

                                            {passwordResetExpirationMinutes !==
                                                undefined && (
                                                <p>
                                                    The link will expire in{' '}
                                                    <strong className="font-semibold text-foreground">
                                                        {
                                                            passwordResetExpirationMinutes
                                                        }{' '}
                                                        {expirationUnit}
                                                    </strong>
                                                    .
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-7 flex items-start gap-3 rounded-lg border border-success/20 bg-success-subtle px-4 py-3 text-sm leading-6 text-success-foreground">
                                        <Info
                                            aria-hidden="true"
                                            className="mt-0.5 size-5 shrink-0"
                                        />

                                        <p>
                                            If you don&apos;t see the email,
                                            check your spam or junk folder.
                                            Sometimes it hides there.
                                        </p>
                                    </div>

                                    <Form
                                        {...email.form()}
                                        disableWhileProcessing
                                        className="mt-8"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <input
                                                    type="hidden"
                                                    name="email"
                                                    value={submittedEmail}
                                                    readOnly
                                                />

                                                <InputError
                                                    id="resend-password-reset-email-error"
                                                    message={errors.email}
                                                    className="mb-3 text-center"
                                                />

                                                <Button
                                                    type="submit"
                                                    className="h-12 w-full rounded-lg text-base"
                                                    disabled={
                                                        processing ||
                                                        !hasSubmittedEmail
                                                    }
                                                    data-test="resend-password-reset-link-button"
                                                >
                                                    {processing ? (
                                                        <Spinner aria-hidden="true" />
                                                    ) : (
                                                        <RefreshCw
                                                            aria-hidden="true"
                                                            className="size-4"
                                                        />
                                                    )}
                                                    Resend email
                                                </Button>
                                            </>
                                        )}
                                    </Form>

                                    <div className="mt-8">
                                        <Separator />

                                        <div className="mt-6 text-center">
                                            <TextLink
                                                href={login()}
                                                className="inline-flex items-center gap-2 font-semibold text-primary no-underline hover:underline"
                                            >
                                                <ArrowLeft
                                                    aria-hidden="true"
                                                    className="size-4"
                                                />
                                                Back to login
                                            </TextLink>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    </div>
                </AuthPageShell>
            </>
        );
    }

    return (
        <>
            <Head title="Forgot password" />

            <AuthPageShell mainClassName="items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
                <Card className="w-full max-w-[680px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                    <CardContent className="p-6 sm:p-9 lg:p-12">
                        <div className="text-center">
                            <ThermaSnapBrand className="mx-auto" />

                            <h1 className="mt-10 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                                Forgot your password?
                            </h1>

                            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                                No worries! Enter the email address associated
                                with your account and we&apos;ll send you a link
                                to reset your password.
                            </p>
                        </div>

                        <Form
                            {...email.form()}
                            disableWhileProcessing
                            className="mt-8 grid gap-5"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">
                                            Email address
                                        </Label>

                                        <AuthInput
                                            icon={Mail}
                                            id="email"
                                            type="email"
                                            name="email"
                                            required
                                            autoComplete="email"
                                            autoFocus
                                            placeholder="you@example.com"
                                            value={submittedEmail}
                                            onChange={(event) =>
                                                setSubmittedEmail(
                                                    event.currentTarget.value,
                                                )
                                            }
                                            aria-invalid={
                                                errors.email ? true : undefined
                                            }
                                            aria-describedby={
                                                errors.email
                                                    ? 'forgot-password-email-error'
                                                    : undefined
                                            }
                                        />

                                        <InputError
                                            id="forgot-password-email-error"
                                            message={errors.email}
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="h-12 w-full rounded-lg text-base"
                                        disabled={processing}
                                        data-test="email-password-reset-link-button"
                                    >
                                        {processing ? (
                                            <Spinner aria-hidden="true" />
                                        ) : (
                                            <Send
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                        )}
                                        Email password reset link
                                    </Button>
                                </>
                            )}
                        </Form>

                        <div className="my-8">
                            <Separator />
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 text-center text-base">
                            <span className="text-muted-foreground">
                                Remember your password?
                            </span>

                            <TextLink
                                href={login()}
                                className="inline-flex items-center gap-1 font-semibold text-primary no-underline hover:underline"
                            >
                                Back to login
                                <ChevronRight
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            </TextLink>
                        </div>
                    </CardContent>
                </Card>
            </AuthPageShell>
        </>
    );
}
