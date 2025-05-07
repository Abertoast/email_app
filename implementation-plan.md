# Implementation Plan: Show Results in Query History

## Overview
Enhance the Query History feature so that, for each past query, users can not only rerun the query but also view the exact results (including processed results, raw emails, and relevant UI state) as they were at the time of the original query. This requires storing additional data in history, updating the UI, and refactoring results display logic for reuse.

---

## 1. Data Model Changes
- **Extend `QueryHistoryItem`** (in `EmailContext.tsx`) to include:
  - `rawEmails: any[]` — the array of emails fetched for the query.
  - `uiState?: { expandedItems: string[], selectedTags: string[], selectedFlags: string[] }` — optional, to restore the exact exploration state.
- **Migration:** Ensure old history items are still supported (fallbacks if fields are missing).

---

## 2. Saving to History
- **In `processEmails` (in `EmailContext.tsx`):**
  - When saving to history, also save the `emails` array as `rawEmails`.
  - Optionally, save the current UI state (expanded/collapsed, filters) if available.
- **Update `saveQueryToHistory`** to accept and store these new fields.

---

## 3. Query History UI
- **In `QueryHistory.tsx`:**
  - Add a "Show Results" button for each history item.
  - When clicked, navigate to a new page or open a modal (e.g., `/history/:id/results`) to display the stored results.

---

## 4. Results View for History
- **Create a new page/component** (e.g., `HistoryResultsView.tsx`):
  - Loads the selected history item by `historyId`.
  - Passes `rawEmails`, `results`, and `uiState` to the results display components.
  - Allows the user to explore the results as if they had just run the query.

---

## 5. Refactor Results Display Logic
- **Refactor `ProcessingResults`, `UnifiedEmailCard`, etc.:**
  - Accept props for data (emails, results, UI state) instead of always reading from context.
  - Ensure these components can be used both in the dashboard and in the history results view.

---

## 6. Routing
- **Update routing** (in `App.tsx`):
  - Add a route for the new results view (e.g., `/history/:id/results`).

---

## 7. Backward Compatibility & Edge Cases
- Handle missing `rawEmails` or `uiState` gracefully (e.g., for old history items).
- Ensure clearing history removes all stored data.

---

## 8. Testing & UX Polish
- Test with both new and old history items.
- Ensure the UI is clear, and users can distinguish between rerunning and viewing past results.
- Add tooltips/help text as needed.

---

## 9. Documentation
- Update README and in-app help to explain the new feature.

---

## References
- This plan should be referenced at each step of the implementation for consistency and completeness. 