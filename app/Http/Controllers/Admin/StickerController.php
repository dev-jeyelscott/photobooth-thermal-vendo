<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStickerRequest;
use App\Http\Requests\Admin\UpdateStickerRequest;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Throwable;

class StickerController extends Controller
{
    /**
     * List all sticker designs for management.
     */
    public function index(): Response
    {
        $stickers = StickerDesign::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (StickerDesign $sticker) => $this->presentSticker($sticker));

        return Inertia::render('admin/stickers/index', [
            'stickers' => $stickers,
        ]);
    }

    /**
     * Show the form for creating a new sticker design.
     */
    public function create(): Response
    {
        return Inertia::render('admin/stickers/create', [
            'templates' => $this->presentTemplateOptions(),
        ]);
    }

    /**
     * Store a newly created sticker design.
     */
    public function store(StoreStickerRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $storedPaths = [];

        try {
            $asset = $request->file('asset');

            if (! $asset instanceof UploadedFile) {
                throw new RuntimeException('A valid sticker asset is required.');
            }

            $assetPath = $this->storePublicAsset($asset, 'stickers');
            $storedPaths[] = $assetPath;

            $thumbnailPath = null;
            $thumbnail = $request->file('thumbnail');

            if ($thumbnail instanceof UploadedFile) {
                $thumbnailPath = $this->storePublicAsset($thumbnail, 'stickers/thumbnails');
                $storedPaths[] = $thumbnailPath;
            }

            DB::transaction(function () use ($request, $validated, $assetPath, $thumbnailPath): void {
                $sticker = StickerDesign::create([
                    'name' => $validated['name'],
                    'asset_path' => $assetPath,
                    'thumbnail_path' => $thumbnailPath,
                    'active' => $request->boolean('active', true),
                    'sort_order' => $validated['sort_order'] ?? ((int) StickerDesign::max('sort_order') + 1),
                    'placement' => isset($validated['placement'])
                        ? json_decode($validated['placement'], true)
                        : null,
                ]);

                $sticker->photoTemplates()->sync($validated['template_ids'] ?? []);
            });
        } catch (Throwable $exception) {
            $this->deletePublicAssets($storedPaths);

            throw $exception;
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sticker created.')]);

        return to_route('admin.stickers.index');
    }

    /**
     * Show the form for editing an existing sticker design.
     */
    public function edit(StickerDesign $sticker): Response
    {
        return Inertia::render('admin/stickers/edit', [
            'sticker' => $this->presentSticker($sticker),
            'templates' => $this->presentTemplateOptions(),
        ]);
    }

    /**
     * Update an existing sticker design's fields and assets.
     */
    public function update(UpdateStickerRequest $request, StickerDesign $sticker): RedirectResponse
    {
        $validated = $request->validated();
        $storedPaths = [];
        $replacedPaths = [];

        $attributes = [
            'name' => $validated['name'],
            'active' => $request->boolean('active'),
            'sort_order' => $validated['sort_order'] ?? 0,
            'placement' => isset($validated['placement'])
                ? json_decode($validated['placement'], true)
                : null,
        ];

        try {
            $asset = $request->file('asset');

            if ($asset instanceof UploadedFile) {
                $assetPath = $this->storePublicAsset($asset, 'stickers');
                $storedPaths[] = $assetPath;
                $replacedPaths[] = $sticker->asset_path;
                $attributes['asset_path'] = $assetPath;
            }

            $thumbnail = $request->file('thumbnail');

            if ($thumbnail instanceof UploadedFile) {
                $thumbnailPath = $this->storePublicAsset($thumbnail, 'stickers/thumbnails');
                $storedPaths[] = $thumbnailPath;

                if ($sticker->thumbnail_path !== null) {
                    $replacedPaths[] = $sticker->thumbnail_path;
                }

                $attributes['thumbnail_path'] = $thumbnailPath;
            }

            DB::transaction(function () use ($sticker, $attributes, $validated): void {
                $sticker->updateOrFail($attributes);
                $sticker->photoTemplates()->sync($validated['template_ids'] ?? []);
            });
        } catch (Throwable $exception) {
            $this->deletePublicAssets($storedPaths);

            throw $exception;
        }

        $this->deletePublicAssets($replacedPaths);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sticker updated.')]);

        return to_route('admin.stickers.index');
    }

    /**
     * Toggle a sticker design's active flag.
     */
    public function toggle(StickerDesign $sticker): RedirectResponse
    {
        $active = ! $sticker->active;

        $sticker->updateOrFail(['active' => $active]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $active ? __('Sticker enabled.') : __('Sticker disabled.'),
        ]);

        return to_route('admin.stickers.index');
    }

    /**
     * Persist a new display order for the given sticker designs.
     */
    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ordered_ids' => ['required', 'array'],
            'ordered_ids.*' => ['integer', 'exists:sticker_designs,id'],
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['ordered_ids'] as $position => $id) {
                StickerDesign::whereKey($id)->update(['sort_order' => $position]);
            }
        });

        return to_route('admin.stickers.index');
    }

    /**
     * Delete a sticker design, unless it has associated photobooth sessions.
     */
    public function destroy(StickerDesign $sticker): RedirectResponse
    {
        if ($sticker->photoboothSessions()->exists()) {
            return back()->withErrors([
                'sticker' => __('This sticker cannot be deleted because it has associated photobooth sessions.'),
            ]);
        }

        $assetPaths = array_filter([
            $sticker->asset_path,
            $sticker->thumbnail_path,
        ]);

        $sticker->deleteOrFail();
        $this->deletePublicAssets($assetPaths);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sticker deleted.')]);

        return to_route('admin.stickers.index');
    }

    /**
     * Present a sticker design for the frontend.
     *
     * @return array<string, mixed>
     */
    private function presentSticker(StickerDesign $sticker): array
    {
        return [
            'id' => $sticker->id,
            'name' => $sticker->name,
            'assetPath' => $sticker->asset_path,
            'assetUrl' => Storage::disk(config('filesystems.media'))->url($sticker->asset_path),
            'thumbnailPath' => $sticker->thumbnail_path,
            'thumbnailUrl' => $sticker->thumbnail_path !== null
                ? Storage::disk(config('filesystems.media'))->url($sticker->thumbnail_path)
                : null,
            'active' => $sticker->active,
            'sortOrder' => $sticker->sort_order,
            'placement' => $sticker->placement,
            'templateIds' => $sticker->relationLoaded('photoTemplates')
                ? $sticker->photoTemplates->pluck('id')->values()->all()
                : $sticker->photoTemplates()->pluck('photo_templates.id')->values()->all(),
        ];
    }

    /**
     * Present the available templates for the compatible-template selector.
     *
     * @return array<int, array{id: int, name: string}>
     */
    private function presentTemplateOptions(): array
    {
        return PhotoTemplate::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (PhotoTemplate $template) => [
                'id' => $template->id,
                'name' => $template->name,
            ])
            ->all();
    }

    private function storePublicAsset(UploadedFile $file, string $directory): string
    {
        $path = $file->store($directory, config('filesystems.media'));

        if (! is_string($path)) {
            throw new RuntimeException("Unable to store sticker asset in [{$directory}].");
        }

        return $path;
    }

    /**
     * @param  array<int, string>  $paths
     */
    private function deletePublicAssets(array $paths): void
    {
        if ($paths === []) {
            return;
        }

        Storage::disk(config('filesystems.media'))->delete(array_values(array_unique($paths)));
    }
}
