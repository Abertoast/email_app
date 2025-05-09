# Email AI Processor - Application Context

## Overview

This application is a web-based tool designed to connect to a user's email account via IMAP, fetch emails based on specified criteria, and process the content of those emails using the OpenAI API according to user-defined prompts. It allows users to extract information, summarize emails, identify action items, etc., directly from their inbox within the app's interface.

The application runs entirely locally in the browser, communicating with a lightweight backend API only for email fetching (IMAP proxy) and optional client-side logging. All settings, including sensitive credentials (IMAP password, OpenAI API key), and user data (prompts, query history) are stored in the browser's `localStorage`.

## Technology Stack

-   **Frontend**: React, Vite, TypeScript, Tailwind CSS
-   **Backend**: Node.js, Express.js (running as a Vercel Serverless Function)
-   **Email Fetching**: `node-imap`, `mailparser` (on the backend)
-   **AI Processing**: `openai` (client-side library)
-   **Routing**: `react-router-dom`
-   **State Management**: React Context API
-   **UI Components**: `lucide-react` (icons), `react-hot-toast` (notifications)
-   **Development**: `nodemon` (backend hot-reloading), `concurrently` (running frontend/backend together)

## Architecture

The application follows a client-server architecture, but with a heavy emphasis on client-side logic:

1.  **Frontend (`src/`)**: A React single-page application (SPA) built with Vite. It handles:
    *   User Interface (UI) and User Experience (UX).
    *   Routing between different pages.
    *   Managing application state (settings, email data, prompts, history) via React Context.
    *   Storing settings and data in `localStorage`.
    *   Constructing requests to the backend API for fetching emails.
    *   **Directly calling the OpenAI API from the browser** to process email content.
    *   Displaying fetched emails and AI processing results as unified cards, each showing the original email, its AI-processed content, and all associated tags, labels, and folders.
2.  **Backend (`api/index.js`)**: A lightweight Node.js/Express API deployed as a Vercel serverless function. Its responsibilities are limited to:
    *   **IMAP Proxy**: Accepting requests from the frontend with IMAP credentials and query parameters, connecting to the specified IMAP server using `node-imap`, fetching emails, parsing them (using `mailparser`), and returning the results to the frontend.
    *   **Connection Testing**: Providing an endpoint (`/api/testConnection`) for the frontend to verify IMAP credentials.
    *   **Logging**: Providing an endpoint (`/api/log`) to receive and log messages sent from the frontend.
3.  **Development Server (`npm run dev:full`)**: Uses `concurrently` to run:
    *   The backend API server (`nodemon api/index.js` on port 3001).
    *   The Vite frontend development server (`npm run dev`), after waiting for the backend to be ready using `wait-on`.

## Backend Details (`api/index.js`)

-   **Purpose**: Primarily acts as a secure intermediary for IMAP operations, avoiding the need for the browser to handle IMAP connections directly.
-   **Key Endpoints**:
    -   `POST /api/fetchEmails`: Receives IMAP credentials, host/port details, and search criteria (folder, dates, status, subject, max results, `fetchAllFolders`) from the frontend. Connects to the IMAP server, fetches matching email UIDs, retrieves email bodies and attributes (flags, date, etc.), parses them using `mailparser`, and returns an array of email objects (id, sender, subject, date, read status, flags, body, folder). Handles fetching from multiple folders (`fetchAllFolders: true`) or a single specified folder. Includes logic to limit results per folder and sort the final combined list.
    -   `POST /api/testConnection`: Receives IMAP credentials and host/port. Attempts to connect to the IMAP server to validate the credentials and returns `{ success: true }` or `{ success: false, error: '...' }`.
    -   `POST /api/log`: Receives log messages (level, message) from the frontend and prints them to the Vercel function logs, prefixed with `[CLIENT]`.
    -   `GET /`: Simple health check endpoint used by `wait-on` during development startup.
-   **IMAP Interaction**: Uses the `node-imap` library for all IMAP communication and `mailparser` for parsing raw email source into structured objects. Uses `util.promisify` for asynchronous operations.
-   **Configuration**: The `createImapConnection` function configures the `node-imap` connection, including TLS settings (enabled for port 993) and timeouts. It includes commented-out code that previously disabled TLS certificate validation (`rejectUnauthorized: false`) for debugging, but this is currently inactive.
-   **Deployment**: Deployed via Vercel. The `vercel.json` file routes all requests matching `/api/*` to this `api/index.js` serverless function. The code includes a check (`!process.env.VERCEL`) to only run `app.listen` when running locally, not on Vercel.

## Frontend Details (`src/`)

-   **Entry Point**: `src/main.tsx` renders the main `App` component into the root HTML element.
-   **Core Component**: `src/App.tsx` sets up:
    -   Context Providers (`SettingsProvider`, `EmailProvider`).
    -   Routing using `react-router-dom` (`BrowserRouter`, `Routes`, `Route` for Dashboard, Settings, PromptLibrary, and QueryHistory pages).
    -   The main `Layout` component.
    -   `react-hot-toast` configuration (`Toaster`).
