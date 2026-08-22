<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->timestamp('paid_at')->nullable()->after('status');
            $table->timestamp('failed_at')->nullable()->after('paid_at');
            $table->timestamp('cancelled_at')->nullable()->after('failed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['paid_at', 'failed_at', 'cancelled_at']);
        });
    }
};
