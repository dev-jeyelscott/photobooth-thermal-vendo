import { Form, Head } from '@inertiajs/react';
import { ArrowLeft, Lock, LockKeyhole, Shield } from 'lucide-react';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import AuthMarketingPanel from '@/components/auth/auth-marketing-panel';
import AuthPageShell from '@/components/auth/auth-page-shell';
import ThermaSnapBrand from '@/components/auth/thermasnap-brand';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/password/confirm';
import { edit as profileEdit } from '@/routes/profile';

/**
 * Renders the Fortify password-confirmation experience using the shared
 * ThermaSnap authentication presentation while preserving passkey confirmation.
 */
export default function ConfirmPassword() {
    return (
        <>
            <Head title="Confirm password" />

            <AuthPageShell
                mainClassName="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14"
                footerClassName="lg:pl-[48%]"
            >
                <div className="mx-auto grid w-full max-w-[1480px] flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(500px,0.9fr)] xl:gap-16">
                    <AuthMarketingPanel
                        eyebrow="Welcome back!"
                        title="Confirm password"
                        description="For your security, please confirm your password to access this secure area."
                    />

                    <section className="flex w-full flex-col items-center lg:items-end">
                        <ThermaSnapBrand className="mb-8 lg:hidden" />

                        <Card className="w-full max-w-[580px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                            <CardContent className="p-6 sm:p-8 lg:p-10">
                                <div className="text-center">
                                    <div
                                        aria-hidden="true"
                                        className="relative mx-auto size-16 text-primary"
                                    >
                                        <Shield className="size-16 stroke-[1.6]" />

                                        <LockKeyhole className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-[42%]" />
                                    </div>

                                    <h1 className="mt-7 text-3xl font-semibold tracking-[-0.03em]">
                                        Confirm password
                                    </h1>

                                    <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
                                        Please confirm your password to continue
                                        to a secure area.
                                    </p>
                                </div>

                                <div className="mt-8">
                                    <PasskeyVerify
                                        routes={{
                                            options: confirmOptions(),
                                            submit: confirmStore(),
                                        }}
                                        label="Confirm with passkey"
                                        loadingLabel="Confirming..."
                                        separator="Or confirm with password"
                                    />
                                </div>

                                <Form
                                    {...store.form()}
                                    resetOnSuccess={['password']}
                                    disableWhileProcessing
                                    className="grid gap-5"
                                >
                                    {({ processing, errors }) => {
                                        const passwordDescription =
                                            errors.password
                                                ? 'confirm-password-security confirm-password-error'
                                                : 'confirm-password-security';

                                        return (
                                            <>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="password">
                                                        Password
                                                    </Label>

                                                    <PasswordInput
                                                        id="password"
                                                        name="password"
                                                        required
                                                        autoFocus
                                                        autoComplete="current-password"
                                                        placeholder="Enter your password"
                                                        leadingIcon={Lock}
                                                        className="h-12 rounded-lg bg-background"
                                                        aria-invalid={
                                                            errors.password
                                                                ? true
                                                                : undefined
                                                        }
                                                        aria-describedby={
                                                            passwordDescription
                                                        }
                                                    />

                                                    <InputError
                                                        id="confirm-password-error"
                                                        message={
                                                            errors.password
                                                        }
                                                    />
                                                </div>

                                                <div
                                                    id="confirm-password-security"
                                                    className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"
                                                >
                                                    <LockKeyhole
                                                        aria-hidden="true"
                                                        className="mt-1 size-4 shrink-0"
                                                    />

                                                    <p>
                                                        Your security matters.
                                                        We use this to help keep
                                                        your account and data
                                                        protected.
                                                    </p>
                                                </div>

                                                <Button
                                                    type="submit"
                                                    className="h-12 w-full rounded-lg text-base"
                                                    disabled={processing}
                                                    data-test="confirm-password-button"
                                                >
                                                    {processing && <Spinner />}
                                                    Confirm password
                                                </Button>
                                            </>
                                        );
                                    }}
                                </Form>

                                <div className="mt-8">
                                    <Separator />

                                    <div className="mt-6 text-center">
                                        <TextLink
                                            href={profileEdit()}
                                            className="inline-flex items-center gap-2 font-semibold text-primary no-underline hover:underline"
                                        >
                                            <ArrowLeft
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                            Back to settings
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
