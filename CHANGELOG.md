# Changelog

Notable changes per release. Versions with nothing user-visible are folded into
the release that followed.

## 0.22.0 — 2026-08-11

Portico stops assuming it is running on the machine it was written on, starts
encrypting what it keeps, and says plainly what leaves your computer.

### Added

- **Everything on disk is encrypted.** Conversations, projects, assistants and
  API keys are sealed with the operating system's keyring — DPAPI on Windows, the
  Keychain on macOS, libsecret or kwallet on Linux. No passphrase to remember and
  none to lose. It protects a stolen disk, a backup, a synced folder or another
  account on the same machine; it does not protect against someone already logged
  in as you, and Settings says so. Existing chats are read as they are and sealed
  the next time they are saved, so there is no migration step.
- **Settings → Privacy lists every request the app can make**, and what triggers
  each one. Chatting locally makes none.
- **The update check can be switched off.** It was the only request Portico made
  on its own, and an app whose claim is that nothing leaves your computer should
  not make it without a way to stop it.
- **Defaults now follow your machine.** Context size, GPU layers, thread count,
  image quality and concurrent slots are worked out from the memory, cores and
  graphics card actually present — from a 4 GB netbook to a 128 GB server, and
  Apple's unified memory counted once rather than twice. Settings shows what was
  detected and lets you set the budget by hand when detection is wrong.
- **The catalogue says whether each model fits**, computed against that budget
  rather than described in prose.
- **A thinking toggle** for models that reason out loud, and what that reasoning
  costs: each block reads "Thought for N tokens", and the token panel totals it
  for the conversation. On Qwen3 and QwQ the toggle genuinely turns it off; on
  DeepSeek R1 it says there is no switch instead of pretending.
- **Longest reply goes to 32,768 tokens.** Options beyond half the context window
  are shown disabled with the reason, rather than accepted and silently clamped.

### Changed

- **Electron 33 → 43.** Chromium 130 → 150, Node 20 → 24, and 33 security
  advisories closed, including a context-isolation bypass and an ASAR integrity
  bypass. The installer grows to 143 MB; that is the newer Chromium.
- Sharing your engine now says what you are taking on: the model runs on your
  computer, so anyone who can read that machine could read your colleagues'
  conversations.
- Settings is grouped into cards instead of one long column.
- The opening screen is just the message box, centred. The logo and greeting
  return when the sidebar is open.

### Fixed

- **Web search could be pointed inward.** The pages behind results were fetched
  with no check on the address, so a result aimed at 127.0.0.1 could pull the
  engine's own responses into the model's context, and one aimed at 192.168.1.1
  could read a router's admin page. Local, private and link-local addresses are
  now refused, on redirects and at DNS lookup too.
- **Opening an artifact externally accepted any path**, and handed it to whatever
  the system had registered for it — a .bat would have run. It now opens .html
  only, from the artifacts folder only.
- A test-only branch that wrote to any path was shipping in release builds.
- Deleting a model compared paths as text, so a folder named alongside the models
  folder was accepted.
- The download checksum on the website is now computed from the installer's bytes
  at build time. It had drifted, and a stale checksum reads as a tampered file.
- The sidebar had lost its slide entirely: a later rule redefined `transition`,
  which is a shorthand. The composer now glides with it instead of dropping.

## 0.21.0 — 2026-08-04

Control over what the model costs you, a run-it-elsewhere option, and several
things that were quietly broken.

### Added

- **A status strip** under the message box: which model, how hard it is working,
  and how full the conversation memory is. Click the ring for a breakdown of where
  the context window is going, with the two dials that control it.
- **Effort — Quick, Balanced, Deep.** This changes the request rather than
  labelling it: Quick asks for brevity and halves the reply cap, Deep asks for
  step-by-step reasoning and doubles it. The history budget is recomputed from the
  same number, so a longer reply cannot silently crowd out the conversation.
- **Settings → Test graphics cards.** Times a real reply on each card in the
  machine and keeps the fastest, rather than assuming the discrete one wins.
- **Run the model at a hosted provider** — RedPill (GPUs in confidential mode),
  OpenRouter, or any other OpenAI-compatible service. Payment stays with the
  provider; Portico never handles a wallet, a card or a private key.
- **A Mixture of Experts tier** in the catalogue, from 1.9 GB to 17.3 GB. These
  run a fraction of their weights per word, so they answer far faster than their
  size suggests — though all of it still has to fit in memory.
- `npm run release`, which builds the installer and stages it in one step.

### Changed

- Charts made by the Run button now come out styled — no box frame, no tick marks,
  a faint horizontal grid, a muted palette and a readable typeface. matplotlib's
  own defaults are from 2003 and are the main reason generated charts look dated.
- Asking for a web page or an interface now carries design direction, so the model
  stops reaching for Arial and `#333` by default.
- The strip names the model the way a person would — "Qwen2.5 Coder 7B" rather
  than the whole file name. The full name is on hover.
- Sidebar, navigation and the app icon were redrawn.

### Fixed

