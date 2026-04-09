import bcrypt from "bcrypt";

const BCRYPT_COST = 12;
// bcrypt silently truncates at 72 bytes; enforce this explicitly so two
// passwords that differ only after byte 72 never hash to the same value.
const BCRYPT_MAX_BYTES = 72;

const assertPasswordLength = (password: string): void => {
  if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    throw new Error("Password exceeds maximum allowed length");
  }
};

export const hashPassword = (password: string): Promise<string> => {
  assertPasswordLength(password);
  return bcrypt.hash(password, BCRYPT_COST);
};

export const verifyPassword = (
  password: string,
  hash: string
): Promise<boolean> => {
  assertPasswordLength(password);
  return bcrypt.compare(password, hash);
};
