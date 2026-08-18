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
        Schema::create('captured_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photobooth_session_id')->constrained()->cascadeOnDelete();
            $table->string('color_path')->nullable();
            $table->string('bw_path')->nullable();
            $table->string('gif_path')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('captured_media');
    }
};
