import { expect, it } from "vitest";
import { isLoggedIn, logIn, logOut, type SessionStore } from "../../src/client/fake-session.ts";

function memoryStore(): SessionStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

it("fake session: logged out by default, logIn and logOut toggle", () => {
  const store = memoryStore();
  expect(isLoggedIn(store)).toEqual(false);
  logIn(store);
  expect(isLoggedIn(store)).toEqual(true);
  logOut(store);
  expect(isLoggedIn(store)).toEqual(false);
});
