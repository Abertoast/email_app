# Email AI Processor

A web-based tool to connect to your email account via IMAP, fetch emails, and process their content using the OpenAI API based on your custom prompts. Extract information, summarize threads, find action items, and more, directly within the app.

**⚠️ Security Warning:** This application is currently a prototype and stores sensitive information (IMAP password, OpenAI API Key) directly in your browser's `localStorage`. This is **highly insecure** and not suitable for production or shared environments. Use with caution and only for testing/personal use on a secure machine. Future versions should implement a secure backend proxy for API calls and credential handling.

## Features

*   **IMAP Email Fetching:** Connect to standard IMAP servers (Gmail, etc.) to retrieve emails.
*   **Flexible Filtering:** Fetch emails based on folder, date range, read/unread status, and subject keywords.
*   **AI Processing:** Utilize the OpenAI API (GPT models) to process email content.
*   **Custom Prompts:** Define your own prompts to instruct the AI (e.g., "Summarize this email", "Extract action items", "Translate to Spanish").
*   **Prompt Library:** Save and reuse frequently used prompts.
*   **Variable Substitution:** Use variables like `{SUBJECT}` or `{SENDER}` in prompts.
*   **Query History:** View past queries (filters, prompt, results) and re-run them.
*   **Query History Results Replay:** Instantly view the exact results of any past query, including all processed results and raw emails, via a dedicated results view. Explore, filter, and copy results as if you had just run the query.
*   **Local Operation:** Runs primarily in the browser, using a lightweight backend only as an IMAP proxy.
*   **Unified Email & Result Cards:** Fetched emails and their AI-processed results are now displayed together in a single, unified card for each email, making it easier to review and act on results.
*   **Advanced Filtering:** Filter results using both tags (AI-extracted) and flags (labels/folders). The filter UI supports "OR" logic within tags or flags, and "AND" logic between the two groups, so you can find emails matching any selected tag and any selected flag.
*   **Merged Label/Folder Chips:** Labels and folders are visually merged in the UI, with duplicate names shown only once and clear color coding for system/user labels and folders.

## Technology Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS
*   **Backend:** Node.js, Express.js (designed for Vercel Serverless Functions)
*   **Email Fetching:** `node-imap`, `mailparser` (on the backend)
*   **AI Processing:** `openai` (client-side library)
*   **Routing:** `react-router-dom`
*   **State Management:** React Context API
*   **UI Components:** `lucide-react` (icons), `react-hot-toast` (notifications)

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   An email account with IMAP access enabled (and potentially an app password if using 2FA).
*   An OpenAI API key.

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd email-ai-processor
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Run the development server (frontend + backend):**
    This command uses `concurrently` to start the backend API and the Vite frontend development server.
    ```bash
    npm run dev:full
    # or
    yarn dev:full
    ```

4.  **Access the application:**
    Open your web browser and navigate to the local address provided by Vite (usually `http://localhost:5173`).

## Usage

1.  **Settings:** Navigate to the "Settings" page.
    *   Enter your IMAP server details (host, port, email, password/app password).
    *   Enter your OpenAI API Key and select a model/temperature.
    *   Click "Test Connection" to verify IMAP credentials.
    *   Click "Save Settings".
2.  **Dashboard:** Navigate to the main "Dashboard" page.
    *   Select email filters (folder, date range, status, subject).
    *   Choose a saved prompt or write a custom one in the text area.
    *   Click "Fetch & Process Emails".
3.  **Results:**
    *   Fetched emails will appear in the list.
    *   The AI processing results will be displayed below.
4.  **Prompt Library / Query History:** Explore these pages to manage saved prompts and view past query results.
    *   In Query History, use the new "Show Results" button to open a dedicated results view for any past query, displaying all emails and results as they were at the time of the query. You can filter, expand, and copy results just like on the dashboard.
4.  **Filtering & Results:**
    *   Results are shown as unified cards, each displaying the original email, its AI-processed content, and all associated tags, labels, and folders.
    *   Use the filter UI above the results to filter by any combination of tags and flags (labels/folders). Tags and flags use "OR" logic within their group, and "AND" logic between groups.
    *   Merged chips show all unique labels and folders for each email, with labels taking precedence if names overlap.

## Architecture Overview

The application uses a client-heavy architecture:

*   **Frontend (React SPA):** Handles UI, state management, `localStorage` persistence, routing, and **direct calls to the OpenAI API**. **Query history now stores the raw emails and UI state for each query, enabling full replay of past results.**
*   **Backend (Node.js/Express API):** Acts primarily as an **IMAP proxy**. It receives fetch requests from the frontend, connects to the IMAP server, retrieves emails, parses them, and sends the structured data back to the frontend. It does *not* handle OpenAI API calls.

## Security Considerations

As mentioned prominently at the top:

*   **OpenAI API Key Exposure:** The key is stored in `localStorage` and used directly in client-side code, making it visible in the browser. **This is insecure.**
*   **IMAP Password Storage:** The email password/app password is stored unencrypted in `localStorage`. **This is insecure.**

This setup prioritizes ease of development and local-only use over security best practices. **Do not deploy this application publicly in its current state.** A secure implementation would involve proxying OpenAI calls through the backend and implementing secure credential management.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests. (Consider adding more specific contribution guidelines if needed). 