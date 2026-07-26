# Changelog

Notable changes per release. Versions with nothing user-visible are folded into
the release that followed.

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
