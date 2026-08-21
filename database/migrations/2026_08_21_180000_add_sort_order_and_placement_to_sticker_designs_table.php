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
        Schema::table('sticker_designs', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('active');
            $table->json('placement')->nullable()->after('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sticker_designs', function (Blueprint $table) {
            $table->dropColumn(['sort_order', 'placement']);
        });
    }
};
