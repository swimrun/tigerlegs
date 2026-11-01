const KEY = "tigerlegs.fake-session";

/** Prototype only: a flag, not authentication. Nothing is validated or sent anywhere. */
export interface SessionStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const isLoggedIn = (store: SessionStore): boolean => store.getItem(KEY) === "bart";
export const logIn = (store: SessionStore): void => store.setItem(KEY, "bart");
export const logOut = (store: SessionStore): void => store.removeItem(KEY);

export interface Profile {
  name: string;
  tagline: string;
  roles: string[];
  bio: string[];
  races: { year: string; title: string; note: string }[];
}

export const BART: Profile = {
  name: "Bart van der Wal",
  tagline: "Swimrunner · Full-stack DevOps developer",
  roles: ["Swimrunner", "Full-stack DevOps developer", "AI-augmented developer", "LLM / Agentic UI researcher"],
  bio: [
    "Bart builds TigerLegs together with the swimrun community around swimrun.group.",
    "He is currently an AI-augmented developer and researches LLM and Agentic UI integration (see issue #10).",
  ],
  races: [
    { year: "2025", title: "ÖTILLÖ Swimrun World Championship, Stockholm", note: "Sandhamn to Utö" },
    { year: "2027", title: "ÖTILLÖ World Championship", note: "Hoping to be back on the start line" },
  ],
};
