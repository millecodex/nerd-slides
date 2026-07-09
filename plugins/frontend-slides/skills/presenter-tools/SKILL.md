---
name: presenter-tools
description: >-
  Add live presenter/authoring tools to a self-contained HTML slide deck: a
  laser pointer, inline text editing with a rich-text formatting bar
  (bold/italic/underline, size, alignment, colour, highlight), drag-to-move and
  drag-to-resize of any box, a 16:9 aspect-ratio lock (with fill-window toggle),
  a reset button, and Save-to-file that bakes edits in. Use when a user asks to
  make an HTML/reveal-style presentation editable, add a laser pointer, let them
  move/resize slide elements, highlight text while presenting, lock the deck to
  16:9, or "add the presenter tools / editing overlay" to a deck.
---

# Presenter Tools

Drop-in interaction layer for **self-contained HTML slide decks** (one HTML file,
slides marked with a class like `.slide`). It adds authoring + presenting
affordances without a build step or dependencies. Everything is vanilla JS/CSS.

## What it provides

A hover toolbar (top-left) plus keyboard shortcuts:

| Tool | Key | What it does |
|------|-----|--------------|
| **Laser** | `L` | Cursor becomes a glowing red dot for pointing. |
| **Text** | `E` | Every text box becomes click-to-edit. A floating **rich-text bar** appears above the focused box: **B / I / U**, font **A− / A+**, align left/center/right, three **font-family** buttons (serif / sans / mono — pulled from the deck's own fonts), text-colour swatches, and **five highlight colours** (rose, amber, mint, sky, lilac) plus a clear button. |
| **Move** | `G` | Click a box to select it (red frame + 8 handles). Drag the body to reposition; drag a handle to resize (edge handles keep the opposite edge anchored). Hover shows the exact box you'll grab. A red **✕** on the frame (or **Delete / Backspace**) removes the selected box. |
| **16:9** | `R` | Toggles the stage between a locked 16:9 slide (letterboxed) and fill-window. **Always starts at 16:9** on load; Fill is an in-session toggle. Requires `stage-16x9.css` (see below). |
| **Reset** | — | Clears all moves / resizes / deletions and reloads original positions (keeps text edits). |
| **Save** | `⌘/Ctrl+S` | Saves the deck with all edits/format/highlights/positions baked in and every tool's UI stripped out. Prefers **save-in-place** (File System Access API): the first save asks you to pick the file (choose the deck to overwrite it), later saves overwrite it in one click. Falls back to a **download** where the browser blocks that (e.g. some `file://` setups). |

Move and Text are mutually exclusive so a click never does both. Text edits,
positions, sizes, deletions and highlights persist in `localStorage` (namespaced
per file path) and survive reloads.

> **Two-source caveat.** Live tool changes live in the browser (DOM + localStorage);
> if you *also* hand-edit the file, keep one as the source of truth at a time.
> Bumping the `NS` value (or clearing the relevant `localStorage` keys) resets any
> stale live changes so the file renders exactly as authored.

## How to apply it to a deck

1. **Include the CSS** — paste `assets/presenter-tools.css` into a `<style>` in
   `<head>`, or `<link rel="stylesheet" href="assets/presenter-tools.css">`.
2. **Include the JS** — paste `assets/presenter-tools.js` inside a `<script>`
   just before `</body>`, or `<script src="assets/presenter-tools.js"></script>`.
   It self-initialises; no call needed.
3. **Guard your deck's own keyboard nav** so typing doesn't flip slides. In your
   navigation `keydown` handler add this as the first line:
   ```js
   if (e.target && e.target.isContentEditable) return;
   ```
4. **(Optional) Configure** before the script runs:
   ```html
   <script>
     window.PRESENTER_TOOLS_CONFIG = {
       slide: '.slide',                 // your slide element selector
       editable: 'h1,h2,h3,p,li,.caption,.title',  // which elements are editable/movable
       saveName: 'my-deck.html'         // download filename for Save
     };
   </script>
   ```
   Defaults target common text tags (`h1..h5,p,li,blockquote,figcaption`) plus a
   set of common classes, scoped to `.slide`. Images and inline SVG inside slides
   are movable/resizable too.

## Theming

Colours read your deck's CSS variables with fallbacks:

- `--paper` — surface/background (default cream `#F0EBDE`)
- `--ink` — foreground/accent (default cobalt `#1F2BE0`)

Set those two vars in your `:root` and the toolbars match your deck. To change
the highlight colour, edit `#rt-bar .hl-sw` (and the `data-hl` value it applies)
in the CSS. Selection-frame/laser accents are red (`#E5392A`) by design for
visibility; change in the CSS if desired.

## The 16:9 lock (optional)

Locking to 16:9 only works if content scales to the *stage* rather than the
window. Use `assets/stage-16x9.css`, which:

- wraps the deck as `.deck > .stage` and makes `.stage` a `container-type: size`
  box sized to the largest 16:9 rectangle that fits (letterboxed);
- expects slide sizing authored in **container units** (`cqw`/`cqh`) so
  proportions hold in both modes.

Converting an existing `vw`/`vh` deck: replace numeric `NNvw`→`NNcqw` and
`NNvh`→`NNcqh` throughout, but keep the four `.stage` sizing values (in
`stage-16x9.css`) as `vw`/`vh` since they must reference the real viewport. The
"16:9 / Fill" button toggles `body.fill-mode`. If you skip this file, the button
is harmless (it just toggles a class nothing listens to).

## Notes & limits

- Designed for decks that switch slides via an `.active`/visibility class (not
  by scrolling). Fixed-position tool UI floats above the slides.
- `execCommand` powers B/I/U/colour/highlight — deprecated but universally
  functional in `contenteditable`; fine for local decks.
- Persistence is keyed to the file's path, so two decks won't clash.
- Save reserialises the live DOM; edits (innerHTML) and positions/sizes (inline
  `translate`/`width`/`height`) are already in the DOM, so the saved copy is
  faithful and self-contained.

## Files

- `assets/presenter-tools.css` — all tool styles
- `assets/presenter-tools.js` — the full interaction module (self-initialising)
- `assets/stage-16x9.css` — optional 16:9 stage recipe
