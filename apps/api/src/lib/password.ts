import argon2 from "argon2";

/** Argon2id with OWASP-recommended parameters. */
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, OPTIONS);
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain).catch(() => false);
