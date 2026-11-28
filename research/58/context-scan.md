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

The table records the expanded run before the two retrieval refinements below. Each lead is one passage × practice record; several cues for that practice share one record. The status columns count lead records whose parent spec has that whole-document status. One document can contribute multiple records to the same column. Uncaught samples are a separate queue, with at most one sample per scanned spec. A cross-repository fragment group counts one normalized hash observed in multiple repositories.

| Practice | Lead records | Records in `missing` specs | Records in `unknown` specs | Decision |
| --- | ---: | ---: | ---: | --- |
| P2.2 | 690 | 0 | 0 | No standalone Boundary or Spanish plural lead in the allowed inventory. The scanner does not establish whether paraphrased cases in otherwise partial documents are missed. |
| P1.4 | 161 | 86 | 0 | A sync timeout with retry behavior in Spec Kitty is a strong lead. Other repositories yielded ambiguous triggers or rejection behavior in different contexts. Same-failure recurrence pending. |
| E3.1 | 1,194 | 544 | 0 | Identical template headings are grouped. An intervening subheading is a lead for review of the body. No independent recurrence credited here. |
| E3.2 | 11 | 4 | 0 | Leads include a test runner requirement and methods written into success criteria. A narrower shared defect remains pending. |
| E3.3 | 1,926 | 500 | 0 | Admit documented exceptional scenarios missed across two independent repositories and lineages. See the separate draft. |
| E3.4 | 32 | 0 | 0 | Whole-document status cannot resolve suspected local misses. Recurrence pending. |
| I1.2 | 2,153 | 0 | 9 | Spanish-form IDs remain informational under H2c. The observed unknowns came from Portuguese material. Multiple IDs per passage need proof of a concrete coverage defect. |
| C2.3 | N/A | N/A | N/A | The authorized spec-only inventory contains no task companion. |

The download enumerated all 17 pinned trees without truncation. It fetched and scanned all 974 matching specs from 16 repositories. The remaining tree contained no path matching the manifest's filter. The root license text matched the manifest for all 17 repositories. The first expanded run yielded 6,167 lead records and 974 uncaught samples, with three exact fragment groups crossing repository boundaries. One repository accounts for 851 of 974 documents, so the counts describe search workload. Compare the runs by unit:

| Run | Scanned specs | Repositories with scanned specs | Lead records | Uncaught samples |
| --- | ---: | ---: | ---: | ---: |
| Initial capped inventory (historical) | 223 | 16 of 17 | 691 | 223 |
| First expanded inventory (historical) | 974 | 16 of 17 | 6,167 | 974 |
| Expanded inventory after both cue refinements | 974 | 16 of 17 | 6,170 | 974 |

The lead columns differ in retrieval rules and coverage. In the final run P2.2 has 691 lead records and E3.3 has 1,928, of which 502 are from `missing` specs. The R52 DEV input and engine scope are described above. The [E3.3 content lineage trace](e33-issue-draft.md#content-lineage) counts the two lineages from pinned repository history, separately from these scanner counts.

Development review inspected candidate groups and one uncaught sample per repository with documents, selecting the lowest fragment hash from that repository's uncaught queue. For example, the md2confl sample describes what the tool does with an empty page even though it missed the current P2.2 condition-and-response cues. This is a scanner blind spot. It is not an adjudication of the engine for that passage. The uncaught review was a spot-check, not full adjudication. Keep the remaining hypotheses open where the evidence is insufficient.

## Follow-up on the uncaught sample

The scanner now looks for an explicit empty-input condition and an outcome in the same passage. It recognizes bounded EN/ES wording and ignores inline command names and flags for this cue. In a paired run on the same 974 specs, the new cue added one P2.2 lead, the md2confl case at line 111. An initial version also flagged a command and option in a Spec Kitty table row. That candidate was rejected on inspection and led to the inline-code exclusion, which has a synthetic regression check.

The md2confl document remains `partial` and the engine already points to the recovered line. The measured improvement is to search coverage. It does not add an admissible engine defect or estimate search precision beyond this development corpus. The table above records the scan before this cue was added.

## Adjacent steps under a scenario heading

A second review of the uncaught queue surfaced two missing-setting scenarios. The scanner now pairs adjacent WHEN/THEN or CUANDO/ENTONCES list items under a scenario heading when the condition names an absent setting and the outcome specifies a default or an observable error. The pair preserves both source lines. Blank lines, intervening steps, fences and headings break the pair.

The paired run on the same 974 specs added two E3.3 leads and kept the original lead set. Both new passages were checked against their source context. Both whole-document assessments returned `missing` with zero E3.3 evidence. The examples come from different features in the two repositories already counted for intake. They corroborate the existing E3.3 draft and do not add repositories. They informed the retrieval rule, so this comparison measures recovery of development examples rather than an independent precision estimate. The scan emitted 6,170 leads and 974 uncaught samples, with byte-identical output and coverage in two runs.
