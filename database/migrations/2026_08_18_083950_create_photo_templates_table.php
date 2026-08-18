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
        Schema::create('photo_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('layout_path');
            $table->string('thumbnail_path')->nullable();
            $table->unsignedTinyInteger('photo_slots')->default(1);
            $table->boolean('active')->default(true)->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('photo_templates');
    }
};
