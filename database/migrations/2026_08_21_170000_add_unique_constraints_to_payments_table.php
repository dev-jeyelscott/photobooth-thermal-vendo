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
            $table->dropIndex(['maya_payment_id']);
            $table->dropIndex(['maya_checkout_id']);
            $table->unique('maya_payment_id');
            $table->unique('maya_checkout_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique(['maya_payment_id']);
            $table->dropUnique(['maya_checkout_id']);
            $table->index('maya_payment_id');
            $table->index('maya_checkout_id');
        });
    }
};
