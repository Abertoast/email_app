# Implementation Plan: Increase Email Fetch Limit

**Goal:** Increase the maximum number of emails that can be fetched from a single folder to 1000, while keeping the "fetch from all folders" limit at 100. Address potential performance, UX, and resource implications comprehensively.

---
## Iteration 2: Detailed Plan

### Phase 1: Backend Adjustments (`api/index.js`)

**Objective:** Safely handle requests for up to 1000 emails for single-folder fetches, while enforcing a 100-email limit for `fetchAllFolders` operations. Ensure stability and clear error reporting.

1.  **Refine `maxResults` Logic for Single vs. All Folders:**
    *   **Task:** Implement distinct handling for `maxResults` based on `fetchAllFolders`.
    *   **Sub-Tasks:**
        *   Define a constant: `MAX_RESULTS_WHEN_FETCH_ALL_FOLDERS = 100`.
        *   In `/api/fetchEmails` endpoint:
            *   Retrieve `requestedMaxResults` from `req.body.maxResults` (default to `20` as per existing behavior if not provided).
            *   Retrieve `fetchAllFolders` flag (default to `false`).
            *   Determine `effectiveMaxResults`:
                *   If `fetchAllFolders` is `true`, `effectiveMaxResults = Math.min(requestedMaxResults, MAX_RESULTS_WHEN_FETCH_ALL_FOLDERS)`.
                *   Else, `effectiveMaxResults = requestedMaxResults` (allowing up to 1000 or more, frontend will cap at 1000).
            *   Add logging: If capping occurs for `fetchAllFolders` (e.g., user requested 500 but `fetchAllFolders` is true), log this server-side for debugging/awareness.
        *   Use `effectiveMaxResults` consistently:
            *   When calculating `perFolderLimit` if `fetchAllFolders` is true (current formula: `Math.max(10, Math.ceil(effectiveMaxResults * 1.5 / Math.max(1, folderNames.length)))`).
            *   For the final slicing of combined results: `allFetchedEmails.slice(0, effectiveMaxResults)`.
    *   **Potential Challenges:** Ensuring the logic correctly handles edge cases like `requestedMaxResults` being less than `MAX_RESULTS_WHEN_FETCH_ALL_FOLDERS` when `fetchAllFolders` is true.
    *   **Testing:**
        *   Request 500 emails, `fetchAllFolders=false` -> Expect up to 500 (if available).
        *   Request 500 emails, `fetchAllFolders=true` -> Expect up to 100.
        *   Request 50 emails, `fetchAllFolders=true` -> Expect up to 50.
        *   Request 50 emails, `fetchAllFolders=false` -> Expect up to 50.

2.  **IMAP Server Interaction at Scale:**
    *   **Task:** Mitigate potential issues from increased load on the IMAP server.
    *   **Considerations:**
        *   Fetching 1000 email bodies can be slow and resource-intensive for the IMAP server.
        *   Risk of hitting undocumented server-side rate limits, connection limits, or data transfer limits.
        *   `node-imap` already handles sequential opening/closing of mailboxes, which is good.
    *   **Initial Approach:** Proceed with direct fetching. No immediate complex changes (like fetching UIDs then bodies in chunks) unless testing reveals critical IMAP server-side issues.
    *   **Monitoring:** During testing, monitor for IMAP errors (timeouts, refused connections, partial data) when fetching large numbers of emails.
    *   **Future Mitigation (if needed):** If direct fetching of 1000 emails proves problematic, future considerations might include fetching UIDs first, then fetching message bodies in smaller batches with slight delays.

