<?php

namespace App\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

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
            'slug' => [
                'required',
                'string',
                'max:255',
                'alpha_dash',
                Rule::unique('photo_templates', 'slug')->ignore($this->route('template')),
            ],
            'orientation' => ['required', 'string', Rule::in(['portrait', 'landscape'])],
            'layout' => [$layoutRequired ? 'required' : 'sometimes', 'image', 'max:5120'],
            'thumbnail' => ['nullable', 'image', 'max:5120'],
            'photo_slots' => ['required', 'integer', 'min:1'],
            'print_width_mm' => ['required', 'integer', 'min:1'],
            'print_height_mm' => ['required', 'integer', 'min:1'],
            'active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'printer_compatibility' => ['nullable', 'json'],
        ];
    }
}
