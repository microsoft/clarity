# DOM Performance Improvements

## Goal

Detect Claude and Codex browser markers without adding meaningful work to Clarity's
existing DOM discovery and mutation processing. The primary requirement is product
presence detection. Detecting every marker and preserving every current marker value
is not required if one reliable observed marker can identify the product.

## Current approach

Clarity already visits each discovered or mutated element and serializes its
attributes for replay. Agent detection reuses the serialized `id` rather than running
another DOM query:

```ts
const id = attributes[Constant.Id];
if (id && id.charCodeAt(0) === 99) { agent.detect(id); }
```

All recognized Claude and Codex IDs currently begin with lowercase `c`. The character
check rejects most ordinary IDs before the exact marker switch runs.

Measured bundle impact compared with the branch baseline:

- Raw bundle: +22 bytes
- Deterministic gzip: +8 bytes

In a Chromium microbenchmark over 50,000 serialized attribute maps, the guard saved
about 0.018 ms when 10% of elements had ordinary IDs and about 0.162 ms when every
element had an ordinary ID. These are savings within the detector only, not total
Clarity or page runtime.

## Marker behavior observed so far

A real Claude capture showed the known marker family arriving in one burst of about
2.2 ms:

| Marker | First observed time |
| --- | ---: |
| `claude-agent-animation-styles` | 49167.1 ms |
| `claude-agent-glow-border` | 49167.5 ms |
| `claude-agent-glow-border-inner` | 49167.8 ms |
| `claude-agent-stop-container` | 49168.2 ms |
| `claude-agent-stop-button` | 49168.5 ms |
| `claude-phantom-cursor` | 49168.7 ms |

The extension contract indicates that Claude adds three roots under `document.body`.
The glow inner element and stop button are children of known roots. Codex adds its
overlay root under `document.documentElement` and uses a closed shadow root.

This suggests that the markers are injected as a small related group. It does not yet
prove that root-only detection is safe across extension versions or all lifecycle
states.

## Designs considered

| Design | Possible benefit | Cost or risk | Current conclusion |
| --- | --- | --- | --- |
| Check every serialized ID | Simple and complete | Runs the exact marker switch for every ID | Improved with the lowercase `c` guard |
| Lowercase `c` fast rejection | Avoids most detector calls without extra DOM access | Future marker IDs must continue to start with `c`, or the guard must be updated | Current preferred design |
| Query each known ID with `getElementById` | Looks only for markers | Adds repeated DOM queries and needs lifecycle polling | More work than reusing existing traversal |
| Detect only known root elements | Fewer marker comparisons and possibly fewer telemetry values | Can miss transient children and changes the six-value signal contract | Consider only if child-level signals are no longer required |
| Search descendants after finding a root | Uses known marker topology | Adds subtree queries even though Clarity already traverses the subtree | Not expected to improve runtime |
| Check parents or use `closest()` | Could restrict checks to known containers | Adds DOM relationship work for candidate elements | More expensive than the character guard |
| Add a dedicated `MutationObserver` | Could watch only marker insertion behavior | Duplicates Clarity's existing mutation processing and adds lifecycle complexity | Rejected |
| Special-case BODY and HTML mutation batches | Narrows likely insertion locations | Must handle replacement roots, detached nodes, reparenting, shadow roots, and mutation ordering | Correct handling added too much code and bundle size |
| Detect markers in the backend from playback | Removes classification logic from the client | Playback must contain the marker, and classification arrives later | Separate investigation, not a replacement for the current client task |

## Why root-specific detection has not won

Clarity must still discover and serialize the marker elements for session replay.
Avoiding a marker comparison does not avoid that traversal. Root-specific selectors,
ancestor checks, subtree scans, or another observer would add DOM work beside the
work Clarity already performs.

A previous targeted mutation implementation also had to account for:

- markers inserted and removed in one mutation batch;
- IDs assigned after insertion;
- BODY or HTML replacement;
- detached and reparented nodes;
- open shadow roots and same-origin iframes;
- observer stop and restart behavior;
- mutation records whose nodes survive but whose old attribute values do not.

