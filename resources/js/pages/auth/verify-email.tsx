import { Form, Head, Link, usePage } from '@inertiajs/react';
import { CheckCircle2, Info, LogOut, MailCheck } from 'lucide-react';
import AuthMarketingPanel from '@/components/auth/auth-marketing-panel';
import AuthPageShell from '@/components/auth/auth-page-shell';
import ThermaSnapBrand from '@/components/auth/thermasnap-brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { logout } from '@/routes';
import { send } from '@/routes/verification';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
};

type Props = {
    status?: string;
};

/**
 * Renders the authenticated Fortify email-verification notice and resend
 * workflow using the existing shared authenticated-user Inertia data.
 */
export default function VerifyEmail({ status }: Props) {
    const { auth } = usePage<PageProps>().props;
    const verificationWasResent = status === 'verification-link-sent';

    return (
        <>
            <Head title="Email verification" />

            <AuthPageShell
                mainClassName="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14"
                footerClassName="lg:pl-[48%]"
            >
                <div className="mx-auto grid w-full max-w-[1480px] flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(500px,0.9fr)] xl:gap-16">
                    <AuthMarketingPanel
                        eyebrow="Welcome back!"
                        title="Verify your email"
                        description="We've sent a verification link to your email address. Please check your inbox and confirm to continue."
                    />

                    <section className="flex w-full flex-col items-center lg:items-end">
                        <ThermaSnapBrand className="mb-8 lg:hidden" />

                        <Card className="w-full max-w-[580px] gap-0 rounded-2xl border-border/80 bg-card/95 py-0 shadow-xl backdrop-blur-sm">
                            <CardContent className="p-6 sm:p-8 lg:p-10">
                                <div className="text-center">
                                    <MailCheck
                                        aria-hidden="true"
                                        className="mx-auto size-16 stroke-[1.6] text-primary"
                                    />

                                    <h1 className="mt-7 text-3xl font-semibold tracking-[-0.03em]">
                                        Verify your email
                                    </h1>

                                    <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
                                        We&apos;ve sent a verification link to
                                        your email address. Click the link in
                                        the email to verify your account before
                                        continuing.
                                    </p>
                                </div>

                                <div
                                    role={
                                        verificationWasResent
                                            ? 'status'
                                            : undefined
                                    }
                                    aria-live={
                                        verificationWasResent
                                            ? 'polite'
                                            : undefined
                                    }
                                    className="mt-8 flex items-start gap-4 rounded-lg border border-primary/20 bg-primary/[0.03] px-5 py-4"
                                >
                                    <CheckCircle2
                                        aria-hidden="true"
                                        className="mt-0.5 size-6 shrink-0 text-primary"
                                    />

                                    <div className="min-w-0 text-sm leading-6">
                                        <p className="text-muted-foreground">
                                            {verificationWasResent
                                                ? 'New verification link sent to'
                                                : 'Verification link sent to'}
                                        </p>

                                        <p className="font-semibold break-all text-foreground">
                                            {auth.user.email}
                                        </p>
                                    </div>
                                </div>

                                <Form
                                    {...send.form()}
                                    disableWhileProcessing
                                    className="mt-7"
                                >
                                    {({ processing }) => (
                                        <Button
                                            type="submit"
                                            className="h-12 w-full rounded-lg text-base"
                                            disabled={processing}
                                            data-test="resend-verification-email-button"
                                        >
                                            {processing && <Spinner />}
                                            Resend verification email
                                        </Button>
                                    )}
                                </Form>

                                <div className="my-8 flex items-center gap-4">
                                    <Separator className="flex-1" />

                                    <Link
                                        href={logout()}
                                        method="post"
                                        as="button"
                                        className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                                    >
                                        <LogOut
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                        Log out
                                    </Link>

                                    <Separator className="flex-1" />
                                </div>

                                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-5 py-4 text-sm leading-6 text-muted-foreground">
                                    <Info
                                        aria-hidden="true"
                                        className="mt-0.5 size-5 shrink-0"
                                    />

                                    <p>
                                        Don&apos;t see the email? Check your
                                        Spam or Promotions folder. The link may
                                        take a few minutes to arrive.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </AuthPageShell>
        </>
    );
}
