import { Form, Head } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { KeyRound, LockKeyhole, Shield } from 'lucide-react';
import { useState } from 'react';
import AuthMarketingPanel from '@/components/auth/auth-marketing-panel';
import AuthPageShell from '@/components/auth/auth-page-shell';
import ThermaSnapBrand from '@/components/auth/thermasnap-brand';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';
import { store } from '@/routes/two-factor/login';

type ChallengeMethod = 'authentication' | 'recovery';

/**
 * Render the Fortify two-factor login challenge using the shared ThermaSnap
 * authentication presentation while preserving code and recovery-code contracts.
 */
export default function TwoFactorChallenge() {
    const [method, setMethod] = useState<ChallengeMethod>('authentication');
    const [code, setCode] = useState<string>('');

    const showRecoveryInput = method === 'recovery';

    /**
     * Switch the active challenge method and clear stale validation and OTP state.
     */
    const switchMethod = (
        nextMethod: ChallengeMethod,
        clearErrors: () => void,
    ): void => {
        if (nextMethod === method) {
            return;
        }

        setMethod(nextMethod);
        clearErrors();
        setCode('');
    };

    return (
        <>
            <Head title="Two-factor authentication" />

            <AuthPageShell
                mainClassName="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14"
                footerClassName="lg:pl-[48%]"
            >
                <div className="mx-auto grid w-full max-w-[1480px] flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(500px,0.9fr)] xl:gap-16">
                    <AuthMarketingPanel
                        eyebrow="Welcome back!"
                        title="Two-factor authentication"
                        description="To keep your account secure, enter the code from your authenticator app or use one of your recovery codes."
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
                                        <KeyRound className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-[42%]" />
                                    </div>

                                    <h1 className="mt-7 text-3xl font-semibold tracking-[-0.03em]">
                                        Two-factor authentication
                                    </h1>

                                    <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
                                        Verify your identity using your
                                        authenticator app or a saved recovery
                                        code.
                                    </p>
                                </div>

                                <Form
                                    {...store.form()}
                                    className="mt-8 grid gap-6"
                                    resetOnError
                                    resetOnSuccess={!showRecoveryInput}
                                >
                                    {({ errors, processing, clearErrors }) => (
                                        <>
                                            <ToggleGroup
                                                type="single"
                                                value={method}
                                                aria-label="Authentication method"
                                                className="grid w-full grid-cols-2 gap-1 rounded-lg border border-input bg-muted/40 p-1"
                                                onValueChange={(value) => {
                                                    if (
                                                        value ===
                                                            'authentication' ||
                                                        value === 'recovery'
                                                    ) {
                                                        switchMethod(
                                                            value,
                                                            clearErrors,
                                                        );
                                                    }
                                                }}
                                            >
                                                <ToggleGroupItem
                                                    value="authentication"
                                                    className="h-10 w-full rounded-md px-3 data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-xs"
                                                >
                                                    Authentication code
                                                </ToggleGroupItem>

                                                <ToggleGroupItem
                                                    value="recovery"
                                                    className="h-10 w-full rounded-md px-3 data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-xs"
                                                >
                                                    Recovery code
                                                </ToggleGroupItem>
                                            </ToggleGroup>

                                            {showRecoveryInput ? (
                                                <div className="grid gap-2">
                                                    <Label htmlFor="recovery_code">
                                                        Recovery code
                                                    </Label>

                                                    <Input
                                                        id="recovery_code"
                                                        name="recovery_code"
                                                        type="text"
                                                        required
                                                        autoFocus
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                        disabled={processing}
                                                        placeholder="Enter recovery code"
                                                        className="h-12 rounded-lg bg-background"
                                                        aria-invalid={
                                                            errors.recovery_code
                                                                ? true
                                                                : undefined
                                                        }
                                                        aria-describedby={
                                                            errors.recovery_code
                                                                ? 'two-factor-recovery-help two-factor-recovery-error'
                                                                : 'two-factor-recovery-help'
                                                        }
                                                    />

                                                    <p
                                                        id="two-factor-recovery-help"
                                                        className="text-sm text-muted-foreground"
                                                    >
                                                        Enter one of the
                                                        recovery codes you saved
                                                        when enabling two-factor
                                                        authentication.
                                                    </p>

                                                    <InputError
                                                        id="two-factor-recovery-error"
                                                        message={
                                                            errors.recovery_code
                                                        }
                                                    />
                                                </div>
                                            ) : (
                                                <div className="grid gap-3">
                                                    <Label htmlFor="two-factor-code">
                                                        Enter 6-digit code
                                                    </Label>

                                                    <div className="flex w-full justify-center">
                                                        <InputOTP
                                                            id="two-factor-code"
                                                            name="code"
                                                            maxLength={
                                                                OTP_MAX_LENGTH
                                                            }
                                                            value={code}
                                                            onChange={setCode}
                                                            disabled={
                                                                processing
                                                            }
                                                            pattern={
                                                                REGEXP_ONLY_DIGITS
                                                            }
                                                            inputMode="numeric"
                                                            autoComplete="one-time-code"
                                                            autoFocus
                                                            containerClassName="w-full justify-center"
                                                            aria-label="Authentication code"
                                                            aria-invalid={
                                                                errors.code
                                                                    ? true
                                                                    : undefined
                                                            }
                                                            aria-describedby={
                                                                errors.code
                                                                    ? 'two-factor-code-help two-factor-code-error'
                                                                    : 'two-factor-code-help'
                                                            }
                                                        >
                                                            <InputOTPGroup className="gap-1.5 sm:gap-2">
                                                                {Array.from(
                                                                    {
                                                                        length: OTP_MAX_LENGTH,
                                                                    },
                                                                    (
                                                                        _,
                                                                        index,
                                                                    ) => (
                                                                        <InputOTPSlot
                                                                            key={
                                                                                index
                                                                            }
                                                                            index={
                                                                                index
                                                                            }
                                                                            className="h-11 w-10 rounded-lg border-l border-input bg-background text-lg shadow-xs first:rounded-lg last:rounded-lg sm:h-14 sm:w-14"
                                                                        />
                                                                    ),
                                                                )}
                                                            </InputOTPGroup>
                                                        </InputOTP>
                                                    </div>

                                                    <p
                                                        id="two-factor-code-help"
                                                        className="text-sm text-muted-foreground"
                                                    >
                                                        Use the current code
                                                        shown by your
                                                        authenticator app.
                                                    </p>

                                                    <InputError
                                                        id="two-factor-code-error"
                                                        message={errors.code}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                                                <LockKeyhole
                                                    aria-hidden="true"
                                                    className="mt-1 size-4 shrink-0"
                                                />

                                                <p>
                                                    Your security matters.
                                                    Two-factor authentication
                                                    helps protect your account
                                                    and administrative data.
                                                </p>
                                            </div>

                                            <Button
                                                type="submit"
                                                className="h-12 w-full rounded-lg text-base"
                                                disabled={processing}
                                                data-test="two-factor-challenge-button"
                                            >
                                                {processing && <Spinner />}
                                                Verify
                                            </Button>

                                            <div>
                                                <Separator />

                                                <div className="mt-5 text-center">
                                                    <button
                                                        type="button"
                                                        className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                                                        onClick={() =>
                                                            switchMethod(
                                                                showRecoveryInput
                                                                    ? 'authentication'
                                                                    : 'recovery',
                                                                clearErrors,
                                                            )
                                                        }
                                                        data-test="two-factor-method-toggle"
                                                    >
                                                        {showRecoveryInput
                                                            ? 'Use an authentication code'
                                                            : 'Use a recovery code'}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </AuthPageShell>
        </>
    );
}