Handling these cases correctly increased code size and complexity for very small
absolute runtime savings, so the targeted implementation was removed.

## What another Claude capture should measure

The existing local recorder captures first sightings, but it does not record enough
detail to justify a narrower algorithm. A future run should capture:

- parent tag, parent ID, and depth for each marker;
- whether the ID exists before insertion or is assigned afterward;
- each add, remove, and reparent event;
- marker lifetime and whether nodes are reused;
- the `MutationRecord` batch containing each event;
- added subtree size and marker position within that subtree;
- observer callback duration;
- differences between Claude extension and Claude Desktop handoff flows.

This evidence could show that some signals are redundant. It is unlikely to make a
selector-based or root-specific client implementation faster than reusing Clarity's
existing traversal.

## High-fidelity Claude capture, August 25, 2026

A genuine Claude interaction was recorded in Chrome 151 with the page visible and
`navigator.webdriver` false. The capture observed all five Claude markers.

### Insertion behavior

- The animation style was added beneath `document.head`.
- The three known roots were added directly beneath `document.body`.
- Each root arrived in its own `childList` record.
- All three root records were delivered in one MutationObserver callback.
- The first sightings of all five markers were separated by only 0.9 ms.
- Every marker already had its final ID when inserted.
- No marker ID was assigned through a later attribute mutation.
- Each root arrived with its known subtree already attached:
  - glow root: 2 total elements, including the inner border;
  - stop root: 5 total elements, including the stop button;
  - cursor root: 7 total elements.

Observed topology:

```text
HEAD
  STYLE#claude-agent-animation-styles

BODY
  DIV#claude-agent-glow-border
    DIV#claude-agent-glow-border-inner
  DIV#claude-agent-stop-container
    BUTTON#claude-agent-stop-button
  DIV#claude-phantom-cursor
```

### Removal behavior

The full marker family remained connected for about 16.7 seconds. Claude then
removed the glow subtree in one callback and removed the stop and cursor subtrees in
the following callback. No marker was reparented or recreated during this run.

### Design implications

This run supports a fast normal-path detector at the mutation-record boundary:

1. Watch only direct additions to the real `document.body`.
2. Exact-match the three root IDs.
3. Treat each root's attached subtree as the source of its known child marker.

This would detect the Claude product from three roots without checking every
serialized element ID. It cannot independently preserve the current child-level
signal contract unless the detector also verifies the attached child IDs or changes
those signals from observed to inferred.

The result does not yet remove the edge cases that made the targeted implementation
larger:

- Clarity may start after the roots already exist.
- Another Claude version may assign an ID after insertion.
- BODY replacement and lifecycle restarts still require handling.
- Open shadow roots and same-origin iframes are covered by the current traversal.
- One run does not establish behavior across the extension and Desktop handoff
  flows.

The capture observer spent 1.2 ms in the insertion callback, but this number includes
the verifier's subtree snapshots and should not be treated as production detector
cost.

## Presence-only candidate

The two child marker values are redundant for product presence:

| Value | Child marker | Observed parent |
| --- | --- | --- |
| `2` | `claude-agent-glow-border-inner` | `claude-agent-glow-border`, value `1` |
| `4` | `claude-agent-stop-button` | `claude-agent-stop-container`, value `3` |

The high-fidelity capture showed both children already attached when their parent
roots were inserted. An earlier Claude Desktop capture did not contain the stop
container or stop button, so the stop family should not be the only Claude sentinel.

A smaller presence-only detector could use:

- Claude: `claude-agent-glow-border` or `claude-phantom-cursor`;
- Codex: `codex-agent-overlay-root`;
- stop checking after the first observed match.

The detector would keep the actual value of the root that matched rather than create
a canonical product value.

Possible implementation shape:

1. At startup, call `getElementById` for the small root set to cover an overlay that
   already exists.
