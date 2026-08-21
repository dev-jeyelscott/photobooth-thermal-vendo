<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['maintenance_mode' => $this->boolean('maintenance_mode')]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'session_price' => ['required', 'numeric', 'min:0.01'],
            'currency' => ['required', 'string', 'size:3'],
            'countdown_seconds' => ['required', 'integer', 'min:1', 'max:10'],
            'capture_shot_count' => ['required', 'integer', 'min:1', 'max:10'],
            'retake_limit' => ['required', 'integer', 'min:1'],
            'kiosk_idle_timeout_seconds' => ['required', 'integer', 'min:1'],
            'session_timeout_seconds' => ['required', 'integer', 'min:1'],
            'gallery_expiration_hours' => ['required', 'integer', 'min:1'],
            'gif_frame_duration_ms' => ['required', 'integer', 'min:1'],
            'default_printer' => ['required', 'string', 'max:255'],
            'booth_display_name' => ['required', 'string', 'max:255'],
            'receipt_header' => ['nullable', 'string', 'max:255'],
            'receipt_footer' => ['nullable', 'string', 'max:255'],
            'maintenance_mode' => ['required', 'boolean'],
            'maintenance_message' => ['nullable', 'string', 'max:500', 'required_if:maintenance_mode,true'],
        ];
    }
}
