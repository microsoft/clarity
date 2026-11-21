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

## Extended region exposure
The `clarity.extended.js` build preserves geometric region intersection separately from exposure.
It emits existing `ViewportExit` / `ViewportEnter` region events when qualifying modal surfaces
fully cover / uncover the viewport-clipped region. Partial coverage still counts as exposed.
Document-hidden time remains represented only by the separate visibility events, not synthetic
region exits/enters: hiding a tab must not split a continuous region visit. Actual click/input
events remain unchanged. Legacy builds retain their existing region behavior and wire format.

Qualifying surfaces are currently painted rectangular native modal dialogs or declared
`dialog` / `alertdialog` elements with `aria-modal="true"`, including discovered open shadow roots.
Nonzero background alpha counts, including translucent paint; transparent wrappers alone do not.
Painted descendants of transparent wrappers can qualify. Native fixed, inset-zero `::backdrop`
and painted fixed viewport-sized (or computed inset-zero) siblings below a modal in its immediate
container can also qualify. Sibling backdrops use their actual measured bounds, not an assumed
full viewport. Regions inside that modal are excluded from its own coverage.

Coverage uses rectangle union and bounded center/corner foreground hit tests, not pixel
visibility or modal interaction blocking. Unsupported shapes (rounded panes, rounded clipping
ancestors, masks, clip paths, filters, rotation or scale), pointer-events-invisible surfaces,
closed shadow roots, cross-document coverage, arbitrary pseudo-elements and unassociated overlays
are not inferred. Complex paint order between the sampled points is not proven by these checks.
Background images and non-rgb computed color formats alone are not treated as solid paint.

The existing mutation stream, intersection and resize observations, scroll and visibility events
schedule updates. Changes are coalesced over 100 ms; active observed CSS animations/transitions
are sampled, with timestamps from the actual observation rather than backdated onset. There is
no continuous idle polling. CSSOM-only or script-driven motion without an observed trigger can
remain undetected. Scheduled dialog sampling pauses while hidden and reconciles current coverage
on resume, without backdating changes during that pause. Work is capped at 128 registered dialogs, 64 candidate descendants/siblings
per container, 32 surfaces, 128 remaining rectangles, and bounded shadow hit-test traversal.
Exceeding a bound can leave coverage unrecognized; this is not a guarantee for all overlays.
No additional content or image data is collected.

## Improving Clarity
If you haven't already done so, start contributing by following instructions **[here](https://github.com/microsoft/clarity/blob/master/CONTRIBUTING.md)**.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

Happy coding!
