# 20. Isolated local development with an AI coding agent: a `sandbox-exec` allow-list for now, nono as the candidate

Date: 2026-11-15

## 1. Status

Draft. On 15 November 2026 pi-kit started under the profile: six processes stayed alive for 25 seconds and its backend listened on `127.0.0.1` only. Whether the app is usable, that the agent's tools work inside the sandbox of pi-kit itself, and what its log shows during real work have not been checked. The decision is taken as a preference, to be confirmed when pi-kit starts and its log shows no unexpected network or file access. Nono (option F) is a candidate to replace the hand-written profile and has not been tried.

## 2. Context

We want to develop TigerLegs, and let others contribute to it, with an AI coding agent that runs on the developer's own Mac, with a local model through Ollama, so that code and prompts stay on the device (the privacy principle of the guidebook). Every contributor who tries this carries the same risk, so the way of working is written down for them in section 4 of CONTRIBUTING.md. The agent that we looked at is pi-kit, "a desktop app for the pi coding agent" (Soverius-AI, n.d.).

A coding agent reads files and runs commands, and holds API keys when it uses a cloud model. pi-kit is open source, so we made a static review of commit `2650f3f` (version 0.90.1, 14 November 2026) on 15 November 2026. It was a targeted review with `grep` and reading, not a full audit of the 1547 source files: it did not cover the dependencies in `pnpm-lock.yaml`, the patched libraries in `patches/`, the `pi` agent that pi-kit bundles, the native Cua Driver binaries, or whether the signed release matches the source. Nothing was run.

What the review found:

- **No malicious pattern in what we read.** The install script `scripts/postinstall.mjs` has 22 lines and only makes a helper executable. The backend sets `COPILOTKIT_TELEMETRY_DISABLED` and `DO_NOT_TRACK` ("pi-kit is local-first", `apps/backend/src/app/telemetry-off.ts`).
- **Electron is hardened.** The windows use `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true` (`apps/desktop/src/main.ts`), the embedded browser denies every permission request (`apps/desktop/src/browser.ts`), and the app protocol sets a Content-Security-Policy.
- **Computer use is opt-in.** The package `@pi-kit/computer-use` lets the agent look at the screen and operate apps, but "Installing does nothing yet. Computer use is **off until you turn it on**" (its README).
- **The release is signed and notarized, but under another name than the repository.** `spctl -a -vv` on the installed app reports "source=Notarized Developer ID" and "origin=Developer ID Application: CodeRabbit GmbH (RNK7YZ53MM)"; `codesign --verify --deep --strict` reports "valid on disk", and `xcrun stapler validate` accepts the notarization ticket (15 November 2026). The repository names "Soverius.AI GmbH" as author and copyright holder (`package.json`, `electron-builder.config.cjs`) and contains no Team ID, because the identity is read from the environment at release time. The GitHub organization Soverius AI lists a website `soverius.ai` and the location Austria, and one of its three contributors lists "CodeRabbit GmbH" with an Austrian (`.at`) website on a self-declared profile. We found no formal link between the two companies. Apple's notarization is an automated check for malicious content, not a statement that the vendor is trustworthy, and a valid signature shows who built the binary, not that the binary matches the source. "CodeRabbit GmbH" is not necessarily the company behind the code review product of the same name; we did not check that.
- **The release is built in CI from the commit that we reviewed, and the download is intact.** The tag `v0.90.1` points to commit `2650f3f`. The workflow `.github/workflows/release.yml` builds the Mac release on a GitHub-hosted `macos-15` runner with `pnpm run release --only mac`, signs it with a certificate that is stored as the repository secret `MAC_CSC_LINK`, and ran successfully for that commit on 14 November 2026 at 09:15 UTC; the release was published at 09:25. The SHA-256 of our downloaded DMG equals the digest that GitHub shows for the release asset, and its SHA-512 equals the value in the update manifest `latest-mac.yml`. What is missing: there is no build provenance attestation (`gh attestation verify` answers HTTP 404), no checksum file of the vendor's own, and no claim in the repository that a build is reproducible. We did not rebuild the app, so we cannot say that the binary is exactly what the source produces.
- **Updates come from the vendor.** `electron-updater` reads the GitHub repository named in `app-update.yml`, with `autoDownload = false` and `autoInstallOnAppQuit = true` (`apps/desktop/src/app-updater.ts`). We trust the vendor's account for each update.
- **It is built to call many hosts:** model providers, MCP servers of third parties, huggingface.co for models, a usage gateway at `radius.pi.dev` (`apps/backend/src/usage/usage-adapters.ts`), and Tailscale. We did not check what data goes where. Our profile blocks all of it, which is the purpose.
- **Generated interfaces run code.** `apps/backend/src/agui/genui-sandbox.controller.ts` sets a policy with `script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com`. That is the opposite of the declarative catalog of ADR-0019, where the agent never sends code. We did not check how the frame around it is isolated.
- **It has a sandbox of its own.** `@pi-kit/sandbox` runs the file, search and shell tools of the agent "inside an SRT (0.0.81) sandbox" and "When the sandbox is unavailable, requests fail; nothing ever falls back to the host" (its README). Its own design note says that the protection is an "opt-in" extension and that "Bypass is the default" (`doc/designs/security-sandboxing-research.md`), so by default it does not apply. The same note says that on macOS it relies on `sandbox-exec` and Seatbelt, so, if it is switched on inside our profile, we expect it to fail in the same way as Chromium's sandbox did (a sandbox inside a sandbox). That is our inference and we have not tested it.

