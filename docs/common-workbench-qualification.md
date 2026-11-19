# Common workbench qualification

This runbook covers the standalone browser workbench in [#3](https://github.com/jayanez/spec-torque/issues/3). The audience is a reviewer evaluating an installed candidate on a Mac. See [compatibility](compatibility.md) for host-specific evidence.

## Install and run

Build from the candidate commit on Node 22.20.0 or the supported Node 22 qualification runtime. Use separate, empty install and workspace directories. The fixture tests create disposable workspaces for writes.

```sh
npm ci --ignore-scripts
npm run check
npm run package:integrations
qualification_dir="$(mktemp -d)"
mkdir "$qualification_dir/package" "$qualification_dir/install"
npm pack --ignore-scripts --pack-destination "$qualification_dir/package"
shasum -a 256 "$qualification_dir/package/"*.tgz
npm install --no-audit --ignore-scripts --prefix "$qualification_dir/install" "$qualification_dir/package/"*.tgz
export SPECTORQUE_INSTALLED_CLI="$qualification_dir/install/node_modules/.bin/spectorque"
```

Use `npm run browsers:install` if the lockfile's matching browser binaries are missing. With an existing compatible cache, set `PLAYWRIGHT_BROWSERS_PATH` to its absolute path. From the checkout, run `npm run test:browser` with the installed CLI environment variable set. Each test starts the installed CLI with the disposable workspace as its current directory and stops it at teardown. The default CI suite exercises the source build when the variable is absent. For already installed Google Chrome, run the Chromium projects with `SPECTORQUE_TEST_CHROME=1`.

For a browser walkthrough, copy `fixtures/en-draft` and `fixtures/es-draft` to separate temporary directories. From outside the checkout, start the installed CLI with `serve --root <temporary-workspace> --port 0`. Open the printed loopback URL. Keep the reports and artifact exports before stopping the CLI. Confirm the listener stopped, then uninstall from the isolated prefix with `npm uninstall --prefix "$qualification_dir/install" spectorque`.

## Walkthrough and evidence

1. In EN and ES, create spec, plan and tasks with an unanswered decision. Switch views before generating the draft and verify the inputs and step survive. Import Markdown by file and pasted text, then load a disposable local workspace. When asked to discard pending work, exercise both cancel and explicit discard. In a two-feature workspace, compare All artifacts and a selected feature, including exact source paths, unknown dimensions, and the displayed and exported revisions.
2. Use only the keyboard to reach the source, assessment, practices, findings and pending decisions. Activate a finding and verify the selected line. Open a proposal and distinguish the original and proposed wording. Reject once, verify the source bytes and return focus, then explicitly approve a second proposal. For disk persistence, enable the per-proposal checkbox and compare the intended file and sibling bytes. Verify the refreshed report, decision line, revision and rubric. Export JSON, Markdown, badge and the selected ZIP. Undo, then compare the restored text and revision.
3. Exercise an empty workspace, unavailable connection, conflicting new-file save, stale source and stale undo, then retry against fresh source. Confirm an error leaves unsaved text accessible. The browser may show a native warning on reload or close after interaction. Use Save as new files or the artifacts export for a durable copy. Session history and unsaved drafts are held in memory.
4. Repeat at 375, 768 and 1280 CSS pixels in the nominated browsers. For VoiceOver in Safari, traverse by headings, landmarks and form controls. Record the focus location and actual announcement for the editor, review, rejection, acceptance, undo and errors. Verify original and proposed labels and whether the pending decision announces its path, line and actual wording. Repeat the evidence, review and recovery at 375 px. Record the exact OS and Safari build, VoiceOver settings, page width, fixture, result and skipped tasks. The keyboard and axe tests supply separate evidence.

## Observed on macOS arm64

macOS 27.2.1 (26B131), Node 22.20.0, Playwright 1.65.1. The candidate was installed in an empty npm prefix using the local cache. The deterministic browser tests reject unexpected application requests outside loopback.

| Exercise | Result |
| --- | --- |
| Installed workbench, Chromium 159.0.8154.6 and Playwright WebKit 27.2 | EN/ES at 375, 768 and 1280 px. 60 cases passed, including review focus, draft and conflict preservation, exact exports, axe and narrow layout. |
| Installed workbench, Google Chrome 157.0.8103.80 | The Chrome channel passed 30 cases at the same widths using Playwright. |
| Playwright Firefox 159.0 | The prior macOS profile startup failure recurred before any application page loaded. No local Firefox pass. The Linux CI matrix continues to exercise Firefox. |
| Installed workbench in Safari 27.2 (22625.2.8.11.9) | At the default desktop viewport, EN local workspace load and ES pasted-text import reached the exact finding. In both languages, Option-Tab and Space reached rejection and approval, focus returned to the review control on rejection and the source heading on approval, a pending decision was visible, and undo restored the original text. Safari downloaded EN/ES JSON and ES ZIP. The ES close action showed the native unsaved-work prompt. Exact-width Safari and VoiceOver announcements remain pending. |

Installed Chromium/WebKit/Chrome candidate source: `7a55eb65c8c5c88295798c0206ad2df0c2f4a4eb`, tarball SHA-256 `3375ee6482b5545248dc4756793ccd6e363fafb7cbcf9ab9cd597ff9eb3368e0`. The Safari walkthrough used `65f9bc364d44c1127c87fda5504c9d8d80d0bfc1`, tarball SHA-256 `d7d0c2e5a8711b0bfab3f57e43cbf8cbe112b38be4c7461405e7c401992fccc3`. The Safari fixture in each language was a single `spec.md` with a heading, a blank line and an intentionally unbounded FR-001. The output used engine 0.1.1 and rubric `epic-heuristic-1`.

| Safari export | Assessment revision | Download SHA-256 |
| --- | --- | --- |
| EN JSON | `19d058f79e8434357bf342554867f4c68884d8f250ebef01746f0f43e850d087` | `9ee2dc507e2fcd2ddf069c997e3a75551b6b28352652512ad1558f19e02c5bb6` |
| ES JSON | `5b5ad7f5f3099418fac51537f1b554a721be316ffe418a7a3c2b3cd5c41f9180` | `9b423a5e6fd0bf22a08ea712971444cbf77a7171c4aa45b4d357de648a423429` |
| ES ZIP | Same selected source | `123f31245985799f0d1c7853bc312346c29f68ce516c7c802dddbfd7e98bb178` |
