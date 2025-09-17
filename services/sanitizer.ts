/**
 * Sanitizes a string by converting it to text content, effectively stripping any HTML tags.
 * This helps prevent Cross-Site Scripting (XSS) attacks.
 * @param str The input string to sanitize.
 * @returns A sanitized string with HTML characters escaped.
 */
export const sanitizeHTML = (str: string): string => {
  // A temporary element is created in memory, but not attached to the DOM.
  const temp = document.createElement('div');
  // By setting textContent, the browser automatically handles escaping of HTML entities.
  temp.textContent = str;
  // innerHTML will then return the string with characters like '<' converted to '&lt;'.
  return temp.innerHTML;
};
