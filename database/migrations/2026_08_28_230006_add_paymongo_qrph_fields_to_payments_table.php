<?php

use App\Enums\PaymentStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add tenant PayMongo payment evidence and enforce one pending attempt per session.
     */
    public function up(): void
    {
        $duplicatePendingSessionId = DB::table('payments')
            ->select('photobooth_session_id')
            ->where('status', PaymentStatus::Pending->value)
            ->groupBy('photobooth_session_id')
            ->havingRaw('COUNT(*) > 1')
            ->value('photobooth_session_id');

        if ($duplicatePendingSessionId !== null) {
            throw new RuntimeException(
                'Cannot enforce one pending payment per session while duplicate pending attempts exist.',
            );
        }

        Schema::table('payments', function (Blueprint $table): void {
            $table->foreignId('paymongo_account_id')
                ->nullable()
                ->constrained('paymongo_accounts')
                ->restrictOnDelete();

            $table->string('currency', 3)->nullable();
            $table->string('provider_idempotency_key')->nullable()->unique();
            $table->string('paymongo_payment_intent_id')->nullable()->unique();
            $table->string('paymongo_payment_method_id')->nullable()->unique();
            $table->string('paymongo_payment_id')->nullable()->unique();
            $table->string('provider_status')->nullable()->index();
            $table->timestamp('provider_expires_at')->nullable()->index();
        });

        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX payments_one_pending_per_session_unique
            ON payments (photobooth_session_id)
            WHERE status = 'pending'
        SQL);
    }

    /**
     * Remove only the PayMongo fields and pending-attempt constraint added by this slice.
     */
    public function down(): void
    {
        DB::statement(
            'DROP INDEX IF EXISTS payments_one_pending_per_session_unique',
        );

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('paymongo_account_id');

            $table->dropColumn([
                'currency',
                'provider_idempotency_key',
                'paymongo_payment_intent_id',
                'paymongo_payment_method_id',
                'paymongo_payment_id',
                'provider_status',
                'provider_expires_at',
            ]);
        });
    }
};
