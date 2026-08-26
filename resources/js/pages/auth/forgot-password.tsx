import { Form, Head } from '@inertiajs/react';
import { ChevronRight, Mail, Send } from 'lucide-react';
import AuthInput from '@/components/auth/auth-input';
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

/**
 * Renders the existing Fortify password-reset request flow inside the supplied
 * centered ThermaSnap authentication design.
 */
export default function ForgotPassword({ status }: { status?: string }) {
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

                        {status && (
                            <div
                                role="status"
                                className="mt-7 rounded-lg border border-success/20 bg-success-subtle px-4 py-3 text-sm font-medium text-success-foreground"
                            >
                                {status}
                            </div>
                        )}

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
                                            <Spinner />
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