-   **Structure**:
    -   `components/`: Reusable UI components (e.g., `Layout.tsx`, `EmailFilterForm.tsx`, `SavedPromptSelector.tsx`, `ProcessingResults.tsx`, `PromptVariablesManager.tsx`, `TagManager.tsx`).
    -   `contexts/`: React Context providers for global state (`SettingsContext.tsx`, `EmailContext.tsx`).
    -   `pages/`: Top-level components for each route (`Dashboard.tsx`, `Settings.tsx`, `PromptLibrary.tsx`, `QueryHistory.tsx`).
    -   `utils/`: Utility functions (e.g., `promptUtils.ts` for variable substitution).
-   **State Management**:
    -   **`SettingsContext.tsx`**:
        -   Manages IMAP/SMTP settings, OpenAI API key/model/temperature, and email connection status.
        -   Manages saved prompts (`SavedPrompt[]`), prompt variables (`PromptVariable[]`), and **prompt tags (`Tag[]`)**. The `Tag` interface includes `id`, `name` (unique), `marker` (unique, e.g., `[[TagName]]`), and `color`.
        -   Loads/saves all settings, prompts, variables, and **tags** to `localStorage` (keys: `emailai-settings`, `emailai-prompts`, `emailai-prompt-variables`, `emailai-tags`).
        -   Provides `testEmailConnection` function (calls backend `/api/testConnection`).
        -   Provides CRUD functions to add/update/delete prompts, variables, and **tags**.
        -   Initializes with default settings, example prompts/variables, and **example tags** if none are found in `localStorage`.
    -   **`EmailContext.tsx`**:
        -   Manages email fetching and processing state (`isFetching`, `isProcessing`).
        -   Manages query history (`queryHistory`) and latest processing results (`latestResults`). The structure for results when processed individually (`ProcessedEmailResult`) now includes a `tags: string[]` array intended to hold extracted tag names.
        -   Provides `fetchEmails` function: retrieves settings from `SettingsContext`, calls backend `/api/fetchEmails` (including the `fetchAllFolders` flag), returns fetched emails.
        -   Provides `processEmails` function: retrieves OpenAI settings from `SettingsContext`, substitutes variables into the prompt using `utils/promptUtils.ts`, **calls the OpenAI Chat Completions API directly from the browser using the `openai` library**, handles individual vs. combined email processing. **Note:** The logic to parse `[[Tag Markers]]` from the response, remove them, and populate the `tags` array in `ProcessedEmailResult` is currently missing/inactive.
        -   Provides functions to manage query history (save, clear, rerun), which now store the new result structure. **Query history now also stores the raw emails fetched for each query (`rawEmails`) and optional UI state (`uiState`), enabling full results replay.**
        -   Loads/saves query history to `localStorage` (with migration for old entries).
        -   Includes `logToServer` utility to send frontend logs to `/api/log`.
-   **Key Pages & Components**:
    -   **`Dashboard.tsx`**: The main interface. Contains the `EmailFilterForm`, prompt input/selection (`SavedPromptSelector`, custom textarea), displays fetched emails, triggers fetching and processing via `EmailContext`, and displays results using `ProcessingResults`. Includes buttons below the custom prompt textarea to insert prompt variables and **tag markers**.
    -   **`Settings.tsx`**: Allows users to input and save IMAP credentials and OpenAI settings.
    -   **`PromptLibrary.tsx`**: Allows users to manage (view, add, edit, delete) saved prompts. Each prompt can optionally specify a model and temperature, which override the global default when used.
    -   **`PromptVariablesManager.tsx`**: Component for managing prompt variables (CRUD operations).
    -   **`TagManager.tsx`**: Component for managing prompt tags (CRUD operations via modal). Simplifies creation by only asking for a Name and Color, automatically generating the `[[Marker]]` from the name.
    -   **`ProcessingResults.tsx` & `UnifiedEmailCard.tsx`**: Results views now include a "Download CSV" button to export filtered or processed results. When processing large numbers of emails, results are processed in batches of 100, and progress is shown in the UI.
    -   **`QueryHistory.tsx`**: Displays past queries (filters and prompt used) and their results (handling both combined string results and individual array results). Allows re-running past queries. **Now includes a "Show Results" button for each query, which opens a dedicated results view page (`/history/:id/results`) showing the exact results and emails as they were at the time of the query.**
    -   **`HistoryResultsView.tsx`**: Dedicated page for viewing the results of a past query, including all processed results, raw emails, and filter/exploration UI. Lets users explore, filter, and copy results as if they had just run the query.
-   **Layout (`Layout.tsx`)**: Provides the main application frame.

## Data Flow (Main Workflow)

