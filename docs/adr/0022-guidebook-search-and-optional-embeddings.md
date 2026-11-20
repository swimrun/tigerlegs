# 22. Search and a guidebook chat: keyword search first, embeddings only after the visitor opts in

## 1. Status

Proposed. Nothing is built yet.

## 2. Context

The site needs a search box, and the chat should be able to answer questions about the software guidebook, which is one Markdown file with text only. The chat answers fixed questions today (the FAQ files) and, on the Training page, free questions through Gemini Nano. The visitor's data stays in the browser, and the site is static: it has no server to ask.

Gemini Nano cannot read the whole guidebook. The documentation of the Prompt API says that "Each session has a maximum number of tokens it can process", and that when a prompt does not fit, "the `prompt()` or `promptStreaming()` call will fail with a `QuotaExceededError` exception" (Chrome for Developers, n.d.). The documentation gives no number for this maximum, so the page reads it from the session at run time. The guidebook is about 22,000 words (counted with `wc -w`), far more than any window of an on-device model, but two or three sections would fit. So the chat has to find the right sections first and hand only those to the model: retrieval-augmented generation (RAG).

Finding sections can be done by keyword (the words of the question against the words of the text) or by meaning (embeddings: a model turns text into a vector, and sections near the vector of the question are the answer). Embeddings find "how can I help" for a section that says "contribute", where keywords miss it, but they have a cost. The question of the visitor must be turned into a vector with the same model that turned the sections into vectors, so that model has to run in the browser. The all-MiniLM-L6-v2 model for Transformers.js has "model_quantized.onnx" and "model_int8.onnx" files of 23 MB, against 90.4 MB for the full model, and it produces vectors of 384 numbers (Hugging Face, n.d.). Its licence is `apache-2.0` (Hugging Face, n.d.).

An embeddings service in the cloud, such as the Gemini embeddings API, does not fit a static site: every question would be sent to a server, which breaks the statement that the data stays in the browser, and the call needs a key that cannot be kept in a browser.

Pagefind is the search tool that Starlight, the documentation template of Astro, uses. It runs after `astro build` over the HTML in `dist/`, writes an index to `dist/pagefind/`, and searches in the browser without a server. It "will look for a lang attribute on your html element" and indexes each language separately (Pagefind, n.d.). Our pages hold all four languages in one HTML file, with the language of the page set on `<html>` by the language switch, so the languages have to be separated with filters.

## 3. Options

| Option                                         | What it is                                                                                        | For                                                                | Against                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| A. Keyword search with Pagefind                | The search box and the chat both use the Pagefind index; the chat hands the best sections to Nano | No model to download; small; the same index serves search and chat | Misses synonyms; guidebook is English only                               |
| B. A, and embeddings after the visitor opts in | A plus a 23 MB model, self-hosted, and a file of vectors made at build time                       | Finds sections by meaning                                          | A large download; more moving parts; only worth it where A is not enough |
| C. Embeddings from a cloud service             | Questions go to a service that returns vectors                                                    | No model in the browser                                            | Sends questions to a server; needs a key; breaks the privacy statement   |
| D. The whole guidebook in the prompt of Nano   | No retrieval                                                                                      | Nothing to build                                                   | Does not fit the context window                                          |

## 4. Decision

Option A first, and option B only when A proves not good enough. Not C or D.

- **One index for search and chat.** The build runs Pagefind over `dist/` after `astro build`. The search box of the site uses it, and the chat takes the best two or three sections from it for a free question.
- **Languages are filtered.** Each language block of a page carries a Pagefind filter for its language, so the visitor only gets results in the language that is on the page.
- **The chat shows what it found.** Without Nano, the chat shows the best section as text with a link to it. With Nano, the model writes the answer from only those sections, and the answer still links to them. Nano stays an improvement and not a requirement.
- **Only English for the model.** The guidebook is English and Nano does not support Dutch, French or German, so in those languages the chat keeps its fixed questions and the "no LLM" reply. The search box still works in every language for the pages that exist in it.
- **Embeddings are optional, and the visitor decides.** When keyword search misses too often, the chat offers once, after a free question: "Switch on better search (a one-time download of 23 MB that stays in your browser)", with progress while it downloads. The answer is remembered in `localStorage`. After "no" the chat does not ask again. The offer is not made when `navigator.connection.saveData` is set, when Nano is not available (there would be no answer to improve), or for languages other than English.
- **The model is hosted by us.** The build fetches `model_quantized.onnx` and its tokenizer files into `dist/`, and Transformers.js is told to load from there and not from a remote server, so nothing goes to a third party. The files are not committed.
- **The vectors are made at build time**, from the sections of the guidebook, with the same model and with mean pooling and normalisation, as the model card shows. The file with vectors is generated in the build, not committed.
- **No automatic download.** Nothing is fetched in the background; the model comes only after the visitor says yes.

## 5. Consequences

- The search box and the chat share one index, so a change to how the guidebook is split into sections changes both.
- Pagefind needs `dist/` to exist, so it is a step after the Astro build, in `npm run build` and in the GitHub Actions workflow.
- The browser tests need a search test (a word in a section, and a result in the language on the page) and a chat test that Nano is not required.
- Quality of the answers is not measured. Before option B is built there should be a small list of real questions with the section that answers each, so that "A is not good enough" is a result and not an impression.
- Option B adds a download of 23 MB for those who opt in, a model file in `dist/`, and a licence notice for the Apache-2.0 model.
- Translated guidebooks, if they come, are indexed by Pagefind in their own language without more work.
- Revisit when the guidebook is translated, when Chrome ships an embeddings API of its own, or when the context window of Nano changes.

## References

- Chrome for Developers. (n.d.). *The Prompt API*. Google. Retrieved November 21, 2026, from https://developer.chrome.com/docs/ai/prompt-api
- Hugging Face. (n.d.). *Xenova/all-MiniLM-L6-v2: onnx files*. Retrieved November 21, 2026, from https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main/onnx
- Pagefind. (n.d.). *Multilingual search*. Retrieved November 21, 2026, from https://pagefind.app/docs/multilingual
