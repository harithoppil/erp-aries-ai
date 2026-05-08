/**
 * Password hashing — Bun.password native API.
 *
 * - Defaults to argon2id (OWASP-recommended)
 * - verify() auto-detects algorithm from hash format (bcrypt + argon2id)
 * - ~3-5x faster than bcryptjs pure-JS implementation
 * - Bun pre-hashes passwords >72 bytes with SHA-512 before bcrypt
 *   (standard bcrypt silently truncates at 72 bytes)
 */

export async function hashPassword(
  password: string,
  options: { algorithm?: "bcrypt" | "argon2id"; cost?: number } = {}
): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: options.algorithm ?? "bcrypt",
    cost: options.cost ?? 12,
  });
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
