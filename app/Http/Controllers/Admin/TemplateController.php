<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTemplateRequest;
use App\Http\Requests\Admin\UpdateTemplateRequest;
use App\Models\PhotoTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Throwable;

class TemplateController extends Controller
{
    /**
     * List all photo templates for management.
     */
    public function index(): Response
    {
        $templates = PhotoTemplate::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (PhotoTemplate $template) => $this->presentTemplate($template));

        return Inertia::render('admin/templates/index', [
            'templates' => $templates,
        ]);
    }

    /**
     * Show the form for creating a new template.
     */
    public function create(): Response
    {
        return Inertia::render('admin/templates/create');
    }

    /**
     * Store a newly created template.
     */
    public function store(StoreTemplateRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $storedPaths = [];

        try {
            $layout = $request->file('layout');

            if (! $layout instanceof UploadedFile) {
                throw new RuntimeException('A valid template layout asset is required.');
            }

            $layoutPath = $this->storePublicAsset($layout, 'templates');
            $storedPaths[] = $layoutPath;

            $thumbnailPath = null;
            $thumbnail = $request->file('thumbnail');

            if ($thumbnail instanceof UploadedFile) {
                $thumbnailPath = $this->storePublicAsset($thumbnail, 'templates/thumbnails');
                $storedPaths[] = $thumbnailPath;
            }

            PhotoTemplate::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'orientation' => $validated['orientation'],
                'layout_path' => $layoutPath,
                'thumbnail_path' => $thumbnailPath,
                'photo_slots' => $validated['photo_slots'],
                'layout_config' => $this->decodeLayoutConfiguration(
                    (string) $validated['layout_config'],
                ),
                'print_width_mm' => $validated['print_width_mm'],
                'print_height_mm' => $validated['print_height_mm'],
                'active' => $request->boolean('active', true),
                'sort_order' => $validated['sort_order'] ?? ((int) PhotoTemplate::max('sort_order') + 1),
                'printer_compatibility' => isset($validated['printer_compatibility'])
                    ? json_decode((string) $validated['printer_compatibility'], true)
                    : null,
            ]);
        } catch (Throwable $exception) {
            $this->deletePublicAssets($storedPaths);

            throw $exception;
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template created.')]);

        return to_route('admin.templates.index');
    }

    /**
     * Show the form for editing an existing template.
     */
    public function edit(PhotoTemplate $template): Response
    {
        return Inertia::render('admin/templates/edit', [
            'template' => $this->presentTemplate($template),
        ]);
    }

    /**
     * Update an existing template's fields and assets.
     */
    public function update(UpdateTemplateRequest $request, PhotoTemplate $template): RedirectResponse
    {
        $validated = $request->validated();
        $storedPaths = [];
        $replacedPaths = [];

        $attributes = [
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'orientation' => $validated['orientation'],
            'photo_slots' => $validated['photo_slots'],
            'layout_config' => $this->decodeLayoutConfiguration(
                (string) $validated['layout_config'],
            ),
            'print_width_mm' => $validated['print_width_mm'],
            'print_height_mm' => $validated['print_height_mm'],
            'active' => $request->boolean('active'),
            'sort_order' => $validated['sort_order'] ?? 0,
            'printer_compatibility' => isset($validated['printer_compatibility'])
                ? json_decode((string) $validated['printer_compatibility'], true)
                : null,
        ];

        try {
            $layout = $request->file('layout');

            if ($layout instanceof UploadedFile) {
                $layoutPath = $this->storePublicAsset($layout, 'templates');
                $storedPaths[] = $layoutPath;
                $replacedPaths[] = $template->layout_path;
                $attributes['layout_path'] = $layoutPath;
            }

            $thumbnail = $request->file('thumbnail');

            if ($thumbnail instanceof UploadedFile) {
                $thumbnailPath = $this->storePublicAsset($thumbnail, 'templates/thumbnails');
                $storedPaths[] = $thumbnailPath;

                if ($template->thumbnail_path !== null) {
                    $replacedPaths[] = $template->thumbnail_path;
                }

                $attributes['thumbnail_path'] = $thumbnailPath;
            }

            $template->updateOrFail($attributes);
        } catch (Throwable $exception) {
            $this->deletePublicAssets($storedPaths);

            throw $exception;
        }

        $this->deletePublicAssets($replacedPaths);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template updated.')]);

        return to_route('admin.templates.index');
    }

    /**
     * Toggle a template's active flag.
     */
    public function toggle(PhotoTemplate $template): RedirectResponse
    {
        $active = ! $template->active;

        $template->updateOrFail(['active' => $active]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $active ? __('Template enabled.') : __('Template disabled.'),
        ]);

        return to_route('admin.templates.index');
    }

    /**
     * Persist a new display order for the given templates.
     */
    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ordered_ids' => ['required', 'array'],
            'ordered_ids.*' => ['integer', 'exists:photo_templates,id'],
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['ordered_ids'] as $position => $id) {
                PhotoTemplate::whereKey($id)->update(['sort_order' => $position]);
            }
        });

        return to_route('admin.templates.index');
    }

    /**
     * Delete a template unless historical sessions still reference it.
     */
    public function destroy(PhotoTemplate $template): RedirectResponse
    {
        if ($template->photoboothSessions()->exists()) {
            return back()->withErrors([
                'template' => __('This template cannot be deleted because it has associated photobooth sessions.'),
            ]);
        }

        $assetPaths = array_filter([
            $template->layout_path,
            $template->thumbnail_path,
        ]);

        $template->deleteOrFail();
        $this->deletePublicAssets($assetPaths);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template deleted.')]);

        return to_route('admin.templates.index');
    }

    /**
     * Present a template using frontend-safe names and public asset URLs.
     *
     * @return array<string, mixed>
     */
    private function presentTemplate(PhotoTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'slug' => $template->slug,
            'orientation' => $template->orientation,
            'layoutPath' => $template->layout_path,
            'layoutUrl' => Storage::disk('public')->url($template->layout_path),
            'thumbnailPath' => $template->thumbnail_path,
            'thumbnailUrl' => $template->thumbnail_path !== null
                ? Storage::disk('public')->url($template->thumbnail_path)
                : null,
            'photoSlots' => $template->photo_slots,
            'layoutConfig' => $template->layout_config,
            'printWidthMm' => $template->print_width_mm,
            'printHeightMm' => $template->print_height_mm,
            'active' => $template->active,
            'sortOrder' => $template->sort_order,
            'printerCompatibility' => $template->printer_compatibility,
            'createdAt' => $template->created_at?->toIso8601String(),
            'updatedAt' => $template->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Store one template asset on the repository-mandated public filesystem disk.
     */
    private function storePublicAsset(UploadedFile $file, string $directory): string
    {
        $path = $file->store($directory, 'public');

        if (! is_string($path)) {
            throw new RuntimeException("Unable to store template asset in [{$directory}].");
        }

        return $path;
    }

    /**
     * Decode a validated layout configuration into its persisted array representation.
     *
     * @return array<string, mixed>
     */
    private function decodeLayoutConfiguration(string $configuration): array
    {
        $decoded = json_decode($configuration, true, flags: JSON_THROW_ON_ERROR);

        if (! is_array($decoded) || array_is_list($decoded)) {
            throw new RuntimeException('The validated template layout configuration is invalid.');
        }

        return $decoded;
    }

    /**
     * Delete unique template asset paths from the public filesystem disk.
     *
     * @param  array<int, string>  $paths
     */
    private function deletePublicAssets(array $paths): void
    {
        if ($paths === []) {
            return;
        }

        Storage::disk('public')->delete(array_values(array_unique($paths)));
    }
}
