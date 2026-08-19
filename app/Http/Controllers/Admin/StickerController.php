<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStickerRequest;
use App\Http\Requests\Admin\UpdateStickerRequest;
use App\Models\StickerDesign;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class StickerController extends Controller
{
    /**
     * List all sticker designs for management.
     */
    public function index(): Response
    {
        $stickers = StickerDesign::query()
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
        return Inertia::render('admin/stickers/create');
    }

    /**
     * Store a newly created sticker design.
     */
    public function store(StoreStickerRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        StickerDesign::create([
            'name' => $validated['name'],
            'asset_path' => $request->file('asset')->store('stickers', 'public'),
            'thumbnail_path' => $request->hasFile('thumbnail')
                ? $request->file('thumbnail')->store('stickers/thumbnails', 'public')
                : null,
            'active' => $request->boolean('active', true),
        ]);

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
        ]);
    }

    /**
     * Update an existing sticker design's fields and assets.
     */
    public function update(UpdateStickerRequest $request, StickerDesign $sticker): RedirectResponse
    {
        $validated = $request->validated();

        $attributes = [
            'name' => $validated['name'],
            'active' => $request->boolean('active'),
        ];

        if ($request->hasFile('asset')) {
            Storage::disk('public')->delete($sticker->asset_path);
            $attributes['asset_path'] = $request->file('asset')->store('stickers', 'public');
        }

        if ($request->hasFile('thumbnail')) {
            if ($sticker->thumbnail_path) {
                Storage::disk('public')->delete($sticker->thumbnail_path);
            }
            $attributes['thumbnail_path'] = $request->file('thumbnail')->store('stickers/thumbnails', 'public');
        }

        $sticker->update($attributes);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sticker updated.')]);

        return to_route('admin.stickers.index');
    }

    /**
     * Toggle a sticker design's active flag.
     */
    public function toggle(StickerDesign $sticker): RedirectResponse
    {
        $sticker->update(['active' => ! $sticker->active]);

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

        Storage::disk('public')->delete(array_filter([$sticker->asset_path, $sticker->thumbnail_path]));

        $sticker->delete();

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
            'thumbnailPath' => $sticker->thumbnail_path,
            'active' => $sticker->active,
        ];
    }
}
