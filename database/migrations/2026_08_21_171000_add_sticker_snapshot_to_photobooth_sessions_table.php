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
        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->json('sticker_snapshot')->nullable()->after('template_photo_slots');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photobooth_sessions', function (Blueprint $table) {
            $table->dropColumn('sticker_snapshot');
        });
    }
};
