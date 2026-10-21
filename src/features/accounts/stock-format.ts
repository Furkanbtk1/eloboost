export const MAX_STOCK_LINES = 200;

export type StockCredentials = { username: string; password: string; email?: string; emailPassword?: string };

/**
 * One account per line: "username password" or "username password email emailPassword".
 * Returns null when any line is malformed, so a typo never half-imports a batch.
 */
export function parseStockLines(text: string): StockCredentials[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0 || lines.length > MAX_STOCK_LINES) return null;

  const rows: StockCredentials[] = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length !== 2 && parts.length !== 4) return null;
    const [username, password, email, emailPassword] = parts;
    if (username.length > 100 || password.length > 128) return null;
    rows.push(email ? { username, password, email, emailPassword } : { username, password });
  }
  return rows;
}