3.  **Serverless Environment Constraints (e.g., Vercel):**
    *   **Task:** Ensure the backend function operates within typical serverless platform limits.
    *   **Considerations:**
        *   **Execution Time:** Fetching and parsing 1000 emails will increase execution time. Typical limits are 10-60 seconds (Vercel Hobby is 10s, Pro can be higher).
        *   **Memory Usage:** Storing 1000 parsed email objects in memory before sending. Typical limits are 128MB-1GB+.
    *   **Monitoring:** During testing with 1000 emails, monitor Vercel function logs for execution duration and memory usage.
    *   **Future Mitigation (if needed):** If limits are consistently hit:
        *   Optimize parsing: Ensure `mailparser` usage is efficient. Only parse what's needed.
        *   Streaming response (more complex): If platforms support it, stream emails back to the client instead of buffering all 1000.
        *   Background jobs (very complex, likely out of scope): For extreme cases, offload to a separate worker/queue system.

4.  **Enhanced Error Handling & Reporting:**
    *   **Task:** Improve robustness of error handling for IMAP operations and server-side logic.
    *   **Implementation:**
        *   Review existing `handleImapError` function.
        *   Ensure all promises in the IMAP fetching chain have `.catch()` handlers that propagate errors correctly.
        *   Provide clear, structured error messages back to the client (e.g., distinguish between IMAP connection errors, parsing errors, timeout errors).
    *   **Testing:** Simulate IMAP server unavailability, invalid credentials, and malformed email data to test error paths.

### Phase 2: Frontend Adjustments (`src/`)

**Objective:** Allow users to request up to 1000 emails, efficiently display large datasets, manage client-side resources, and handle long-running operations gracefully.

1.  **Update UI Input for `maxResults`:**
    *   **File:** `src/components/EmailFilterForm.tsx`
    *   **Task:** Change the `max` attribute of the `<input type="number" name="maxResults">` from `100` to `1000`.
    *   **Consideration:** Add a small note below the input field if `fetchAllFolders` is checked, reminding the user that the limit will be capped at 100 in that mode (this could be dynamic text).
    *   **Testing:** UI allows input up to 1000. Test interaction with the `fetchAllFolders` checkbox and the informational message.

2.  **UI Virtualization for Email List (Critical Performance Task):**
    *   **Files:** `src/pages/Dashboard.tsx`, `src/components/ProcessingResults.tsx`, `src/components/UnifiedEmailCard.tsx`.
    *   **Task:** Implement UI virtualization to efficiently render lists of up to 1000 emails.
    *   **Library Selection:** `react-window` is generally recommended for its leanness. `react-virtualized` is more feature-rich but heavier.
    *   **Implementation Details:**
        *   Install chosen library (e.g., `npm install react-window @types/react-window`).
        *   Refactor `ProcessingResults.tsx`:
            *   Replace direct `.map()` over emails with a `VariableSizeList` component from `react-window` (assuming `UnifiedEmailCard` can have variable heights).
            *   **Item Key:** Ensure stable and unique keys for each item in the list for React's reconciliation.
            *   **Row Renderer:** Pass `UnifiedEmailCard` as the component responsible for rendering each item (`children` prop in `react-window`).
            *   **Height Estimation/Calculation (`itemSize` prop):** This is crucial for `VariableSizeList`.
                *   Develop a function to estimate the height of each `UnifiedEmailCard` based on its content (e.g., subject length, number of lines in preview, number of tags/flags).
                *   Alternatively, if all cards can be made a fixed height without sacrificing too much UX, `FixedSizeList` is simpler.
                *   Consider a `useEffect` hook to recalculate heights if data changes in a way that affects item size.
        *   **State Management:** Ensure that any state associated with individual cards (e.g., expanded state, selection) is managed correctly with virtualization (often requires lifting state up or careful use of item data).
    *   **Potential Challenges:** Accurately determining item heights for `VariableSizeList`. Handling focus management and accessibility in virtualized lists.
    *   **Testing:** Smooth scrolling with 1000 items. No visual tearing or incorrect item rendering. Verify that interactions with individual cards (if any) still work. Test with items of varying content lengths.

