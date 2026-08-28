<?php

namespace App\Http\Controllers;

use App\Actions\Templates\SelectPhotoTemplate;
use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PhotoTemplateController extends Controller
{
    /**
     * List globally managed templates available to this Business kiosk.
     */
    public function index(Business $business): JsonResponse
    {
        $templates = PhotoTemplate::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (PhotoTemplate $template) => [
                'id' => $template->id,
                'name' => $template->name,
                'slug' => $template->slug,
                'orientation' => $template->orientation,
                'layoutUrl' => Storage::disk('public')->url($template->layout_path),
                'thumbnailPath' => $template->thumbnail_path,
                'photoSlots' => $template->photo_slots,
                'layoutConfig' => $template->layout_config,
                'printWidthMm' => $template->print_width_mm,
                'printHeightMm' => $template->print_height_mm,
            ]);

        return response()->json(['templates' => $templates]);
    }

    /**
     * Select a template for the route-scoped photobooth session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        Request $request,
        SelectPhotoTemplate $selectPhotoTemplate,
    ): JsonResponse {
        $validated = $request->validate([
            'photoTemplateId' => ['required', 'integer'],
        ]);

        $selected = $selectPhotoTemplate->handle(
            $photoboothSession,
            $validated['photoTemplateId'],
        );

        if (! $selected) {
            return response()->json([
                'message' => 'This template could not be selected for the current session.',
                'status' => $photoboothSession->fresh()->status->value,
            ], 422);
        }

        $photoboothSession->refresh();

        return response()->json([
            'status' => $photoboothSession->status->value,
            'requiredCaptureCount' => $photoboothSession->template_snapshot['photo_slots'] ?? null,
        ]);
    }
}
