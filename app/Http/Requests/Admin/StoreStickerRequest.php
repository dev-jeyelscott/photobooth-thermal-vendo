<?php

namespace App\Http\Requests\Admin;

use App\Concerns\StickerValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreStickerRequest extends FormRequest
{
    use StickerValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->stickerRules(assetRequired: true);
    }
}