2. During mutation processing, inspect only direct additions to the real BODY for
   Claude and the real HTML element for Codex.
3. Exact-match the added root's ID.
4. Log the first observed root value and disable later marker checks.
5. Do not scan descendants, poll IDs, or add another observer.

Before replacing the current hook, repeated extension and Desktop captures should
show that at least one selected Claude root is always present, already has its final
ID at insertion, and remains a direct BODY child. Historical playback should also
show that every previously detected Claude session contains value `1` or `5`.

## Historical playback coverage

A production playback sample contained 20 sessions, of which 14 had Claude marker
layout events. Marker coverage within those 14 positive sessions was:

| Marker | Positive sessions | Coverage |
| --- | ---: | ---: |
| `claude-agent-glow-border` | 14 | 100% |
| `claude-agent-glow-border-inner` | 14 | 100% |
| `claude-phantom-cursor` | 13 | 92.9% |
| `claude-agent-stop-container` | 3 | 21.4% |
| `claude-agent-stop-button` | 3 | 21.4% |

The glow root alone covered every marker-positive session in this sample. Phantom
cursor is useful as a secondary sentinel, but it was absent from one positive
session. Stop controls are not reliable presence sentinels.

The sample contained 644 marker-related layout events. This confirms that the
existing playback stream carries the root ID without requiring a separate client
signal. The sample is supportive rather than exhaustive.

## Startup-existing marker result

The startup scenario delayed the fixed root lookups until Claude was already active:

- Claude roots appeared at about 21,332 ms.
- The simulated startup lookup ran at about 27,339 ms, roughly 6.0 seconds later.
- `getElementById` found both `claude-agent-glow-border` and
  `claude-phantom-cursor`.
- The roots remained present until about 33,689 ms.
- All roots were direct BODY children with final IDs at insertion.
- All five marker first sightings occurred within 0.5 ms in one observer callback.

This passes the startup-existing gate for the tested Claude extension flow. Fixed
startup lookups can detect an overlay that was active before the presence detector
started.

## Backend start and stop capability

Dimension 39 is sufficient for page-level presence and approximate first detection.
It is deduplicated by value and does not send a corresponding event when a marker is
removed, so the dimension alone cannot describe an active interval.

The existing playback Discover and Mutation stream contains enough information for
the backend to infer start and stop:

1. A recognized marker appears in Discover or Mutation data.
2. The backend remembers its replay node ID.
3. A later Mutation removes the node or changes its identifying ID.
4. The backend closes the interval when no recognized marker nodes remain.
5. An interval still open at page end is closed as page-ended.

The backend should use a set or reference count because Claude inserts several marker
nodes and may remove them in separate records. The high-fidelity capture removed the
glow subtree first, followed about 0.4 ms later by the stop and cursor subtrees.

If Clarity starts while Claude is already active, the initial Discover timestamp
means "active when observation began," not the exact earlier start time. If the page
ends with a marker still present, playback establishes that activity continued
through page end but cannot observe a later stop.

Moving client presence detection to selected roots does not remove this backend
capability because Clarity continues to serialize the same DOM additions and
removals for playback.

## Root-presence runtime model

A Chromium microbenchmark compared the current lowercase-`c` traversal hook with a
presence-only detector that performs three fixed startup lookups and checks only
top-level BODY or HTML additions.

| Scenario | Current hook | Root presence | Time saved |
| --- | ---: | ---: | ---: |
| 5,000 elements, 100 top-level additions | 0.0102 ms | 0.0004 ms | 0.0098 ms |
| 50,000-element initial discovery | 0.0916 ms | 0.0002 ms | 0.0914 ms |
| 50,000 elements in 1,000 added subtrees | 0.0896 ms | 0.0024 ms | 0.0872 ms |
| 50,000 elements with a late marker | 0.1068 ms | 0.0026 ms | 0.1042 ms |

The detector slice was 96% to 99.8% faster because it reduced thousands of
per-element checks to a small number of root checks. The absolute saving was about
0.01 ms on the 5,000-element model and 0.09 to 0.10 ms on the 50,000-element models.

