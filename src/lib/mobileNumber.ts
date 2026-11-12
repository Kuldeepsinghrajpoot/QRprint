export function isValidMobileNumber(value: string): boolean {
  return /^\+?[0-9][0-9 -]{6,18}$/.test(value.trim());
}