1.  **Configuration**: User enters IMAP/OpenAI credentials (`Settings.tsx`). User defines reusable Prompt Variables and **Prompt Tags** (`PromptLibrary.tsx` via `PromptVariablesManager` and `TagManager`). All saved to `localStorage` via `SettingsContext`.
2.  **Query**: User navigates to the Dashboard page.
3.  User selects email filters (including `fetchAllFolders`), and chooses/writes a processing prompt, potentially inserting variables and **tag markers** using helper buttons.
4.  User initiates the process.
5.  **Fetch**: `Dashboard` calls `fetchEmails` (in `EmailContext`).
6.  `EmailContext` retrieves credentials from `SettingsContext` and sends a request to the backend `/api/fetchEmails` with the specified query parameters (folder, dates, status, subject, max results, `fetchAllFolders`).
7.  **Backend Fetch**: Backend (`api/index.js`) connects via IMAP, fetches emails based on criteria, parses, returns data to `EmailContext`.
8.  `EmailContext` receives email data. `Dashboard` displays fetched emails.
9.  **Process**: `Dashboard` calls `processEmails` (in `EmailContext`) with emails and prompt.
10. `EmailContext` retrieves OpenAI settings, including per-prompt model and temperature if specified.
11. `EmailContext` substitutes variables in the prompt.
12. **AI Call**: `EmailContext` calls the OpenAI API (client-side), processing emails in batches of 100 if needed. Progress is shown in the UI.
13. `EmailContext` receives the response.
14. `EmailContext` parses the AI response, identifies defined `[[Tag Markers]]`, removes them, and stores the corresponding tag names in a `tags` array on the result object.
15. `EmailContext` updates `latestResults` state with the processed content (and potentially tags). `Dashboard` displays the results via `ProcessingResults`, where users can copy or download results as CSV.
16. **Tag & Flag Display/Filter**: `ProcessingResults` (and `Dashboard`) read `latestResults`. If individual processing was used, results are shown as unified cards with merged label/folder chips and tag badges. The filter UI allows filtering by tags and flags (labels/folders), using OR logic within each group and AND logic between groups.
17. **History**: `EmailContext` saves the query, prompt, and results (including the `tags` array, if it were populated) to `localStorage`. **Now also saves the raw emails and UI state, enabling full replay of past results.**

## Security Considerations

-   **OpenAI API Key Exposure**: The OpenAI API key is stored in `localStorage` and used directly in client-side JavaScript (`EmailContext`) to make calls to the OpenAI API. This means the key is exposed in the browser and is **highly insecure**. In a production environment, API calls should be proxied through the backend.
-   **IMAP Password Storage**: The user's email password (or app password) is stored in plain text in `localStorage`. This is **highly insecure**. While convenient for a local-only tool, this should never be done in a shared or production environment.
-   **Lack of Input Sanitization (Assumed)**: While not explicitly verified in all places, frontend applications must be careful about sanitizing user input (like prompts) and output (like AI results rendered as Markdown) to prevent cross-site scripting (XSS) attacks.

## Summary

The Email AI Processor is a functional prototype demonstrating how to fetch emails via IMAP and process them using AI. It now features unified cards for each email/result, advanced filtering by tags and flags (labels/folders) with intuitive UI (OR logic within tags/flags, AND logic between groups), and merged label/folder chips for clarity. **The Query History feature now allows users to view the exact results of any past query, including all processed results and raw emails, via a dedicated results view.** It heavily relies on client-side logic and `localStorage` for simplicity, but this comes with significant security drawbacks regarding credential handling (OpenAI key and email password). The backend serves primarily as an IMAP proxy. Core features include configurable email fetching, custom/saved prompt execution, prompt variable substitution, prompt tag management/insertion/display/filtering, a "Copy All" feature for filtered results, and query history with full results replay. 

-   **Download CSV:** Export filtered or processed results as a CSV file for further analysis.
-   **Per-Prompt Model & Temperature:** Saved prompts can specify a model and temperature, or use the global default from Settings.
-   **Increased Email Fetch Limit & Batching:** Fetch and process up to 1000 emails at a time, with processing done in batches of 100 to respect LLM API rate limits and improve reliability. Progress is shown in the UI.

The Email AI Processor is a functional prototype demonstrating how to fetch emails via IMAP and process them using AI. It now features unified cards for each email/result, advanced filtering by tags and flags (labels/folders) with intuitive UI (OR logic within tags/flags, AND logic between groups), and merged label/folder chips for clarity. **The Query History feature now allows users to view the exact results of any past query, including all processed results and raw emails, via a dedicated results view.** It heavily relies on client-side logic and `localStorage` for simplicity, but this comes with significant security drawbacks regarding credential handling (OpenAI key and email password). The backend serves primarily as an IMAP proxy. Core features include configurable email fetching, custom/saved prompt execution, prompt variable substitution, prompt tag management/insertion/display/filtering, a "Copy All" feature for filtered results, and query history with full results replay. 