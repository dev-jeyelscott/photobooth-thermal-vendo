import { Form, Head } from '@inertiajs/react';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import AuthInput from '@/components/auth/auth-input';
import AuthPageShell from '@/components/auth/auth-page-shell';
import PasswordRulesHint from '@/components/auth/password-rules-hint';
import ThermaSnapBrand from '@/components/auth/thermasnap-brand';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { update } from '@/routes/password';

type Props = {
    token: string;
    email: string;
    passwordRules: string;
};

/**
 * Renders the Fortify password-reset submission flow while keeping the issued
 * token and authoritative email inside the existing transform contract.
 */
export default function ResetPassword({ token, email, passwordRules }: Props) {
    const passwordHelpId = 'reset-password-help';

    return (
        <>
            <Head title="Reset password" />

            <AuthPageShell mainClassName="items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
                <Card className="w-full max-w-[540px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                    <CardContent className="p-6 sm:p-8 lg:p-10">
                        <div className="text-center">
                            <ThermaSnapBrand className="mx-auto" />

                            <h1 className="mt-9 text-3xl font-semibold tracking-[-0.03em]">
                                Reset password
                            </h1>

                            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                                Enter your email and choose a new password to
                                reset your account.
                            </p>
                        </div>

                        <Form
                            {...update.form()}
                            transform={(data) => ({ ...data, token, email })}
                            resetOnSuccess={[
                                'password',
                                'password_confirmation',
                            ]}
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
                                            autoComplete="email"
                                            value={email}
                                            readOnly
                                            aria-invalid={
                                                errors.email ? true : undefined
                                            }
                                            aria-describedby={
                                                errors.email
                                                    ? 'reset-email-error'
                                                    : undefined
                                            }
                                        />

                                        <InputError
                                            id="reset-email-error"
                                            message={errors.email}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password">
                                            New password
                                        </Label>

                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            required
                                            autoComplete="new-password"
                                            autoFocus
                                            placeholder="Enter new password"
                                            passwordrules={passwordRules}
                                            leadingIcon={Lock}
                                            className="h-12 rounded-lg bg-background"
                                            aria-invalid={
                                                errors.password
                                                    ? true
                                                    : undefined
                                            }
                                            aria-describedby={[
                                                passwordHelpId,
                                                errors.password
                                                    ? 'reset-password-error'
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                        />

                                        <PasswordRulesHint
                                            id={passwordHelpId}
                                            passwordRules={passwordRules}
                                        />

                                        <InputError
                                            id="reset-password-error"
                                            message={errors.password}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation">
                                            Confirm new password
                                        </Label>

                                        <PasswordInput
                                            id="password_confirmation"
                                            name="password_confirmation"
                                            required
                                            autoComplete="new-password"
                                            placeholder="Confirm new password"
                                            passwordrules={passwordRules}
                                            leadingIcon={Lock}
                                            className="h-12 rounded-lg bg-background"
                                            aria-invalid={
                                                errors.password_confirmation
                                                    ? true
                                                    : undefined
                                            }
                                            aria-describedby={
                                                errors.password_confirmation
                                                    ? 'reset-password-confirmation-error'
                                                    : undefined
                                            }
                                        />

                                        <InputError
                                            id="reset-password-confirmation-error"
                                            message={
                                                errors.password_confirmation
                                            }
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="h-12 w-full rounded-lg"
                                        disabled={processing}
                                        data-test="reset-password-button"
                                    >
                                        {processing && <Spinner />}
                                        Reset password
                                    </Button>
                                </>
                            )}
                        </Form>

                        <div className="my-7 flex items-center gap-4">
                            <Separator className="flex-1" />
                            <span className="text-sm text-muted-foreground">
                                or
                            </span>
                            <Separator className="flex-1" />
                        </div>

                        <div className="text-center">
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
                    </CardContent>
                </Card>
            </AuthPageShell>
        </>
    );
}
