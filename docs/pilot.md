# SpecTorque pilot walkthrough

Use the release candidate's matching tarball, checksum file and demonstration bundle. The walkthrough is for specification authors and reviewers. It uses the deterministic local workbench with a synthetic room-booking example. The optional native routes are listed in the [installation guide](releases.md) and depend on the candidate's qualification record.

## Install and open

1. Verify the tarball with `shasum -a 256 -c SHA256SUMS` from the asset directory, or compare the expected value with `Get-FileHash -Algorithm SHA256 <archive>` in PowerShell. Use Node 22.20+ and npm. The initial npm install may fetch public dependencies. A pre-populated npm cache allows `--offline` installation where verified.
2. Extract the demonstration bundle. Copy `en/before` to a disposable directory outside the install prefix. Keep the original intact. Run the following in a shell after setting absolute paths. On PowerShell use the equivalent `$env:` assignments or pass paths directly. Start the server in one terminal and run report commands in a second terminal with the same paths.

```sh
npm install --no-audit --ignore-scripts --prefix "$INSTALL" "$TGZ"
cli="$INSTALL/node_modules/spectorque/dist/cli.js"
node "$cli" serve --root "$WORKSPACE" --port 0
```

Open the printed loopback URL. The rest of the walkthrough needs only local files, the local browser and the installed package. Copy or download reports before closing. Stop the server with Ctrl+C and confirm the URL stops responding. To remove the installation, run `npm uninstall --prefix "$INSTALL" spectorque` and discard only the scratch directories you created.

## Analyze, review and export

1. Choose **Load local workspace**, then select `specs/booking` if **Artifact set** appears. The first analysis is complete when its findings are visible and can be opened. Download JSON and Markdown as your baseline. Open the **Unbounded wording** finding at `specs/booking/spec.md:5`.
2. In **Proposed wording**, enter the following line and select **Review difference**. Read the displayed original and replacement, then select **Reject**. The source is unchanged.

   ```markdown
   FR-001: The system MUST be [NEEDS CLARIFICATION: define the response-time limit and measurement conditions].
   ```

3. Preview again. Select **Write this change to the local workspace** and click **Accept change**. Verify that line 5 is the only changed line. FR-002, FR-003 and the payment-data exclusion retain their original wording.
4. Open **Decisions** and verify the unanswered question on line 5. Open **40 practices** and check an `unknown` such as I2.3, which needs companion documents. Download **JSON**, **Report** and **Artifacts**. The analysis now has a new revision. The ZIP contains `specs/booking/spec.md`, with the same bytes as the approved file. Compare with the versioned demonstration by revision, practice states and file bytes. The JSON time of creation will vary.
5. Use a second disposable copy for recovery. Prepare the same proposed change, select disk writing and append a line to the actual source file externally before clicking **Accept change**. Verify the stale-source error and that the external line survives. Reload the workspace, dismiss the old proposal, select the finding again and create a fresh proposal. Verify that the new approved edit preserves the external line.

You can compare the displayed assessment against the installed CLI from the second terminal with these commands. Use a new output path for each Markdown report.

```sh
node "$cli" analyze "$WORKSPACE" --feature specs/booking --json
node "$cli" report "$WORKSPACE" --feature specs/booking --output "$REPORT"
```

Send feedback only if you choose to. Start from the [manual feedback form](pilot-feedback.md). The maintainers will confirm the receiving channel for the pilot. A report can contain extracts from the source document. Prefer the public fixture or a short synthetic reproduction reviewed before sharing.

## Rebuild the demonstration

Use the [release build procedure](releases.md) and an exact, clean checkout. Prepare the locked dev dependencies and Chromium on Node 22.20.0. Run the local replay against the built tarball and a new absolute output directory.

```sh
npm run browsers:install -- chromium
npm run pilot:demo -- "$TGZ" "$DEMO_OUT"
```

The runner installs into a disposable prefix, records the EN/ES browser interaction with timed WebVTT captions, compares exports with the installed CLI, and writes a manifest. Player support for WebVTT varies. Load the matching `captions.vtt` alongside each `walkthrough.webm`, or follow this written script. Video is illustrative. The archive checks, sources and JSON revisions provide replay evidence. The labels and sequence can also be exercised by keyboard in the browser. See the [workbench qualification](common-workbench-qualification.md) for browser and accessibility limits.

For operator responsibilities, participant intake and release gates, see [pilot operations](pilot-operations.md).
