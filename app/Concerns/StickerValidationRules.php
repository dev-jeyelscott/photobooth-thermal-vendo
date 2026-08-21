<?php

namespace App\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;

trait StickerValidationRules
{
    /**
     * Get the validation rules shared by sticker create and update requests.
     *
     * @param  bool  $assetRequired  Whether the sticker asset must be uploaded.
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function stickerRules(bool $assetRequired = true): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'asset' => [$assetRequired ? 'required' : 'sometimes', 'image', 'max:5120'],
            'thumbnail' => ['nullable', 'image', 'max:5120'],
            'active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'placement' => ['nullable', 'json'],
            'template_ids' => ['sometimes', 'array'],
            'template_ids.*' => ['integer', 'exists:photo_templates,id'],
        ];
    }
}
