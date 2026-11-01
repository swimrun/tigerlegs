import { useEffect, useState } from "react";
import { BART, isLoggedIn, logIn, logOut } from "../client/fake-session.ts";

export default function Profile() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => setLoggedIn(isLoggedIn(sessionStorage)), []);
  if (loggedIn === null) return null;

  if (!loggedIn) {
    return (
      <form className="mx-auto max-w-sm space-y-3 rounded border-2 border-stone-900 bg-amber-50 p-4"
        onSubmit={(e) => { e.preventDefault(); logIn(sessionStorage); setLoggedIn(true); }}>
        <h2 className="text-lg font-bold">Log in</h2>
        <p className="text-sm">Design prototype: there are no real accounts. Any input works, nothing is sent, and you always log in as Bart.</p>
        <label className="block text-sm font-medium">Email
          <input type="email" autoComplete="off" className="mt-1 w-full rounded border border-stone-900 bg-white px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">Password
          <input type="password" autoComplete="off" className="mt-1 w-full rounded border border-stone-900 bg-white px-3 py-2" />
        </label>
        <button type="submit" className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Log in</button>
      </form>
    );
  }

  return (
    <article className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold">{BART.name}</h2>
        <p className="text-stone-600">{BART.tagline}</p>
      </header>
      <ul aria-label="Roles" className="flex flex-wrap gap-2">
        {BART.roles.map((role) => (
          <li key={role} className="rounded-full border border-stone-900 bg-amber-200 px-3 py-1 text-sm font-medium">{role}</li>
        ))}
      </ul>
      {BART.bio.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      <section aria-labelledby="races-title">
        <h3 id="races-title" className="font-bold">Races</h3>
        <ul className="mt-1 space-y-1">
          {BART.races.map((race) => (
            <li key={race.year}><strong>{race.year}</strong> · {race.title} <span className="text-stone-600">({race.note})</span></li>
          ))}
        </ul>
      </section>
      <button type="button" className="rounded border border-stone-900 px-4 py-2 text-sm font-semibold"
        onClick={() => { logOut(sessionStorage); setLoggedIn(false); }}>Log out</button>
    </article>
  );
}