The repository was created on 18 October 2026, has 4 stars and no forks, is MIT licensed, and belongs to an organization created on 22 April 2026 (Soverius-AI, n.d.). A review without a finding is not a guarantee, and the project has too little use to rely on the work of others, so the app is confined and not only reviewed.

The wishes of the owner:

1. The agent may read and write in the TigerLegs folder, and read nothing else of the user's files.
2. It may talk to Ollama on `localhost`, and to nothing else on the network. A web search is a separate, deliberate step.
3. We can see what it tries to do.
4. No second macOS user: logging in again is not acceptable for daily development.

## 3. Options

| Option                                     | What it is                                                                                 | For                                                                                       | Against                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. No sandbox                              | Run the app as the user                                                                    | Nothing to set up                                                                         | The agent reaches `~/.ssh`, keys and all other projects                                                                                                                 |
| B. `sandbox-exec` with an allow-list       | A profile with `(deny default)` that lists what is allowed, applied to the whole app       | Built into macOS; deny by default; the log shows each refusal                             | Deprecated; Electron needs `--no-sandbox`; the profile needs tuning per app                                                                                             |
| C. Separate macOS user                     | The agent runs under another account, with a firewall for the network                      | Supported by Apple; Chromium keeps its own sandbox                                        | Rejected by the owner (a new login); the project folder needs shared permissions                                                                                        |
| D. Virtual machine or container            | The agent runs in a guest system                                                           | Strongest separation                                                                      | A container on macOS runs in a Linux VM without the Apple GPU, so a model is slow; not checked                                                                          |
| E. App Sandbox (Apple's recommended route) | Entitlements in the app's signature                                                        | The route Apple names                                                                     | The developer of the app has to build it in; re-signing someone else's Electron app is fragile                                                                          |
| F. nono                                    | A single binary that confines an agent, with composable JSON profiles and domain filtering | A maintained tool with ready profiles, including one for `pi`; per-domain network control | Pre-1.0; the README does not say how it sandboxes on macOS or whether it runs a GUI app; not tried                                                                      |
| G. microsandbox                            | microVMs for untrusted workloads, with a network allow-list                                | Hardware-level isolation; Docker-like workflow                                            | Beta; runs container images (Linux), so it fits a command-line agent in a guest, not a macOS app such as pi-kit (our inference; the README does not address macOS apps) |

## 4. Decision

Option B, as a preference and for a trial period.

- The profile is [scripts/sandbox/pi-kit-allow.sb](../../scripts/sandbox/pi-kit-allow.sb). It denies everything and allows: read and write in the project folder, read and execute of the system files and tools that a program needs to start, the app's own data folders, a few local services of the window system, and network traffic to `localhost` only.
- Left closed on purpose: the clipboard (a copied password would be readable), keyboard and mouse control, the user's home folder, and the internet.
- Electron is started with `--no-sandbox`. The reason is a limit of macOS and not a gain: Chromium's helper processes (GPU, network) each try to apply their own sandbox, and in a process that is already sandboxed this fails with "sandbox initialization failed: Operation not permitted". Both layers at once do not work.
- pi-kit asks for Chromium's sandbox itself (`sandbox: true` in `apps/desktop/src/main.ts`), so `--no-sandbox` switches off a protection that the app wants. The outer profile replaces it for the whole process tree.
- The cost of `--no-sandbox` is that the windows no longer have fewer rights than the main process; they have the rights of the profile. A compromised window can then write in the project folder and reach `localhost`, but not the keys, the home folder or the internet.
- Network visibility comes from the system log: `/usr/bin/log stream --predicate 'eventMessage CONTAINS "deny"'`. A sandbox cannot ask the user per request. A web search is therefore a second profile that is started on purpose, or a firewall with a prompt per connection.

Nono is the candidate to take over, because it does what the hand-written profile does as a maintained tool: "nono is a complete agent runtime security tool", with profiles that "define filesystem scope, network allowlist, hooks, skills and more", "domain filtering" for the network, and a command that scaffolds a profile for the coding agent itself, `nono profile init pi-local --extends nolabs-ai/pi` (nolabs-ai, n.d.). Search summaries say that it uses Seatbelt on macOS, the mechanism behind `sandbox-exec`; the README that we read does not confirm that, so it is not a fact here. Nono is taken up in place of the own profile when:

1. it runs pi-kit, an Electron app, or the command-line `pi` agent that a profile in its README names, on macOS under a profile that keeps the rules of this section;
2. its network control shows each connection, so that the owner sees which calls the agent makes;
3. it has left the lead-up to 1.0, in which "API changes may still occur" (nolabs-ai, n.d.), or has proven stable enough in a short check (not a build-off of both).

Microsandbox (option G) is not chosen for pi-kit: it runs workloads in "tiny virtual machines" from container images (superradcompany, n.d.), which suits a command-line agent in a Linux guest and not a macOS app. It stays an option if we move to a command-line agent, with the project folder mounted into the guest. Its README states that it "is still beta software" (superradcompany, n.d.).

The man page of the tool says it plainly: "The sandbox-exec command is DEPRECATED. Developers who wish to sandbox an app should instead adopt the App Sandbox feature described in the App Sandbox Design Guide" (Apple, 2017). We use it anyway because option E does not apply to an app that we do not build, and because the profile is a short text that makes visible what the app may do.

## 5. Consequences

- The profile lives in the repository, so that other developers can use and improve it. It is written for pi-kit; another agent needs its own tuning from the log.
- The profile is tuned with the log: start, read the refusals, add one rule, repeat. This worked for `git` and for the first Electron checks (the lookup of the helper apps, the single-instance socket, the Mach service of the helper processes).
- Keep real API keys out of reach while testing; a sandbox limits damage but does not make an app trustworthy.
- Ollama itself runs outside the sandbox as its own process; the app only needs to reach `localhost:11434`. The profile allows all `localhost` ports for now and should be narrowed to the ports that the log shows.
- `sandbox-exec` can disappear in a future macOS version. Revisit when it does, when pi-kit offers a sandboxed build, or when Apple offers a supported way to confine a command.

## References

- Apple. (2017). *sandbox-exec(1)* [Manual page, macOS 15.7.4]. Read with `man sandbox-exec`; no online copy was checked.
- nolabs-ai. (n.d.). *nono* [Source code repository]. GitHub. Retrieved November 15, 2026, from https://github.com/nolabs-ai/nono
- Soverius-AI. (n.d.). *pi-kit* [Source code repository]. GitHub. Retrieved November 15, 2026, from https://github.com/soverius-ai/pi-kit
- superradcompany. (n.d.). *microsandbox* [Source code repository]. GitHub. Retrieved November 15, 2026, from https://github.com/superradcompany/microsandbox
