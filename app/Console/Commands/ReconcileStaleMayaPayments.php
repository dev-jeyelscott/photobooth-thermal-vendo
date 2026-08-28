<?php

namespace App\Console\Commands;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ReconcileStaleMayaPayments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'payments:reconcile-stale-maya {--minutes=15 : Age in minutes before a pending Maya payment requires review}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Flag stale pending Maya payments for operator review without changing their status';

    /**
     * Flag stale legacy Maya payments for operator review without changing
     * payment or session authority.
     */
    public function handle(): int
    {
        $windowMinutes = $this->option('minutes');

        if (
            ! is_string($windowMinutes)
            || ! ctype_digit($windowMinutes)
            || (int) $windowMinutes < 1
        ) {
            $this->error(
                'The --minutes option must be a positive integer.',
            );

            return self::FAILURE;
        }

        $threshold = now()->subMinutes((int) $windowMinutes);
        $flaggedPayments = 0;

        Payment::query()
            ->where('method', PaymentMethod::Maya)
            ->where('status', PaymentStatus::Pending)
            ->where('created_at', '<=', $threshold)
            ->lazyById()
            ->each(
                function (Payment $payment) use (
                    &$flaggedPayments,
                ): void {
                    Log::warning(
                        'Stale Maya payment requires operator review; success remains webhook-authoritative.',
                        [
                            'payment_id' => $payment->id,
                            'maya_checkout_id' => $payment->maya_checkout_id,
                            'maya_payment_id' => $payment->maya_payment_id,
                            'created_at' => $payment
                                ->created_at
                                ?->toIso8601String(),
                        ],
                    );

                    $flaggedPayments++;
                },
            );

        $this->info(
            "Flagged {$flaggedPayments} stale Maya payment(s) for operator review.",
        );

        return self::SUCCESS;
    }
}
