import { useEffect, useId, useRef, useState } from "react";
import { loadSearch, type SearchHit } from "../client/site-search.ts";
import { STRINGS } from "./SiteSearch.strings.ts";
import { usePageLang } from "./usePageLang.ts";

type Search = (query: string) => Promise<SearchHit[]>;

/** The search box of the header: it searches the text of the built pages with the Pagefind index (ADR-0022). */
export default function SiteSearch({ base }: { base: string }) {
  const lang = usePageLang();
  const t = STRINGS[lang];
  const id = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const search = useRef<Promise<Search | null> | null>(null);

  // The index is loaded on the first keystroke, so a page that is only read never fetches it.
  useEffect(() => {
    if (!query.trim()) {
      setHits(null);
      return;
    }
    search.current ??= loadSearch(base);
    let current = true;
    search.current.then(async (run) => {
      if (!current) return;
      if (!run) return setUnavailable(true);
      const found = await run(query);
      if (current) setHits(found);
    });
    return () => {
      current = false;
    };
  }, [query, base]);

  return (
    <div role="search" className="relative">
      <label htmlFor={id} className="sr-only">{t.label}</label>
      <input id={id} type="search" autoComplete="off" value={query} placeholder={t.placeholder} onChange={(e) => setQuery(e.target.value)}
        className="w-32 rounded border border-stone-900 bg-white px-2 py-0.5 text-sm sm:w-44" />
      {query.trim() && (unavailable || hits) && (
        <div data-search-results aria-label={t.results} className="absolute right-0 z-50 mt-1 max-h-96 w-80 max-w-[90vw] overflow-y-auto rounded border-2 border-stone-900 bg-white p-2 text-sm shadow-lg">
          {unavailable
            ? <p>{t.unavailable}</p>
            : hits && hits.length === 0
            ? <p>{t.noResults}</p>
            : (
              <ul className="space-y-2">
                {hits?.map((hit) => (
                  <li key={hit.url}>
                    <a href={hit.url} className="font-semibold underline">{hit.title}</a>
                    <p className="text-xs text-stone-700" dangerouslySetInnerHTML={{ __html: hit.excerpt }} />
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </div>
  );
}
