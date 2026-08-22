<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTemplateRequest;
use App\Http\Requests\Admin\UpdateTemplateRequest;
use App\Models\PhotoTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

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

        PhotoTemplate::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'orientation' => $validated['orientation'],
            'layout_path' => $request->file('layout')->store('templates', 'public'),
            'thumbnail_path' => $request->hasFile('thumbnail')
                ? $request->file('thumbnail')->store('templates/thumbnails', 'public')
                : null,
            'photo_slots' => $validated['photo_slots'],
            'print_width_mm' => $validated['print_width_mm'],
            'print_height_mm' => $validated['print_height_mm'],
            'active' => $request->boolean('active', true),
            'sort_order' => $validated['sort_order'] ?? ((int) PhotoTemplate::max('sort_order') + 1),
            'printer_compatibility' => isset($validated['printer_compatibility'])
                ? json_decode($validated['printer_compatibility'], true)
                : null,
        ]);

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

        $attributes = [
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'orientation' => $validated['orientation'],
            'photo_slots' => $validated['photo_slots'],
            'print_width_mm' => $validated['print_width_mm'],
            'print_height_mm' => $validated['print_height_mm'],
            'active' => $request->boolean('active'),
            'sort_order' => $validated['sort_order'] ?? 0,
            'printer_compatibility' => isset($validated['printer_compatibility'])
                ? json_decode($validated['printer_compatibility'], true)
                : null,
        ];

        if ($request->hasFile('layout')) {
            Storage::disk('public')->delete($template->layout_path);
            $attributes['layout_path'] = $request->file('layout')->store('templates', 'public');
        }

        if ($request->hasFile('thumbnail')) {
            if ($template->thumbnail_path) {
                Storage::disk('public')->delete($template->thumbnail_path);
            }
            $attributes['thumbnail_path'] = $request->file('thumbnail')->store('templates/thumbnails', 'public');
        }

        $template->update($attributes);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template updated.')]);

        return to_route('admin.templates.index');
    }

    /**
     * Toggle a template's active flag.
     */
    public function toggle(PhotoTemplate $template): RedirectResponse
    {
        $template->update(['active' => ! $template->active]);

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
     * Delete a template, unless it has associated photobooth sessions.
     */
    public function destroy(PhotoTemplate $template): RedirectResponse
    {
        if ($template->photoboothSessions()->exists()) {
            return back()->withErrors([
                'template' => __('This template cannot be deleted because it has associated photobooth sessions.'),
            ]);
        }

        Storage::disk('public')->delete(array_filter([$template->layout_path, $template->thumbnail_path]));

        $template->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Template deleted.')]);

        return to_route('admin.templates.index');
    }

    /**
     * Present a template for the frontend.
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
            'thumbnailPath' => $template->thumbnail_path,
            'photoSlots' => $template->photo_slots,
            'printWidthMm' => $template->print_width_mm,
            'printHeightMm' => $template->print_height_mm,
            'active' => $template->active,
            'sortOrder' => $template->sort_order,
            'printerCompatibility' => $template->printer_compatibility,
        ];
    }
}
