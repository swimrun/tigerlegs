import { assertEquals } from "@std/assert";
import { isLoggedIn, logIn, logOut, type SessionStore } from "../../src/client/fake-session.ts";

function memoryStore(): SessionStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

Deno.test("fake session: logged out by default, logIn and logOut toggle", () => {
  const store = memoryStore();
  assertEquals(isLoggedIn(store), false);
  logIn(store);
  assertEquals(isLoggedIn(store), true);
  logOut(store);
  assertEquals(isLoggedIn(store), false);
});
