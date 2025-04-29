# Implementation Plan: Prompt Tags Feature

## 1. Goal

Introduce a "Prompt Tags" feature allowing users to define custom tags (e.g., `[[Action Item]]`, `[[Urgent]]`) that can be:
1.  Defined and managed by the user in the prompt library page (similar to prompt variables, created in the prompt library page, clicked to insert in the prompt editing window).
2.  Instructed (via user prompt engineering) to be conditionally inserted into LLM responses based on email content.
3.  Parsed and extracted from LLM responses after processing.
4.  Displayed visually as labels on processed email results.
5.  Used as interactive filters ("AND" logic) to narrow down processed results.

## 2. Data Model Changes

*   **Tag Definition Storage (`localStorage` via `SettingsContext`):**
    *   Add a new key in `localStorage`, e.g., `promptTags`.
    *   Store an array of tag objects: `[{ id: string, name: string, marker: string, color: string }]`.
        *   `id`: Unique identifier (e.g., UUID).
        *   `name`: User-friendly name (e.g., "Action Item"). Must be unique.
        *   `marker`: The exact string the LLM should insert (e.g., `[[Action Item]]`). Must be unique.
        *   `color`: A hex color code (e.g., `#FF5733`) for the visual label.
*   **Result Storage (`localStorage` via `EmailContext`):**
    *   Modify the structure of objects stored in `queryHistory` and used for `latestResults`.
    *   Add a `tags: string[]` field to each processed result object, storing the *names* of the tags extracted from the LLM response for that item (e.g., `['Action Item', 'Urgent']`).

## 3. Backend Changes

*   No backend changes are required for this feature, as tag definition, processing logic, and storage occur entirely on the client-side.

## 4. Frontend Changes

### 4.1. State Management (`src/contexts/`)

*   **`SettingsContext.tsx`:**
    *   Add state: `tags: Tag[]` (using the interface defined in section 2). Initialize from `localStorage` or with an empty array.
    *   Add CRUD functions: `addTag(tag: Omit<Tag, 'id'>): void` (should generate unique `id` internally, e.g., using `crypto.randomUUID()`), `updateTag(tag: Tag): void`, `deleteTag(tagId: string): void`.
    *   Modify saving logic (`saveSettings`, likely triggered within the CRUD functions) to persist the `tags` array to `localStorage`.
    *   Ensure `loadSettings` correctly loads tags from `localStorage`.
*   **`EmailContext.tsx`:**
    *   Modify `processEmails` function:
        *   Inside the loop processing each email response from OpenAI:
            *   Wrap tag parsing logic in a try-catch block. Log errors if parsing fails for an item, but continue processing other items.
            *   Retrieve the current list of defined `tags` from `SettingsContext`.
            *   Use a case-insensitive regular expression (e.g., `/\\\[\\\[(.*?)\\\]\\\]/gi`) to find all potential marker strings in the raw LLM response text.
            *   Map the found marker content (e.g., "Action Item") to their corresponding tag *names* by performing a case-insensitive lookup against the `name` property in the `tags` list retrieved from `SettingsContext`. Filter out any markers found that don't correspond to a defined tag. Store these valid tag names.
            *   Modify the response text by removing all recognized tag markers (case-insensitive) before storing it for display.
            *   Add the extracted tag names array to the result object (e.g., `result.tags = extractedTagNames`).
        *   Ensure the updated result object structure (with `tags`) is used for `latestResults` and saved to `queryHistory`.

### 4.2. UI Components (`src/components/` and `src/pages/`)

*   **New Component (`TagManager.tsx`):**
    *   Create a dedicated component for managing tags.
    *   UI elements:
        *   List of existing tags, showing name, marker, and color preview.
        *   Buttons/icons for editing and deleting each tag.
        *   A form/modal to add/edit a tag, including input fields for Name, Marker (with validation for `[[...]]` format, uniqueness of both Name and Marker), and a color picker component (e.g., `<input type="color">` or library).
    *   Use `SettingsContext` functions (`addTag`, `updateTag`, `deleteTag`) to handle state changes.
*   **`Settings.tsx` (or potentially `PromptLibrary.tsx`):**
    *   Integrate the `TagManager.tsx` component into an appropriate section (e.g., a new "Prompt Tags" tab or section within Settings).
*   **Prompt Input Area (e.g., in `Dashboard.tsx` or `SavedPromptSelector.tsx`):**
    *   Add UI element(s) (e.g., a dropdown button similar to variables) allowing users to easily select a defined tag and insert its `marker` (e.g., `[[Action Item]]`) into the prompt textarea at the current cursor position. This requires access to the `tags` list from `SettingsContext`.
*   **`ProcessingResults.tsx`:**
    *   **Individual Result Display:**
        *   Modify the component that renders each individual processed result.
        *   Check if the `result.tags` array exists and is not empty.
        *   If tags exist, iterate over `result.tags`. For each tag name:
            *   Retrieve the corresponding full tag object (especially the `color`) from `SettingsContext` (case-insensitive lookup might be needed if storing only names).
            *   Render a small visual label/badge (e.g., using a `<span>` with appropriate styling and background color) displaying the tag `name`.
            *   Position these badges appropriately (e.g., top-right or bottom-left corner of the result item).
    *   **Filtering UI:**
        *   Add a new section *above* the list of results.
        *   Maintain local state for active filters: `selectedFilterTags: string[]`, initialized as empty.
        *   Calculate the set of unique tag names present across *all* items in the current *unfiltered* `latestResults` data source.
        *   Render clickable buttons for each unique tag name. Style buttons to indicate selection state (active/inactive).
        *   Add a "Clear All Filters" button.
        *   On tag button click, update the `selectedFilterTags` state (add/remove the clicked tag name). On "Clear All" click, reset `selectedFilterTags` to empty.
        *   **Filtering Logic:** Before mapping the data source (`latestResults`) to render individual result items, filter the array:
            *   Include only items where `item.tags` is defined and contains *all* tag names present in the `selectedFilterTags` state array (implement "AND" logic).
            *   If `selectedFilterTags` is empty, show all results.
        *   Ensure the list of filter buttons dynamically updates if the underlying `latestResults` change (e.g., after a new query), potentially disabling buttons for tags no longer present in the results.

## 5. UX Considerations

*   **User Guidance:** Clearly communicate that the effectiveness of automatic tagging relies on good prompt engineering. Consider adding placeholder text or tooltips with examples in the prompt input area.
*   **Tag Management:** Make CRUD operations intuitive. Provide clear validation feedback (e.g., for duplicate/invalid names or markers). Use a visual color picker. Ensure `id` generation is handled seamlessly.
*   **Tag Insertion:** Ensure easy discovery and insertion of tag markers into prompts in the prompt editigng menu.
*   **Tag Display:** Labels should be unobtrusive but easily noticeable. Ensure good color contrast. Tooltips on hover showing the full tag name might be useful if labels are small.
*   **Filtering:** Clearly indicate which filters are active. Provide an easy way to clear all active filters. Filter buttons should represent tags available in the full result set. Consider performance for filtering large result sets (filtering should happen client-side and be reasonably fast for typical use cases).
*   **Error Handling:** Gracefully handle potential errors during tag parsing from LLM responses, logging issues without crashing the application.