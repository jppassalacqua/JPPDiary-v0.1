
# Development Log

## Unified Media Management (Turn 2)

**Goal**: Consolidate disparate media handling (images, video, audio) into unified components for input and display.

**Changes**:
1.  **`components/MediaManager.tsx`**: Created a centralized component for media input.
    *   Features: File upload, Drag & Drop, Camera Capture, Audio Recording, Canvas Drawing.
    *   State: Manages `images` (string[]) and `audio` (string[]) arrays via props.
2.  **`components/MediaGallery.tsx`**: Created a centralized component for media display.
    *   Features: Renders images/video in a responsive grid and audio players in a compact list.
3.  **`components/EntryEditor.tsx`**: Refactored to use `MediaManager`.
    *   Removed individual recorder/camera/drawing states and logic.
    *   Delegated media state management UI to `MediaManager`.
4.  **`pages/History.tsx`**: Refactored to use `MediaGallery`.
    *   Replaced manual rendering loops for images and audio with the unified gallery component.

**Technical Notes**:
*   The `images` array in `DiaryEntry` now serves as the primary storage for visual media (images + video base64 data).
*   The `audio` array stores base64 audio data.
*   Backward compatibility for legacy `image` (string) field is handled by mapping it to an array in `History.tsx` and `EntryEditor.tsx`.
