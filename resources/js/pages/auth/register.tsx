import { Form, Head } from '@inertiajs/react';
import {
    Activity,
    ArrowRight,
    Lock,
    Mail,
    Printer,
    ShieldCheck,
    User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    passwordRules: string;
};

type RegistrationBenefitProps = {
    icon: LucideIcon;
    title: string;
    description: string;
};

/**
 * Renders one concise operator-platform benefit in the registration marketing
 * panel using the existing ThermaSnap semantic colors.
 */
function RegistrationBenefit({
    icon: Icon,
    title,
    description,
}: RegistrationBenefitProps) {
    return (
        <div className="flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
            </div>

            <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}

/**
 * Renders the Fortify registration flow using the approved ThermaSnap
 * two-column presentation while preserving all server-side registration rules.
 */
export default function Register({ passwordRules }: Props) {
    const passwordDescriptionIds = 'register-password-help';

    return (
        <>
            <Head title="Register" />

            <AuthPageShell mainClassName="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14">
                <div className="mx-auto grid w-full max-w-[1260px] flex-1 items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] xl:gap-20">
                    <section className="hidden min-h-[660px] flex-col justify-between py-5 lg:flex">
                        <div>
                            <ThermaSnapBrand />

                            <div className="mt-20 max-w-md">
                                <h1 className="text-4xl font-semibold tracking-[-0.035em]">
                                    Create your account
                                </h1>

                                <p className="mt-5 max-w-sm text-lg leading-7 text-muted-foreground">
                                    Join the ThermaSnap operator platform and
                                    start managing your photobooth business with
                                    ease.
                                </p>

                                <div className="mt-8 grid gap-5">
                                    <RegistrationBenefit
                                        icon={Activity}
                                        title="Real-time session monitoring"
                                        description="Track sessions and payments as they happen."
                                    />

                                    <RegistrationBenefit
                                        icon={Printer}
                                        title="Print and payment management"
                                        description="Manage templates, payments, and receipts."
                                    />

                                    <RegistrationBenefit
                                        icon={ShieldCheck}
                                        title="Secure and reliable"
                                        description="Your operator account is protected by the application's existing security controls."
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-base text-muted-foreground">
                                Already have an account?
                            </p>

                            <TextLink
                                href={login()}
                                className="mt-2 inline-flex items-center gap-2 font-semibold text-primary no-underline hover:underline"
                            >
                                Back to login
                                <ArrowRight
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            </TextLink>
                        </div>
                    </section>

                    <section className="flex w-full flex-col items-center">
                        <ThermaSnapBrand className="mb-8 lg:hidden" />

                        <Card className="w-full max-w-[600px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                            <CardContent className="p-6 sm:p-8 lg:p-10">
                                <div className="mb-7 lg:hidden">
                                    <h1 className="text-3xl font-semibold tracking-[-0.03em]">
                                        Create your account
                                    </h1>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        Join the ThermaSnap operator platform
                                        and start managing your photobooth.
                                    </p>
                                </div>

                                <Form
                                    {...store.form()}
                                    resetOnSuccess={[
                                        'password',
                                        'password_confirmation',
                                    ]}
                                    disableWhileProcessing
                                    className="grid gap-5"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="name">
                                                    Full name
                                                </Label>

                                                <AuthInput
                                                    icon={User}
                                                    id="name"
                                                    type="text"
                                                    required
                                                    autoFocus
                                                    autoComplete="name"
                                                    name="name"
                                                    placeholder="Enter your full name"
                                                    aria-invalid={
                                                        errors.name
                                                            ? true
                                                            : undefined
                                                    }
                                                    aria-describedby={
                                                        errors.name
                                                            ? 'register-name-error'
                                                            : undefined
                                                    }
                                                />

                                                <InputError
                                                    id="register-name-error"
                                                    message={errors.name}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="email">
                                                    Email address
                                                </Label>

                                                <AuthInput
                                                    icon={Mail}
                                                    id="email"
                                                    type="email"
                                                    required
                                                    autoComplete="email"
                                                    name="email"
                                                    placeholder="Enter your email address"
                                                    aria-invalid={
                                                        errors.email
                                                            ? true
                                                            : undefined
                                                    }
                                                    aria-describedby={
                                                        errors.email
                                                            ? 'register-email-error'
                                                            : undefined
                                                    }
                                                />

                                                <InputError
                                                    id="register-email-error"
                                                    message={errors.email}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="password">
                                                    Password
                                                </Label>

                                                <PasswordInput
                                                    id="password"
                                                    required
                                                    autoComplete="new-password"
                                                    name="password"
                                                    placeholder="Enter a password"
                                                    passwordrules={
                                                        passwordRules
                                                    }
                                                    leadingIcon={Lock}
                                                    className="h-12 rounded-lg bg-background"
                                                    aria-invalid={
                                                        errors.password
                                                            ? true
                                                            : undefined
                                                    }
                                                    aria-describedby={[
                                                        passwordDescriptionIds,
                                                        errors.password
                                                            ? 'register-password-error'
                                                            : null,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' ')}
                                                />

                                                <PasswordRulesHint
                                                    id={passwordDescriptionIds}
                                                    passwordRules={
                                                        passwordRules
                                                    }
                                                />

                                                <InputError
                                                    id="register-password-error"
                                                    message={errors.password}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="password_confirmation">
                                                    Confirm password
                                                </Label>

                                                <PasswordInput
                                                    id="password_confirmation"
                                                    required
                                                    autoComplete="new-password"
                                                    name="password_confirmation"
                                                    placeholder="Confirm your password"
                                                    passwordrules={
                                                        passwordRules
                                                    }
                                                    leadingIcon={Lock}
                                                    className="h-12 rounded-lg bg-background"
                                                    aria-invalid={
                                                        errors.password_confirmation
                                                            ? true
                                                            : undefined
                                                    }
                                                    aria-describedby={
                                                        errors.password_confirmation
                                                            ? 'register-password-confirmation-error'
                                                            : undefined
                                                    }
                                                />

                                                <InputError
                                                    id="register-password-confirmation-error"
                                                    message={
                                                        errors.password_confirmation
                                                    }
                                                />
                                            </div>

                                            <Button
                                                type="submit"
                                                className="mt-1 h-12 w-full rounded-lg text-base"
                                                disabled={processing}
                                                data-test="register-user-button"
                                            >
                                                {processing && <Spinner />}
                                                Create account
                                            </Button>
                                        </>
                                    )}
                                </Form>

                                <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
                                    By creating an account, you agree to the
                                    applicable Terms of Service and Privacy
                                    Policy.
                                </p>

                                <div className="mt-6 text-center lg:hidden">
                                    <span className="text-sm text-muted-foreground">
                                        Already have an account?{' '}
                                    </span>
                                    <TextLink
                                        href={login()}
                                        className="font-semibold text-primary no-underline hover:underline"
                                    >
                                        Back to login
                                    </TextLink>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </AuthPageShell>
        </>
    );
}
