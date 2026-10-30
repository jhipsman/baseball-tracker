<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Day / Night theme

Every screen must work in both modes (`data-theme="dark"` on `<html>` remaps the palette in `src/app/globals.css`). Use `bg-surface` for panels (not `bg-white`), `text-on-brand` on brand fills (not `text-white`), `bg-zinc-900 text-zinc-50` for inverted chips, and `.hero` / `neutral-*` only for things that stay dark in both modes. No new hex colors in components. Full design rules: `.claude/agents/design.md`.
