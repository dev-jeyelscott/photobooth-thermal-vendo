<?php

namespace App\Console\Commands;

use App\Actions\Payments\ReconcilePayMongoPayment;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class ReconcilePendingPayMongoPayments extends Command
{
    /**
     * The console command name and bounded recovery options.
     *
     * @var string
     */
    protected $signature = 'payments:reconcile-paymongo
        {--minutes=5 : Minimum pending age before provider reconciliation}
        {--limit=100 : Maximum Payment Intents retrieved per execution}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description =
        'Reconcile pending PayMongo Payment Intents after webhook delivery gaps';

    /**
     * Execute bounded PayMongo Payment Intent reconciliation.
     */
    public function handle(
        ReconcilePayMongoPayment $reconcilePayMongoPayment,
    ): int {
        $minutes = $this->positiveIntegerOption('minutes');
        $limit = $this->positiveIntegerOption('limit');

        if ($minutes === null || $limit === null) {
            $this->error(
                'The --minutes and --limit options must be positive integers.',
            );

            return self::FAILURE;
        }

        $payments = Payment::query()
            ->where('method', PaymentMethod::PayMongoQrPh)
            ->where('status', PaymentStatus::Pending)
            ->whereNotNull('paymongo_account_id')
            ->whereNotNull('paymongo_payment_intent_id')
            ->where('created_at', '<=', now()->subMinutes($minutes))
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $reconciled = 0;
        $failed = 0;

        foreach ($payments as $payment) {
            try {
                $reconcilePayMongoPayment->handle($payment);

                $reconciled++;
            } catch (Throwable $exception) {
                $failed++;

                Log::error(
                    'Pending PayMongo Payment Intent reconciliation failed.',
                    [
                        'payment_id' => $payment->id,
                        'paymongo_account_id' => $payment->paymongo_account_id,
                        'paymongo_payment_intent_id' => $payment->paymongo_payment_intent_id,
                        'exception' => class_basename($exception),
                    ],
                );
            }
        }

        $this->info(
            "Reconciled {$reconciled} PayMongo payment(s), {$failed} failed.",
        );

        return $failed === 0
            ? self::SUCCESS
            : self::FAILURE;
    }

    /**
     * Parse a required positive integer command option.
     */
    private function positiveIntegerOption(string $name): ?int
    {
        $value = $this->option($name);

        if (
            ! is_string($value)
            || ! ctype_digit($value)
            || (int) $value < 1
        ) {
            return null;
        }

        return (int) $value;
    }
}
