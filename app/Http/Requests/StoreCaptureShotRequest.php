<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreCaptureShotRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'shot' => [
                'required',
                'file',
                'mimes:jpeg,png',
                'max:'.(int) config('photobooth.captured_photo_max_kilobytes'),
            ],
        ];
    }
}
