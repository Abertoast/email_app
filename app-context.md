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
    *   Displaying fetched emails and AI processing results.
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
    -   `POST /api/fetchEmails`: Receives IMAP credentials, host/port details, and search criteria (folder, dates, status, subject, max results) from the frontend. Connects to the IMAP server, fetches matching email UIDs, retrieves email bodies and attributes (flags, date, etc.), parses them using `mailparser`, and returns an array of email objects (id, sender, subject, date, read status, flags, body, folder). Handles fetching from multiple folders (`fetchAllFolders: true`) or a single specified folder. Includes logic to limit results per folder and sort the final combined list.
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
    -   Routing using `react-router-dom` (`BrowserRouter`, `Routes`, `Route`).
    -   The main `Layout` component.
    -   `react-hot-toast` configuration (`Toaster`).
-   **Structure**:
    -   `components/`: Reusable UI components (e.g., `Layout.tsx`, `EmailFilterForm.tsx`, `SavedPromptSelector.tsx`, `ProcessingResults.tsx`).
    -   `contexts/`: React Context providers for global state (`SettingsContext.tsx`, `EmailContext.tsx`).
    -   `pages/`: Top-level components for each route (`Dashboard.tsx`, `Settings.tsx`, `PromptLibrary.tsx`, `QueryHistory.tsx`).
    -   `utils/`: Utility functions (e.g., `promptUtils.ts` for variable substitution).
-   **State Management**:
    -   **`SettingsContext.tsx`**:
        -   Manages IMAP/SMTP settings, OpenAI API key/model/temperature, and email connection status.
        -   Manages saved prompts and prompt variables (e.g., `{USERNAME}`, `{EMAIL}`).
        -   Loads/saves all settings, prompts, and variables to `localStorage`.
        -   Provides `testEmailConnection` function (calls backend `/api/testConnection`).
        -   Provides functions to add/update/delete prompts and variables.
        -   Initializes with default settings (Gmail IMAP/SMTP) and example prompts/variables if none are found in `localStorage`.
    -   **`EmailContext.tsx`**:
        -   Manages email fetching and processing state (`isFetching`, `isProcessing`).
        -   Manages query history (`queryHistory`) and latest processing results (`latestResults`).
        -   Provides `fetchEmails` function: retrieves settings from `SettingsContext`, calls backend `/api/fetchEmails`, returns fetched emails.
        -   Provides `processEmails` function: retrieves OpenAI settings from `SettingsContext`, substitutes variables into the prompt using `utils/promptUtils.ts`, **calls the OpenAI Chat Completions API directly from the browser using the `openai` library**, handles individual vs. combined email processing, returns the AI-generated result.
        -   Provides functions to manage query history (save, clear, rerun).
        -   Loads/saves query history to `localStorage`.
        -   Includes `logToServer` utility to send frontend logs to `/api/log`.
-   **Key Pages**:
    -   **`Dashboard.tsx`**: The main interface. Contains the `EmailFilterForm`, prompt input/selection (`SavedPromptSelector`, custom textarea), displays fetched emails, triggers fetching and processing via `EmailContext`, and displays results using `ProcessingResults`.
    -   **`Settings.tsx`**: Allows users to input and save IMAP credentials (email, password/app password, host, port) and OpenAI settings (API key, model, temperature). Includes the "Test Connection" button. Saves settings via `SettingsContext` to `localStorage`.
    -   **`PromptLibrary.tsx`**: (Code not reviewed, but inferred purpose) Allows users to manage (view, add, edit, delete) saved prompts stored via `SettingsContext`.
    -   **`QueryHistory.tsx`**: (Code not reviewed, but inferred purpose) Displays past queries (filters, prompt, results) stored via `EmailContext` and allows re-running them.
-   **Layout (`Layout.tsx`)**: Provides the main application frame with a responsive sidebar for navigation between pages and displays connection status indicators (Email, API) based on `SettingsContext`.

## Data Flow (Main Workflow)

1.  **Configuration**: User enters IMAP and OpenAI credentials on the Settings page. These are saved to `localStorage` via `SettingsContext`. The "Test Connection" button verifies IMAP details via the backend `/api/testConnection`.
2.  **Query**: User navigates to the Dashboard page.
3.  User selects email filters (date, folder, status, etc.) and a processing prompt (either custom or saved).
4.  User initiates the process.
5.  **Fetch**: `Dashboard` calls `fetchEmails` (in `EmailContext`).
6.  `EmailContext` retrieves credentials from `SettingsContext` and sends a request to the backend `/api/fetchEmails`.
7.  **Backend Fetch**: Backend (`api/index.js`) connects to the user's IMAP server, executes the search, fetches matching emails, parses them, and returns the data to the frontend (`EmailContext`).
8.  `EmailContext` receives the email data and updates its state. `Dashboard` displays the fetched emails.
9.  **Process**: `Dashboard` calls `processEmails` (in `EmailContext`) with the fetched emails and the chosen prompt.
10. `EmailContext` retrieves OpenAI settings from `SettingsContext`.
11. `EmailContext` substitutes any variables (e.g., `{USERNAME}`) in the prompt.
12. **AI Call**: `EmailContext` **directly calls the OpenAI API from the browser** using the `openai` library, sending the prompt and email content(s).
13. `EmailContext` receives the response from OpenAI.
14. `EmailContext` updates `latestResults` state. `Dashboard` displays the results via `ProcessingResults`.
15. **History**: `EmailContext` saves the query parameters, prompt, and results to `localStorage`.

## Security Considerations

-   **OpenAI API Key Exposure**: The OpenAI API key is stored in `localStorage` and used directly in client-side JavaScript (`EmailContext`) to make calls to the OpenAI API. This means the key is exposed in the browser and is **highly insecure**. In a production environment, API calls should be proxied through the backend.
-   **IMAP Password Storage**: The user's email password (or app password) is stored in plain text in `localStorage`. This is **highly insecure**. While convenient for a local-only tool, this should never be done in a shared or production environment.
-   **Lack of Input Sanitization (Assumed)**: While not explicitly verified in all places, frontend applications must be careful about sanitizing user input (like prompts) and output (like AI results rendered as Markdown) to prevent cross-site scripting (XSS) attacks.

## Summary

The Email AI Processor is a functional prototype demonstrating how to fetch emails via IMAP and process them using AI. It heavily relies on client-side logic and `localStorage` for simplicity, but this comes with significant security drawbacks regarding credential handling (OpenAI key and email password). The backend serves primarily as an IMAP proxy. Core features include configurable email fetching, custom/saved prompt execution, prompt variable substitution, and query history. 