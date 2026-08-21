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
        Schema::create('photo_template_sticker_design', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photo_template_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sticker_design_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['photo_template_id', 'sticker_design_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('photo_template_sticker_design');
    }
};
