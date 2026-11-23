# Contextual scan of the authorized DEV cache

## Initial run (historical)

```sh
node --import tsx scripts/spike-58/scan-context.ts /private/tmp/spec58-natural \
  > /tmp/spec58-leads.jsonl 2> /tmp/spec58-coverage.json
```

The input index must match repository names, revisions and manifest licenses from the authorized #52 DEV allowlist. The output keeps the source path, original line and its two neighbors on each side, Markdown heading chain, row kind, byte SHA-256 and a fragment hash. Fragment hashes use NFC, lowercase and collapsed whitespace. They identify identical normalized text and can flag reusable template text. Source history and context still determine lineage. The script emits a separate coverage ledger, including skipped documents, missing sources and truncated inventories.

The original four-pattern scan remains available as a reference. This pass borrows contextual matching from [Presidio](https://github.com/data-privacy-stack/presidio/blob/main/docs/tutorial/06_context.md), token normalization from [SQLite FTS5](https://sqlite.org/fts5.html#unicode61_tokenizer) and exact fingerprinting from [NeMo Curator](https://docs.nvidia.com/nemo/curator/latest/curate-text/process-data/deduplication). Here, cues compose within a source line or with its Markdown section heading. For example, a table row with a response can be recovered under an exceptional-behavior heading. The search uses accent folding on a separate representation and retains the original line as evidence. It excludes fenced text and selects one uncaught non-heading line per document using stable hashes of repository, revision, path and line. The sample is a review queue for possible misses.

Each document is analyzed once through the existing engine, using its classified role and feature. Its status and up to four returned evidence lines belong to the **whole document**. Only findings anchored to the candidate line are attached. The presence of a heading in the review queue does not imply that the engine assessed that heading positively. C2.3 requires a tasks companion and remains outside this spec-only pass. H2c references are informational.

The cached run on engine 0.1.4 and rubric epic-heuristic-1 scanned 223 specs from 16 of the 17 authorized repositories, with one repository having no matching spec and one capped at 100. It produced 691 lead records across seven practices, 223 uncaught samples and three cross-repository groups with identical normalized fragments. Records may repeat a fragment under different practice cues. For example, E3.1 found the same success-criteria heading followed by a nested outcomes heading in ambient-code/platform and fmnapoli/md2confl. The engine returned `missing` at document level in both cases. These are leads from shared template structure and require review of the actual criteria and lineage. Recurrence remains pending. No estimate of search coverage or language parity follows from the raw lead counts.

## Expanded scan

Run the retrieval into a fresh directory, then pass that directory to the scanner.

```sh
cache="$(mktemp -d /tmp/spec58-dev.XXXXXX)"
python3 scripts/spike-58/fetch-dev.py "$cache"
node --import tsx scripts/spike-58/scan-context.ts "$cache" \
  > /tmp/spec58-leads.jsonl 2> /tmp/spec58-coverage.json
node --import tsx --test scripts/spike-58/context-rules.test.ts
```

The expanded scanner groups wrapped prose and indented list continuations. A heading, list item, table row, blank line or code fence bounds a passage. A row can inherit the table header and its Markdown headings. A lead includes all matching cues for its practice in one record. Document evidence and passage evidence are separate fields. The coverage ledger lists duplicate normalized fragments across repositories with every location. The scanner checks repository, revision, manifest license, allowed document paths and cache paths before opening content. Root license text is checked at the pinned revision. Reviewers should still account for any document-level license exceptions before redistributing material.

| Practice | Leads | Whole-document missing | Unknown | Decision |
| --- | ---: | ---: | ---: | --- |
| P2.2 | 690 | 0 | 0 | No standalone Boundary or Spanish plural lead in the allowed inventory. The scanner does not establish whether paraphrased cases in otherwise partial documents are missed. |
| P1.4 | 161 | 86 | 0 | A sync timeout with retry behavior in Spec Kitty is a strong lead. Other repositories yielded ambiguous triggers or rejection behavior in different contexts. Same-failure recurrence pending. |
| E3.1 | 1,194 | 544 | 0 | Identical template headings are grouped. An intervening subheading is a lead for review of the body. No independent recurrence credited here. |
| E3.2 | 11 | 4 | 0 | Leads include a test runner requirement and methods written into success criteria. A narrower shared defect remains pending. |
| E3.3 | 1,926 | 500 | 0 | Admit documented exceptional scenarios missed across two independent repositories and lineages. See the separate draft. |
| E3.4 | 32 | 0 | 0 | Whole-document status cannot resolve suspected local misses. Recurrence pending. |
| I1.2 | 2,153 | 0 | 9 | Spanish-form IDs remain informational under H2c. The observed unknowns came from Portuguese material. Multiple IDs per passage need proof of a concrete coverage defect. |
| C2.3 | N/A | N/A | N/A | The authorized spec-only inventory contains no task companion. |

The download enumerated all 17 pinned trees without truncation. It fetched and scanned all 974 matching specs from 16 repositories. The remaining tree contained no path matching the manifest's filter. The root license text matched the manifest for all 17 repositories. The scan yielded 6,167 lead records and 974 uncaught samples, with three exact fragment groups crossing repository boundaries. One repository accounts for 851 of 974 documents, so the counts are search workload rather than prevalence. Record counts also depend on the search cues and the per-document evidence limit. The first section of this document records an earlier, smaller execution.

Development review inspected candidate groups and one uncaught sample per repository with documents, selecting the lowest fragment hash from that repository's uncaught queue. For example, the md2confl sample describes what the tool does with an empty page even though it missed the current P2.2 condition-and-response cues. This is a scanner blind spot. It is not an adjudication of the engine for that passage. The uncaught review was a spot-check, not full adjudication. Keep the remaining hypotheses open where the evidence is insufficient.
