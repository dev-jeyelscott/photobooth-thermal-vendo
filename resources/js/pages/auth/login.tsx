import { Form, Head } from '@inertiajs/react';
import { Lock, Mail } from 'lucide-react';
import AuthInput from '@/components/auth/auth-input';
import AuthPageShell from '@/components/auth/auth-page-shell';
import ThermaSnapBrand, {
    ThermaSnapMark,
} from '@/components/auth/thermasnap-brand';
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
import { cn } from '@/lib/utils';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

const PHOTO_ASSET = '/images/welcome/photostrip-photo.png';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

type PhotoStripProps = {
    className?: string;
};

type ThermaSnapPrinterProps = {
    className?: string;
};

/**
 * Renders a decorative three-frame photostrip from the approved local
 * customer-photo asset.
 */
function PhotoStrip({ className }: PhotoStripProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-1.5 rounded-md bg-white p-1.5 shadow-lg',
                className,
            )}
        >
            {[0, 1, 2].map((frame) => (
                <div
                    key={frame}
                    className="aspect-[1.05] overflow-hidden rounded-[2px] bg-muted"
                >
                    <img
                        src={PHOTO_ASSET}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                    />
                </div>
            ))}

            <div className="pt-0.5 text-center text-[7px] font-bold text-primary">
                ThermaSnap
            </div>
        </div>
    );
}

/**
 * Renders the non-interactive thermal photobooth illustration used in the
 * desktop login marketing panel.
 */
function ThermaSnapPrinter({ className }: ThermaSnapPrinterProps) {
    return (
        <div aria-hidden="true" className={cn('relative h-56 w-72', className)}>
            <div className="absolute inset-x-0 top-0 bottom-8 rounded-t-[2.25rem] rounded-b-xl border border-primary/15 bg-primary/10 shadow-xl">
                <div className="absolute top-10 left-1/2 -translate-x-1/2">
                    <ThermaSnapMark className="size-11" />
                </div>

                <div className="absolute bottom-12 left-1/2 h-4 w-36 -translate-x-1/2 rounded-md bg-foreground/80 shadow-inner" />
            </div>

            <div className="absolute top-[78%] left-1/2 w-32 -translate-x-1/2 rounded-b-md bg-white p-2 shadow-md">
                <img
                    src={PHOTO_ASSET}
                    alt=""
                    draggable={false}
                    className="aspect-[1.45] w-full object-cover"
                />
                <div className="mt-1.5 text-center text-[7px] font-bold text-primary">
                    ThermaSnap
                </div>
            </div>
        </div>
    );
}

/**
 * Renders the ThermaSnap operator login while preserving the existing Fortify,
 * passkey, remember-me, validation, and Wayfinder submission contracts.
 */
export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Log in" />

            <AuthPageShell
                mainClassName="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14"
                footerClassName="lg:pl-[48%]"
            >
                <div className="mx-auto grid w-full max-w-[1480px] flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(500px,0.9fr)] xl:gap-16">
                    <section className="hidden min-h-[720px] flex-col justify-between py-6 lg:flex">
                        <div>
                            <ThermaSnapBrand />

                            <div className="mt-20 max-w-xl">
                                <p className="text-sm font-semibold text-primary">
                                    Welcome back!
                                </p>

                                <h2 className="mt-5 text-5xl leading-[1.08] font-semibold tracking-[-0.04em] text-balance xl:text-[3.4rem]">
                                    Log in to your ThermaSnap account
                                </h2>

                                <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                                    Access your dashboard to manage sessions,
                                    payments, reports, and more.
                                </p>
                            </div>
                        </div>

                        <div
                            aria-hidden="true"
                            className="relative h-[310px] w-full max-w-[620px]"
                        >
                            <div className="absolute -bottom-14 -left-12 size-80 rounded-full bg-primary/5" />

                            <PhotoStrip className="absolute bottom-3 left-1 z-20 w-[7.5rem] -rotate-6" />
                            <PhotoStrip className="absolute bottom-7 left-24 z-10 w-[7.5rem] rotate-3" />

                            <ThermaSnapPrinter className="absolute right-5 bottom-0 z-10" />

                            <div
                                className="absolute right-4 bottom-36 h-28 w-36 text-primary/10"
                                style={{
                                    backgroundImage:
                                        'radial-gradient(currentColor 1.3px, transparent 1.3px)',
                                    backgroundSize: '13px 13px',
                                }}
                            />
                        </div>
                    </section>

                    <section className="flex w-full flex-col items-center lg:items-end">
                        <ThermaSnapBrand className="mb-8 lg:hidden" />

                        <Card className="w-full max-w-[580px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                            <CardContent className="p-6 sm:p-8 lg:p-10">
                                <div className="mb-7">
                                    <h1 className="text-3xl font-semibold tracking-[-0.03em]">
                                        Sign in
                                    </h1>

                                    <p className="mt-2 text-base text-muted-foreground">
                                        Enter your email and password to
                                        continue
                                    </p>
                                </div>

                                {status && (
                                    <div
                                        role="status"
                                        className="mb-6 rounded-lg border border-success/20 bg-success-subtle px-4 py-3 text-sm font-medium text-success-foreground"
                                    >
                                        {status}
                                    </div>
                                )}

                                <PasskeyVerify />

                                <Form
                                    {...store.form()}
                                    resetOnSuccess={['password']}
                                    disableWhileProcessing
                                    className="grid gap-5"
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
                                                    autoFocus
                                                    autoComplete="email"
                                                    placeholder="you@company.com"
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
                                                    message={errors.email}
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
                                                    className="h-12 rounded-lg bg-background"
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
                                                    message={errors.password}
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
                                                {processing && <Spinner />}
                                                Log in
                                            </Button>
                                        </>
                                    )}
                                </Form>

                                <div className="mt-8 flex items-center gap-4">
                                    <Separator className="flex-1" />
                                    <span className="text-sm whitespace-nowrap text-muted-foreground">
                                        Don&apos;t have an account?
                                    </span>
                                    <Separator className="flex-1" />
                                </div>

                                <div className="mt-5 text-center">
                                    <TextLink
                                        href={register()}
                                        className="font-semibold text-primary no-underline hover:underline"
                                    >
                                        Create an account
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
