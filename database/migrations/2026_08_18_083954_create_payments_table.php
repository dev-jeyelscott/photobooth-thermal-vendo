<?php

use App\Enums\PaymentStatus;
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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photobooth_session_id')->constrained()->cascadeOnDelete();
            $table->string('method');
            $table->string('status')->default(PaymentStatus::Pending->value)->index();
            $table->string('maya_payment_id')->nullable()->index();
            $table->string('maya_checkout_id')->nullable()->index();
            $table->decimal('amount', 10, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
