/**
 * Extracts the path component of a request URL, dropping the query string
 * and fragment so secrets passed as query params (tokens, API keys, ...)
 * never reach a log line.
 *
 * @param url - The raw request URL, e.g. as read from `request.url`.
 * @returns The URL's path only, with no leading-slash normalization.
 */
export function requestPath(url: string): string {
  const [path] = url.split(/[?#]/, 1);
  return path ?? url;
}
