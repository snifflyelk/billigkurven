import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

function derive(password: string, salt: string) {
  return scryptSync(password, salt, KEY_LENGTH).toString("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = derive(password, salt);
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const inputHash = derive(password, salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(inputHash, "hex");

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