- **An open artifact could not be closed.** Windows draws its own window buttons
  over the top-right of the frame, exactly where the panel's controls sat. Escape
  now closes it too.
- **Chat settings opened blank.** A closed panel still painted, so the artifact
  panel's empty frame drew over the settings. The white rectangle was an empty
  web page sitting on top.
- **The graphics benchmark picked a card that produced gibberish.** Ranking on
  speed alone chose an integrated GPU that was genuinely faster and returned one
  repeated character. It now checks the reply is coherent before considering how
  quick it was.
- `plt.style.use("seaborn-whitegrid")` killed the whole snippet. matplotlib
  renamed those styles in 3.6; the old names are repaired, and a style that really
  does not exist warns instead of taking the chart down.
- Sharing with several people would have divided the configured conversation
  memory between them instead of giving each the full amount.
- Connecting to a hosted provider was impossible: the API path was discarded, the
  connection test asked for endpoints those services do not have, and the request
  omitted the model name they require.

## 0.20.0 — 2026-07-26

The release that takes Portico off a single Windows machine: it now runs on
macOS and Linux, and one computer can run the model for everyone else.

### Added

- **Shared engine.** One computer with a good graphics card can run the model
  for everyone else on the network. Settings → Shared engine turns on *Share
  this computer's engine* (which hands out an access key and the address to
  connect to) or *Use another computer's engine* on the machines that borrow it.
  Chats, files and projects always stay on each person's own machine — only the
  model runs on the host.
- **macOS and Linux support.** Build targets for `.dmg`/`.zip` (Apple Silicon
  and Intel) and `.AppImage`/`.deb`, plus a CI workflow that builds all three
  platforms without needing to own the machines. See `resources/RESOURCES.md`.
- Host mode picks how many people can chat at once, and warns plainly that
  traffic is unencrypted so it belongs on a network you trust.
- *Test connection* on the client side, which names the model the host is
  running when it succeeds.

### Changed

- **Redesigned chat interface**: neutral off-white light theme, a white
  high-radius composer, composer tools as pills, and a solid dark send button.
- **Redesigned sidebar**: collapse and search on the top row, the search field
  revealed by the magnifier instead of always taking up space, New chat / Chats
  / Projects on one icon column, and sentence-case date headings.
- Chat rows swap the pencil/trash pair for a **…** menu with Rename and Delete.
- **The app icon is now the arch alone**, with no black tile behind it, so it
  sits properly on any desktop background.
- More motion throughout: staggered sidebar entrance, icon presses, composer and
  view transitions, and a cross-fade when switching themes. All of it respects
  the system "reduce motion" setting.
- Chat streaming moved into the main process, so the engine's access key never
  reaches the page and the renderer's content policy stays pinned to loopback.

### Fixed

- Sharing with more than one slot would have silently given each person a
  fraction of the configured context: llama.cpp divides `-c` across slots, so
  the total is now scaled by the slot count.
- *Test connection* reported success when given a **wrong** access key, because
  it probed `/health` — which llama.cpp deliberately leaves unauthenticated. It
  now validates against a protected endpoint.
- The engine refuses to listen beyond this machine unless an access key is set,
  so sharing can't be switched on without one.

### Known limitations

- Voice input and image generation are Windows-only for now: whisper.cpp and
  stable-diffusion.cpp don't publish macOS/Linux binaries, so those must be
  built from source. The app runs fine without them; the features simply show as
  unavailable.
- The macOS and Linux builds have not been run on real hardware yet.
- Auto-update stays inactive until `build.publish.owner` in `package.json` points
  at a real repository and installers are attached to a matching GitHub Release.

## 0.19.1

- Fixed: creating a project did nothing. Electron blocks `window.prompt()`, so
  the New project and Save-as-assistant dialogs threw silently — both now use a
  proper in-app dialog.
- Fixed: chats started inside a project vanished from that project's list,
  because the sidebar entry dropped its project tag when saved.
- Improved: deleting a saved assistant no longer asks you to type a number.

## 0.19.0

- Added: four themes — Dark, Ultra dark, Light and Sepia — with a live preview
  of each in Settings.
- Added: light syntax highlighting that swaps in automatically for light themes.
- Improved: the Windows title bar repaints with the theme, and the app opens in
  your saved theme with no flash of the wrong colour.
- Improved: contrast checked per theme; body text measures 10.7:1 to 17.7:1.

## 0.18.0

- Added: crash logging to a local file, never uploaded.
- Added: Settings → About with update checks, log folder and copy diagnostics.
- Added: README and MIT licence, including third-party attribution.

## 0.17.2

- Added: vision. Models paired with a projector file can read images.
- Added: voice input via whisper.cpp, running on the CPU, entirely offline.

## 0.16.0

- Added: a Run button on Python code blocks, with figures captured back into the
  conversation.

## 0.15.0

- Added: Projects, saved Assistants, and Artifacts.

## 0.14.0 and earlier

Web search across many engines, image generation, file attachments, the model
catalogue and the original chat application. See the website changelog for the
full history.
