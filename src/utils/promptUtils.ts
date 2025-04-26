import { PromptVariable } from '../contexts/SettingsContext'; // Assuming PromptVariable is exported from SettingsContext

/**
 * Substitutes variables in a prompt string.
 * Replaces all occurrences of {key} (case-sensitive) with the corresponding value.
 * If a variable is not found, the placeholder remains.
 *
 * @param promptText The original prompt text.
 * @param variables An array of PromptVariable objects.
 * @returns The prompt text with variables substituted.
 */
export function substitutePromptVariables(
  promptText: string,
  variables: PromptVariable[]
): string {
  let substitutedText = promptText;

  variables.forEach(variable => {
    // Escape special characters in the key for regex safety, although
    // we are currently recommending simple keys (like USERNAME).
    // This handles potential future keys with special characters.
    const escapedKey = variable.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\{${escapedKey}\}`, 'g');
    substitutedText = substitutedText.replace(regex, variable.value);
  });

  return substitutedText;
} 