3.  **Manage `localStorage` for Query History (`rawEmails`):**
    *   **File:** `src/contexts/EmailContext.tsx`
    *   **Task:** Prevent `localStorage` bloat from storing excessive `rawEmails` data.
    *   **Options & Implementation:**
        1.  **Primary Approach: Conditional Storage with Placeholder:**
            *   Define `MAX_EMAILS_TO_STORE_RAW_IN_HISTORY = 100` (or a configurable value).
            *   When saving a query to history (`saveQueryToHistory` function):
                *   If `fetchedEmails.length > MAX_EMAILS_TO_STORE_RAW_IN_HISTORY`:
                    *   Store `rawEmails: []` (empty array).
                    *   Add a new flag to the history item: `rawEmailsTruncated: true` (or similar).
                *   Else, store `rawEmails: fetchedEmails` and `rawEmailsTruncated: false`.
            *   When replaying/viewing history: If `rawEmailsTruncated` is true, inform the user that raw emails were not stored due to size and they might need to re-run the query to see them.
        2.  **Alternative/Future: IndexedDB:** For a more scalable solution if `localStorage` remains a bottleneck for other history data or if full offline storage of raw emails is desired, consider migrating `queryHistory` (or just `rawEmails`) to IndexedDB. (Mark as a future enhancement if not immediately pursued).
        3.  **Session-Only Storage for Large Raw Emails:** For the *current session*, `fetchedEmails` will be in `EmailContext` state. The reduction applies only to *persisted history*.
    *   **Testing:** Fetch 1000 emails, save to history. Inspect `localStorage` to verify `rawEmails` is empty/truncated and the flag is set. Test replaying this history item. Fetch <100 emails, save, verify `rawEmails` are stored.

4.  **Client-Side Batching and Rate Limiting for "Process Individually" (OpenAI Calls):**
    *   **File:** `src/contexts/EmailContext.tsx` (within `processEmails` function).
    *   **Task:** Handle processing of many emails individually without overwhelming the OpenAI API or freezing the browser.
    *   **Implementation:**
        *   Only apply batching if `processIndividually` is true and `emails.length > SOME_THRESHOLD` (e.g., 20-50).
        *   Define `OPENAI_BATCH_SIZE` (e.g., 5-10, configurable or based on testing against rate limits).
        *   Define `DELAY_BETWEEN_BATCHES_MS` (e.g., 1000-5000 ms, to respect RPM/TPM limits).
        *   Refactor the `emails.map(async ...)` part:
            *   Loop through the `emails` array in chunks of `OPENAI_BATCH_SIZE`.
            *   For each chunk, use `Promise.all` to make parallel API calls for that small batch.
            *   After each batch successfully completes:
                *   Update `latestResults` by appending new results to any existing partial results from previous batches. This allows the UI to update incrementally.
                *   Trigger a UI update (e.g., via `setLatestResults`).
            *   If not the last batch, wait for `DELAY_BETWEEN_BATCHES_MS` before processing the next batch.
        *   **Error Handling within Batches:** If an API call within a batch fails, it should not stop the entire process. The result for that email should indicate an error, and other emails in the batch (and subsequent batches) should still be processed.
        *   **Cancellation (Advanced UX):** Consider adding a mechanism to cancel the ongoing batch processing. This would involve managing a cancellation flag in `EmailContext` and checking it before processing each new batch or email. (Mark as a potential follow-up due to complexity).
    *   **Testing:** Process >50 emails individually. Monitor network tab for batched OpenAI calls and delays. Verify UI updates incrementally. Test behavior when some API calls within a batch fail. Test OpenAI rate limit responses (if possible to simulate) and how the batching/delay helps.

### Phase 3: User Experience (UX) Enhancements

**Objective:** Ensure the user is well-informed during long operations and the UI remains as responsive as possible.

