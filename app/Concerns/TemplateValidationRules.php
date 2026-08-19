<?php

namespace App\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;

trait TemplateValidationRules
{
    /**
     * Get the validation rules shared by template create and update requests.
     *
     * @param  bool  $layoutRequired  Whether the layout asset must be uploaded.
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function templateRules(bool $layoutRequired = true): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'layout' => [$layoutRequired ? 'required' : 'sometimes', 'image', 'max:5120'],
            'thumbnail' => ['nullable', 'image', 'max:5120'],
            'photo_slots' => ['required', 'integer', 'min:1'],
            'print_width_mm' => ['required', 'integer', 'min:1'],
            'print_height_mm' => ['required', 'integer', 'min:1'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
