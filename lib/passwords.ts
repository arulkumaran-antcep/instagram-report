import 'server-only';
import { randomInt } from 'node:crypto';

export const PASSWORD_RULE = 'At least 12 characters, including a letter and a number.';

export const passwordProblem = (password: string): string | null => {
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > 128) return 'Password is too long.';
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return 'Password must include at least one letter and one number.';
  return null;
};

// Readable one-time password (no look-alike characters), e.g. "kq7m-xa3t-9wne".
export const temporaryPassword = () => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  let value = '';
  do value = `${group()}-${group()}-${group()}`;
  while (!/\d/.test(value) || !/[a-z]/.test(value));
  return value;
};
