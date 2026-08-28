<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the owning business boundary to durable photobooth sessions.
     */
    public function up(): void
    {
        Schema::table('photobooth_sessions', function (Blueprint $table): void {
            $table->foreignId('business_id')
                ->nullable()
                ->after('id')
                ->index()
                ->constrained('businesses')
                ->restrictOnDelete();
        });
    }

    /**
     * Remove the business ownership reference from photobooth sessions.
     */
    public function down(): void
    {
        Schema::table('photobooth_sessions', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('business_id');
        });
    }
};
