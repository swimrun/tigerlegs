# Contributing to TigerLegs

TigerLegs is currently developed by a small, invited group. The repository is private, so access is by invitation only.

## 1. Want to help?

Message Bart in the SwimRun huiskamer group. Once you are introduced there, you get access to the repository.

## 2. Working agreements

- Read [AGENTS.md](./AGENTS.md) first. It holds the working agreements.
- Run `npm test` and `npm run build` before you push.
- Write commit messages in the imperative mood ("Add ...", "Fix ...").
- Documentation is in English. Change the README, the [software guidebook](./docs/software-guidebook.md) or an ADR in the same commit as the behaviour it describes.
- Prefer user stories with Given/When/Then acceptance criteria for functional requirements.

## 3. History

Bart started this project on Monday 15 June 2026 — his brother's birthday. After a morning of work, the first commit (*"Initial commit: README, spec, ADRs, and project config"*) landed at 12:09, and the analysis, design and first code followed that same afternoon and evening, done by Kiro, the agentic editor from AWS.

The next day he travelled to Bussum for Sogeti's *"Now What?"* congress and kept building on the train — the commit log shows the GPX parser, waypoint classifier and segment builder arriving between 07:44 and 09:34 that morning. That evening he swam and ran *Het Rondje Eilanden* with a friend: the same course that now lives in the repo as the [rondje-eilanden.gpx](./public/samples/rondje-eilanden.gpx) sample.

The founding sprint ran on for two more days: wave 5 (GPS filter, API router, property tests) landed on 17 June and wave 6 (landscape client, backend validation) on 18 June. Then the project hibernated for four and a half months — not a single commit, issue or file touched.

It woke up on Halloween, Friday 31 October 2026: 28 commits in one day brought the TigerLegs name and branding, the upload page, the software guidebook and this very history section.

![Screenshot of the first TigerLegs prototype: a GPX file analysed into a map plus a table of swim and run segments](./assets/tigerlegs-first-prototype.png)

*Figure 1*: Screenshot of the first prototype of TigerLegs (which started as a project called `gpx-to-swimrun-segments`), taken on 31 October 2026 when the project was picked up again.

## 4. Developing locally with an AI agent (work in progress)

This section is for anyone who wants to try a coding agent on their own Mac, with a local model, without giving it the keys to the whole computer. The reasoning and the alternatives (nono, microsandbox, a separate macOS user) are in [ADR-0020](./docs/adr/0020-sandbox-for-local-ai-coding-agents.md). **Status: draft.** The profile has been tuned up to the start of the app pi-kit, but pi-kit has not yet run under it, so expect to add a rule or two.

### 4.1 Why a sandbox

A coding agent reads files and runs commands, and it holds API keys when it uses a cloud model. A static review of pi-kit (ADR-0020, section 2) found no malicious pattern, but a review is not a guarantee and the project is young, so we confine it instead of trusting it. The profile [scripts/sandbox/pi-kit-allow.sb](./scripts/sandbox/pi-kit-allow.sb) is part of this repository, and the start command in section 4.3 does not work without it. It denies everything and lists what is allowed.

| Allowed                                            | Not allowed                                      |
| -------------------------------------------------- | ------------------------------------------------ |
| Read and write in this repository                  | The rest of your home folder, including `~/.ssh` |
| Read system files and run `git` and `node`         | The clipboard, keyboard and mouse control        |
| The app's own data folders                         | Any internet connection                          |
| Network traffic to `localhost`, for example Ollama | Writing anywhere outside the repository          |

### 4.2 Set up

1. Install Ollama from [ollama.com](https://ollama.com) and pull a model of 7 to 14 billion parameters. On a Mac with 16 GB of memory that is the practical limit, and such a model is weaker than a cloud model at work on several files.
2. Install pi-kit from its GitHub release page (macOS Apple silicon) and check the signature before you open it: `spctl -a -vv /Applications/pi-kit.app` should say `accepted`, `source=Notarized Developer ID` and, at the time of writing, `origin=Developer ID Application: CodeRabbit GmbH (RNK7YZ53MM)`. That is not the name in the repository (Soverius.AI GmbH); see ADR-0020, section 2, for what we found. If the name or the Team ID is different, stop and ask. Also compare the SHA-256 of the download (`shasum -a 256 <file>.dmg`) with the digest that GitHub shows next to the asset on the release page; that only proves that the file is the one that was published, not that the publisher is trustworthy.
3. Create the app's own folders once, because the profile does not let the app create them:

   ```sh
   mkdir -p ~/Library/Logs/pi-kit ~/Library/Caches/pi-kit "$HOME/Library/Application Support/pi-kit"
   ```

### 4.3 Start pi-kit in the sandbox

Run this from the root of the repository:

```sh
sandbox-exec -D HOME="$HOME" -D PROJECT="$PWD" \
  -D TMP="/private$(getconf DARWIN_USER_TEMP_DIR)" -D CACHE="/private$(getconf DARWIN_USER_CACHE_DIR)" \
  -f scripts/sandbox/pi-kit-allow.sb /Applications/pi-kit.app/Contents/MacOS/pi-kit \
  --no-sandbox --user-data-dir="$HOME/Library/Application Support/pi-kit"
```

If you start it from a terminal inside an Electron-based editor such as VS Code and you see `bad option: --no-sandbox`, that terminal has `ELECTRON_RUN_AS_NODE` set, which makes pi-kit run as plain Node. Run `unset ELECTRON_RUN_AS_NODE` first (or put `env -u ELECTRON_RUN_AS_NODE` in front of `sandbox-exec`).

`--no-sandbox` switches off Chromium's own sandbox. That is a limit of macOS and not a wish: a process that is already in a sandbox cannot apply a second one, and the helper processes of the app then crash. The windows get the rights of the profile instead of fewer rights than the main process; see ADR-0020, section 4.

### 4.4 See what it tries to do

In a second terminal, follow the refusals live:

```sh
/usr/bin/log stream --predicate 'eventMessage CONTAINS "deny"'
```

Use the full path `/usr/bin/log`, because `log` is a built-in command in zsh. Each line names the program, what it wanted (a file, a network address, a system service) and the target. If the app stops with an error, add one rule for the refusal that explains it, run again, and repeat. A web search is not possible in this profile; start a second profile on purpose if you want one.

### 4.5 Limits

- `sandbox-exec` is deprecated by Apple. It works on macOS 15 but may disappear.
- A sandbox limits the damage and does not make an app trustworthy. Use no real API key while you test.
- The profile allows all `localhost` ports. Narrow it to the ports that the log shows.
- Electron left the files `SingletonCookie`, `SingletonLock` and `SingletonSocket` in the repository root during the first runs. They are not ours: delete them and do not commit them.
