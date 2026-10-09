# Clarity
Clarity is an open-source behavioral analytics library written in typescript, with two key goals: privacy & performance. 

It helps you understand how users view and use your website across all modern devices and browsers. Understanding how users navigate, interact and browse your website can provide new insights about your users. Empathizing with your users and seeing where features fail or succeed can help improve your product, grow revenue and improve user retention.

It's the same code that powers Microsoft's hosted behavioral analytics solution: <a href="https://clarity.microsoft.com">https://clarity.microsoft.com</a>. If you would like to see a demo of how it works, checkout <a href="https://clarity.microsoft.com/demo/projects/view/3t0wlogvdz/impressions?date=Last%203%20days">live demo</a>. 

We encourage the community to join us in building the best behavioral analytics library, that puts privacy first and prioritizes performance. 

## Examples
Here are some example sessions on popular websites visualized to demonstrate the telemetry captured:
1. CNN (Web)
</br><a href="https://thumbs.gfycat.com/AggressiveLankyAbyssiniangroundhornbill-size_restricted.gif"><img src="https://thumbs.gfycat.com/AggressiveLankyAbyssiniangroundhornbill-size_restricted.gif" title="Clarity - CNN Example"/></a>

2. Cook with Manali (Mobile)
</br><a href="https://thumbs.gfycat.com/CoolDependableAdamsstaghornedbeetle-size_restricted.gif"><img src="https://thumbs.gfycat.com/CoolDependableAdamsstaghornedbeetle-size_restricted.gif" title="Clarity - Cook With Manali Example"/></a> 

## Privacy Notice
Clarity handles sensitive data with care. By default sensitive content on the page is masked before uploading to the server.

## Improving Clarity
If you haven't already done so, start contributing by following instructions **[here](https://github.com/microsoft/clarity/blob/master/CONTRIBUTING.md)**.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

Happy coding!

## Experimental page headings: encoder reuse

This review branch reuses text already scrubbed by the DOM encoder. Discovery
retains at most ten main-document heading candidates and prepares their text-node
IDs in document order. The encoder supplies those nodes' existing scrubbed values;
only successful encoding can finalize up to three readable, 60-unit headings.
There is no second textContent read or privacy scrub.
The first collect response is permission, not an encoding-completion signal.
Visits ending before encoding finishes can lose headings that the original
pre-encoding collector would have prepared.

Lean + lite intentionally skips collection. Ordinary lean mode can still collect
from encoded records without uploading replay. A heading whose required text was
not encoded in the pass remains pending rather than using raw cached text.

Masked playback length codes become bounded bullet placeholders for heading
formatting. Their internal spacing is not recoverable from the length code;
permitted text and playback tokens are unchanged. Temporary text references and
ordered node-ID arrays are released after completion, including unused candidates.
Candidate/output limits do not bound every subtree
visit, encoder cost or temporary reference count.

The four focused browser cases cover compact payload bounds, candidate backfill,
privacy overrides and cache reuse, authorization, completion/cancellation, and
the intentional lean-plus-lite skip. The unrelated SNAPSHOT cases are unchanged.
This prototype changes collection timing and masked-placeholder formatting, not
the backend sampling rate, HEADINGS command, dimension ID or replay wire format.

### Synthetic performance comparison

Build both worktrees first. The baseline must be checked out at c2928d8.
From this repository root, run:

```powershell
$env:HEADING_BENCH_SAMPLES = "20"
node packages\clarity-js\test\pageheadings.benchmark.cjs C:\repos\clarity-baseline C:\results\headings
```

The benchmark alternates the real minified SDKs on eight synthetic pages, with
two warmups. It records the SDK's existing LayoutCost metric, synchronous start
duration, output equality, bundle sizes, and separate diagnostic scrub counts.
This measures the whole DOM pipeline, not isolated heading time or production
Web Vitals. Six-mode controls compare Discover/Mutation replay tokens and prove
that heading preparation/completion does not read or scrub raw text again.

Results are saved as benchmark.json and an offline report.html. Requests are
intercepted locally; no telemetry leaves the browser. The benchmark is opt-in,
outside the four default heading cases, and imposes no flaky speed threshold.
Lean + lite is reported as a scope difference, not a like-for-like performance win.

The local 20-sample comparison found a clear benefit on the synthetic
long-sensitive-text page: median LayoutCost fell from150ms to79ms, with text
scrubs reduced from6 to3. A typical page stayed at21ms; fragmented and masked
fragmented headings rose from38ms to40ms and33ms to35ms respectively. These
figures are whole-pipeline synthetic results, not a universal speedup: preparing
all candidate text IDs adds work when the original collector needed only a short
prefix. The normal bundle grew by542 minified bytes /201 gzip bytes.
