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
        Schema::table('photo_templates', function (Blueprint $table) {
            $table->index('sort_order');
        });

        Schema::table('sticker_designs', function (Blueprint $table) {
            $table->index('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('photo_templates', function (Blueprint $table) {
            $table->dropIndex(['sort_order']);
        });

        Schema::table('sticker_designs', function (Blueprint $table) {
            $table->dropIndex(['sort_order']);
        });
    }
};
