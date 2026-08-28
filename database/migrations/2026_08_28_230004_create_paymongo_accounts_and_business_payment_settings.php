<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add versioned tenant PayMongo accounts and Business account selection.
     */
    public function up(): void
    {
        Schema::create('paymongo_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')
                ->constrained()
                ->restrictOnDelete();
            $table->string('mode', 8);
            $table->text('public_key');
            $table->text('secret_key');
            $table->string('public_key_last4', 4);
            $table->string('secret_key_last4', 4);
            $table->string('webhook_id')->nullable()->index();
            $table->text('webhook_secret')->nullable();
            $table->string('webhook_status')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('webhook_provisioned_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->foreignId('created_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();

            $table->index(['business_id', 'mode']);
        });

        Schema::table('businesses', function (Blueprint $table): void {
            $table->string('active_paymongo_mode', 8)
                ->default('test');

            $table->foreignId('test_paymongo_account_id')
                ->nullable()
                ->constrained('paymongo_accounts')
                ->restrictOnDelete();

            $table->foreignId('live_paymongo_account_id')
                ->nullable()
                ->constrained('paymongo_accounts')
                ->restrictOnDelete();
        });
    }

    /**
     * Remove the tenant PayMongo credential domain.
     */
    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('test_paymongo_account_id');
            $table->dropConstrainedForeignId('live_paymongo_account_id');
            $table->dropColumn('active_paymongo_mode');
        });

        Schema::dropIfExists('paymongo_accounts');
    }
};
