**Verdict: PASS**

## Correction 1 verified

I checked the revised text against `approvedGroups` in `format-pipeline.ts`:

| Code behavior | Interface paragraph | Step 5 |
| --- | --- | --- |
| Candidates are the `PASS`/`FIXABLE` groups | "at least one `PASS`/`FIXABLE` group" | "every `PASS`/`FIXABLE` group" |
| Any `REFUSE` group throws first | — (the step covers it) | "refuse if any group is `REFUSE`" |
| Zero candidates throws | "at least one" | "none is a candidate" |
| A candidate that is not `writable` or not `approved` throws | "verified approval for every such group" | "any candidate lacks verified approval" |
| `SUGGEST` groups are neither candidates nor `REFUSE` | — | "not approval-evaluated and do not themselves block". "Themselves" correctly allows for a refusal when only `SUGGEST` groups exist, because there are then zero candidates. |

- **Order:** step 4 (`assertParses`) runs before step 5 (`checkFile` → `approvedGroups`). This matches `cycle`. Step 7's "entire … approval … cycle" is consistent with the second `cycle` call re-running the approval.
- **Conclusion:** "so it can refuse a valid file" now follows from the stated conditions. A maintainer predicting refusals would get the right answer.
- **Review record:** the description of the correction, including the `SUGGEST` distinction, matches the revised document.

## Non-blocking

- The interface sentence omits the `REFUSE` condition. That is acceptable because step 5 is the full specification.
- **Follow-up:** after this verdict, replace the line "Scoped Opus verification … is pending" in the review record and in `status.md` together. That update is outside this verification and not a blocker.

---

요약: 필수 수정 1건이 반영된 것을 `approvedGroups` 코드와 대조해 확인했습니다. 확인한 조건은 REFUSE 우선 거부, 후보 0개 거부, 모든 후보의 검증된 승인, SUGGEST 비차단입니다. 결과는 **PASS**입니다. 남은 일은 리뷰 기록과 `status.md`의 "pending" 문구를 함께 갱신하는 것뿐입니다.
