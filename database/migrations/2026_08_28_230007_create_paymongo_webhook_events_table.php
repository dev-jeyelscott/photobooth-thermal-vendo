<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the durable PayMongo webhook inbox used for idempotent asynchronous processing.
     */
    public function up(): void
    {
        Schema::create('paymongo_webhook_events', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('paymongo_account_id')
                ->constrained('paymongo_accounts')
                ->restrictOnDelete();

            $table->string('provider_event_id')->unique();
            $table->string('event_type')->index();
            $table->boolean('livemode');
            $table->longText('payload');
            $table->char('payload_sha256', 64);
            $table->timestamp('received_at');
            $table->timestamp('processed_at')->nullable()->index();
            $table->timestamp('failed_at')->nullable();
            $table->string('last_error')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Remove the PayMongo webhook inbox.
     */
    public function down(): void
    {
        Schema::dropIfExists('paymongo_webhook_events');
    }
};