These percentages apply only to marker detection. Clarity still performs DOM
discovery, attribute serialization, and replay processing, so the total Clarity and
page-runtime improvement would be much smaller. The change is unlikely to move Web
Vitals by itself. Bundle size must be measured from the finished implementation
because startup and lifecycle handling could offset the removed detector code.

## Root-presence trial implementation

The presence-only design was implemented as a working branch experiment:

- Removed agent detection from the per-element path in `node.ts`.
- Added three fixed startup lookups in `agent.ts`.
- Added a second fixed scan at window load when delayed DOM observation is enabled.
- Checked only top-level nodes from `childList` additions.
- Used the MutationRecord target as parent provenance, including for nodes removed
  before deferred mutation processing.
- Accepted only Claude glow or phantom roots directly beneath BODY.
- Accepted only the Codex overlay root directly beneath HTML.
- Logged the first actually observed root value and stopped later checks.
- Left playback discovery, traversal, serialization, and removal records unchanged.

Synchronous ID assignment after insertion can still be detected because the queued
MutationRecord contains a live node reference. An ID assigned after that mutation has
already been processed is intentionally ignored.

The focused presence suite covers existing roots, dynamic roots, synchronous and
delayed ID assignment, transient removal, duplicate roots, Codex placement, nested
lookalikes, open shadow roots, and same-origin iframes. All 10 tests pass.

Bundle comparison:

| Version | Raw bytes | Deterministic gzip |
| --- | ---: | ---: |
| Beta before the lowercase guard | 74,773 | 26,688 |
| Lowercase-`c` guarded implementation | 74,795 | 26,696 |
| Root-presence trial | 74,989 | 26,682 |

Compared with the lowercase-`c` implementation, the trial is 194 raw bytes larger
but 14 gzip bytes smaller. The lifecycle and startup code increases uncompressed
source while repeated strings and removed switch cases compress favorably.

The final read-only review returned `SHIP`.

## Codex validation status

The Codex contract is implemented using only `codex-agent-overlay-root` as a direct
child of HTML for the Chrome extension and `codex-browser-sidebar-comments-root` as a
direct child of HTML for the ChatGPT in-app browser.

The ChatGPT in-app browser completed the verifier task and added
`codex-browser-sidebar-comments-root` directly beneath HTML. The Chrome extension
overlay retains signal value `6`, while the in-app sidebar uses the distinct signal
value `7`. Backend presence queries can roll up both values without misidentifying
which surface produced the signal.

A genuine ChatGPT Chrome extension run produced the active Codex marker:

- `codex-agent-overlay-root` was inserted about 22.53 seconds after page load.
- It was inserted directly beneath the real HTML element.
- Its final ID was present at insertion.
- It was the top-level node in one `childList` record.
- It remained connected through the end of the 124-second capture.
- No later ID assignment, removal, reparenting, or duplicate marker was observed.
- The root-presence candidate classified the run successfully.

Focused browser tests also cover:

- an overlay root already present when Clarity starts;
- an overlay root inserted after Clarity starts;
- an overlay root inserted and removed in the same script turn;
- a sidebar root present at startup or inserted after Clarity starts;
- the required direct-HTML parent relationship;
- rejection of nested sidebar roots and similar IDs.

## Current recommendation

The root-presence trial is now the preferred client candidate. It matches the formal
presence-only requirement, passed the existing-marker and mutation scenarios, passed
the genuine startup-existing capture, covered every marker-positive historical
playback through the glow root, and reduced the detector slice by 96% to 99.8%.
The final candidate, including both Codex surfaces and per-product deduplication, is
75,133 raw bytes and 26,752 deterministic gzip bytes. That is 338 raw bytes and 56
gzip bytes larger than the earlier lowercase-`c` implementation; the improvement is
in detector runtime rather than final bundle size. Additional genuine Claude extension
and Desktop repetitions remain useful for confidence in the root contract.
