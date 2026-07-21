export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
