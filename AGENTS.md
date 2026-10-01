# Timer maintenance

This repository is the focus timer published at `/timer/`.

## Product

- Categories set a default length and scene. The visitor can change either afterward.
- Pomodoro is 25 minutes of focus, a 5 minute break, and a 15 minute break after four focus blocks. The focus length follows the selected minutes. Break lengths stay 5 and 15.
- The clock is an end timestamp. Do not count down with `setInterval` ticks alone. Background tabs throttle timers, and the timestamp still finishes on time.
- Scenes are canvas drawings. Keep them self-contained and pointer-driven. Do not add video files, photo backgrounds, or third-party asset hosts.
- Sound defaults to a completion chime. Ambient room tone stays off until chosen.
- Preferences and the active session live in `localStorage` under `timer.session.v1`.

## Privacy

This repository deploys publicly. Never write the owner's real name, personal email, home location, or other personal details into committed files or commit messages. Refer to the owner generically. The GitHub identity `Harsh4873` is the only owner reference that belongs in the repo.

## Verification

- Run `npm test`, `npm run typecheck`, and `npm run build` before publishing.
- Do not open the deployed site to verify. The owner checks production.

## Ship every change to harsh.bet

A request to add a feature, fix a bug, or change this app is standing permission to deploy it to the harsh.bet domain in the same session.

1. Implement and verify from source using this repository's tests, typecheck, and build.
2. Commit on `main` as GitHub user `Harsh4873` (`Harsh4873 <43502626+Harsh4873@users.noreply.github.com>`). Verify with `gh api user` and the commit author. Never invent or switch identity.
3. Keep commit messages and code free of AI fingerprints: no `Co-authored-by:` trailers, no `Made-with: Cursor`, and no Cursor / Codex / Claude / Copilot / ChatGPT / Claude Code taglines, comments, or metadata. If the environment injects a trailer, rewrite the commit with git plumbing (`git commit-tree`) before pushing so GitHub never sees an AI co-author.
4. Push to `origin/main`. That push runs `.github/workflows/deploy-pages.yml`.
5. Confirm the workflow with `gh run list` / `gh run view`.

Do not force-push to `main`. Leave unrelated dirty files out of the commit.

The repository name is the route. Do not add a `CNAME` file. Pages must be built with GitHub Actions. `configure-pages` fails until Settings, Pages, Source is GitHub Actions. A workflow token cannot enable that. Enable it once with an admin token: `gh api --method POST repos/Harsh4873/timer/pages -f build_type=workflow`.
