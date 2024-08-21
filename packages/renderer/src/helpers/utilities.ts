// function to capitalize first letter of a string
export function capitalize(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function clone(obj: unknown) {
  return JSON.parse(JSON.stringify(obj));
}