1.  **Comprehensive Loading Indicators and Progress Updates:**
    *   **Fetching Emails:**
        *   In `Dashboard.tsx`, when `isFetching` is true:
            *   Display a more informative message if `formData.maxResults` is large (e.g., >100): "Fetching up to {formData.maxResults} emails. This may take a few moments..."
            *   Consider a global loading spinner/overlay that's less intrusive but still noticeable.
    *   **Processing Emails (Individually with Batching):**
        *   In `EmailContext`, maintain state for `currentProcessingBatch` and `totalBatches` or `processedEmailCount` and `totalEmailsToProcess`.
        *   In `Dashboard.tsx` or `ProcessingResults.tsx`, display progress: "Processing email {processedEmailCount} of {totalEmailsToProcess}..." or "Processing batch {currentProcessingBatch} of {totalBatches}..."
        *   The button that triggers processing should show a busy/loading state throughout the entire operation.

2.  **UI Responsiveness and User Control:**
    *   **Debouncing/Throttling:** Review if any filter inputs in `EmailFilterForm.tsx` could trigger re-fetches or re-processing on every change. If so, and if these operations become very long, consider debouncing user input for these fields to prevent accidental queuing of multiple heavy operations.
    *   **Clarity on Applied Limits:** If `fetchAllFolders` is checked and the user has set `maxResults` > 100, the `EmailFilterForm.tsx` should ideally show a non-intrusive message like "Note: When fetching from all folders, a maximum of 100 emails will be retrieved."
    *   **Avoid Page Freezes:** UI virtualization is key. Ensure JavaScript operations on large arrays (sorting, filtering on the client *after* fetch) are optimized or also provide feedback if they are slow.

### Phase 4: Testing, Refinement, and Documentation

**Objective:** Ensure the changes are robust, performant, and well-understood.

1.  **Rigorous End-to-End Testing Scenarios:**
    *   **Max Load Single Folder:** Fetch 1000 emails from one folder.
    *   **`fetchAllFolders` Capping:** Fetch with `fetchAllFolders=true`, `maxResults=500` (expect 100).
    *   **Small Fetches:** Fetch <100 emails (both single and all folders).
    *   **Empty/Few Results:** Fetch from folders with 0 or very few emails.
    *   **Processing (Combined):** Fetch 1000 emails, process combined.
    *   **Processing (Individual):** Fetch ~50-200 emails (adjust as per testing capacity), process individually, observe batching and UI updates.
    *   **Query History:** Test saving and replaying history for all above scenarios (especially large fetches and truncated `rawEmails`).
    *   **Cross-Browser/Device:** Basic checks on major browsers (Chrome, Firefox, Safari).
    *   **Network Conditions:** Simulate slow network conditions using browser dev tools to observe UX.

2.  **Detailed Performance Profiling:**
    *   **Tools:** Browser Developer Tools (Performance tab, Memory tab).
    *   **Focus Areas:**
        *   JavaScript execution time for fetching, processing, and rendering.
        *   Memory usage before, during, and after fetching/rendering 1000 emails (check for leaks).
        *   React component render times, especially for `ProcessingResults` and `UnifiedEmailCard` with virtualization.
        *   Impact of `localStorage` operations.

3.  **Systematic Error Case Testing:**
    *   **Backend:** IMAP server down/unreachable, invalid IMAP credentials, IMAP timeouts, email parsing errors (if possible to inject malformed test data).
    *   **Frontend:** OpenAI API key invalid/missing, OpenAI rate limit errors (mock if hard to trigger), network interruption during fetch or OpenAI calls.
    *   **User Feedback:** Verify user-friendly error messages are displayed for all tested error conditions.

4.  **Code Review and Refactoring:**
    *   Conduct a thorough code review of all changes.
    *   Refactor any complex logic for clarity and maintainability.
    *   Ensure adherence to existing coding standards.

5.  **Update Documentation (if applicable):**
    *   If there's any user-facing documentation or internal technical documentation (`app-context.md` perhaps), update it to reflect the new `maxResults` behavior, especially the `fetchAllFolders` capping and `localStorage` changes for query history.

--- 