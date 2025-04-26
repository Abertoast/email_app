# Feature Implementation Plan: Prompt Variables

## 1. Goal

To allow users to define reusable key-value pairs (variables) like `{USERNAME}` or `{EMAIL}` that can be inserted into saved prompts. When a prompt is used, these variables should be dynamically replaced with their corresponding user-defined values.

## 2. Data Storage & Management

*   **Storage:** Use `localStorage` to persist the variables, consistent with current settings/prompts storage.
    *   Key: `emailai-prompt-variables`
    *   Structure: `Array<{ id: string, key: string, value: string }>` (Using an ID for easier updates/deletes).
*   **Context:** Modify `src/contexts/SettingsContext.tsx`.
    *   Add state for `promptVariables`: `const [promptVariables, setPromptVariables] = useState<PromptVariable[]>([]);` (Define `PromptVariable` interface).
    *   Load variables from `localStorage` in the initial `useEffect` hook, potentially setting defaults like `{USERNAME}` and `{EMAIL}` if none are found.
    *   Add functions to manage variables:
        *   `addVariable(variable: Omit<PromptVariable, 'id'>): void` (generates ID, updates state, saves to `localStorage`)
        *   `updateVariable(variable: PromptVariable): void` (updates state, saves to `localStorage`)
        *   `deleteVariable(id: string): void` (updates state, saves to `localStorage`)
    *   Expose `promptVariables` and these functions through the context value.

## 3. Core Logic: Variable Substitution

*   **Location:** Identify the code path where a saved prompt's text is retrieved before being used (e.g., before sending to the AI).
*   **Implementation:** Create a utility function, perhaps `substitutePromptVariables(promptText: string, variables: PromptVariable[]): string`.
    *   This function will iterate through the `variables`.
    *   For each variable, it will replace all occurrences of `{key}` (case-sensitive) in the `promptText` with the corresponding `value`.
    *   Call this function on the prompt text immediately before it's used.
*   **Handling Missing Variables:** If a prompt contains a variable like `{UNDEFINED_VAR}` that hasn't been defined by the user, the substitution logic should leave the placeholder `{UNDEFINED_VAR}` in the text.

## 4. UI Implementation

*   **Variable Management Component (`PromptVariablesManager.tsx`):**
    *   Create a new component to display and manage variables.
    *   Fetch `promptVariables`, `addVariable`, `updateVariable`, `deleteVariable` from `useSettings()`.
    *   Display variables in a list or table format.
        *   Show `key` and `value` for each.
        *   Provide an "Edit" button (optional, could just delete and re-add) and a "Delete" button per variable.
    *   Include input fields (`key`, `value`) and an "Add Variable" button to create new variables.
    *   Perform basic validation (e.g., key should not be empty, maybe prevent duplicate keys).
    *   **Integration:** Add this component to a suitable location, likely the `PromptLibrary` page (`src/pages/PromptLibrary.tsx`) or potentially the `Settings` page.
*   **Prompt Editor Enhancement:**
    *   **Location:** Modify the component responsible for editing prompt text (e.g., within `PromptLibrary.tsx` or a dedicated `PromptEditForm` component).
    *   **Functionality:**
        *   Fetch `promptVariables` from `useSettings()`.
        *   Add a dropdown, button list, or similar UI element near the prompt text area.
        *   This element should display the available variable keys (e.g., "Insert {USERNAME}", "Insert {EMAIL}", etc.).
        *   Clicking a variable key should insert the corresponding `{key}` string into the prompt text area at the current cursor position.

## 5. Implementation Steps

1.  **Modify `SettingsContext.tsx`:**
    *   Define `PromptVariable` interface.
    *   Add `promptVariables` state.
    *   Implement loading from `localStorage` (with defaults).
    *   Implement `addVariable`, `updateVariable`, `deleteVariable` functions (including `localStorage` updates).
    *   Export new state and functions via context.
2.  **Implement Substitution Logic:**
    *   Create the `substitutePromptVariables` utility function.
    *   Integrate the substitution call into the workflow where prompts are used.
3.  **Create `PromptVariablesManager.tsx` Component:**
    *   Build the UI for listing, adding, and deleting variables.
    *   Connect it to the `SettingsContext` functions.
4.  **Integrate `PromptVariablesManager`:**
    *   Add the new component to the chosen page (`PromptLibrary` or `Settings`).
5.  **Enhance Prompt Editor:**
    *   Modify the prompt editing UI to include the "Insert Variable" functionality.
    *   Connect it to `promptVariables` from the context.

## 6. Considerations

*   **Variable Naming:** Keys should likely be restricted (e.g., alphanumeric, underscore) and maybe enforced as uppercase for convention, surrounded by `{}`.
*   **Security:** Storing potentially sensitive information (like API keys if users create variables for them) in `localStorage` is insecure. This plan follows the existing pattern, but a more secure storage mechanism should be considered for production applications.
*   **User Experience:** Ensure the variable management UI is clear and easy to use. Make inserting variables into prompts intuitive.
*   **Default Variables:** Confirm the desired default variables (`USERNAME`, `EMAIL`) and ensure they are created appropriately if no saved variables exist. 