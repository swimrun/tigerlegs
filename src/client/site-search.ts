/** One hit of the search, as the search box shows it. */
export interface SearchHit {
  url: string;
  title: string;
  /** HTML with the matches in <mark>, made by Pagefind from the text of our own pages. */
  excerpt: string;
}

interface PagefindResult {
  data(): Promise<{ url: string; excerpt: string; meta?: { title?: string } }>;
}
interface PagefindApi {
  init(): Promise<void>;
  search(query: string): Promise<{ results: PagefindResult[] }>;
}

const MAX_HITS = 6;

/**
 * Loads the index that Pagefind wrote into `dist/pagefind/` after the build (ADR-0022). It does not exist in
 * development, so a failed load is reported as `null` and the box says that search is not available there.
 */
export async function loadSearch(base: string): Promise<((query: string) => Promise<SearchHit[]>) | null> {
  try {
    const api = (await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`)) as PagefindApi;
    await api.init();
    return async (query) => {
      if (!query.trim()) return [];
      const { results } = await api.search(query);
      const data = await Promise.all(results.slice(0, MAX_HITS).map((result) => result.data()));
      return data.map((hit) => ({ url: hit.url, title: hit.meta?.title ?? hit.url, excerpt: hit.excerpt }));
    };
  } catch {
    return null;
  }
}
