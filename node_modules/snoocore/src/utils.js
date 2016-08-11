
// checks basic globals to help determine which environment we are in
export function isNode() {
  return typeof require === "function" &&
  typeof exports === "object" &&
  typeof module === "object" &&
  typeof window === "undefined";
}

/*
   Return the value of `tryThis` unless it's undefined, then return `that`
 */
export function thisOrThat(tryThis, that) {
  return (typeof tryThis !== 'undefined') ? tryThis : that;
}

/*
   Return the value of `tryThir` or throw an error (with provided message);
 */
export function thisOrThrow(tryThis, orThrowMessage) {
  if (typeof tryThis !== 'undefined') { return tryThis; }
  throw new Error(orThrowMessage);
}
