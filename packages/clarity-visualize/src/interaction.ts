import { Data, Interaction  } from "clarity-decode";
import { element } from "./layout";

// tslint:disable-next-line: max-line-length
let pointerIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAYCAYAAAD6S912AAAABGdBTUEAALGOfPtRkwAAACBjSFJNAAB6JQAAgIMAAPn/AACA6AAAdTAAAOpgAAA6lwAAF2+XqZnUAAACaUlEQVR4nGL8f58BHYgAsT8Q2wGxBBAzQcX/AfFrID4CxOuA+BWKLoX/YAoggBjRDHQD4ngglgRiPgyrIOAzEL8E4lVQg1EMBAggFiSFYUAcA8RSOAyCAV4oTgViTiBeiiwJEEAw71gRaRgyEAXiKCB2RBYECCCQgcIMEG+SYhgMiANxEhDzwwQAAghkoAMQK5NhGAwoALE1jAMQQCADQU7mpMBAZqijwAAggEAGqgAxOwUGskHNAAOAAAIZyEtIh4INg3bfHHD6xAUEYAyAAAIZ+IuQgU9fMLCXdzDIzV3JIIhDyQ8YAyCAQAaCUv8/fAZysDP8+/OXgTG7jkFhwRoMQ0F6n8M4AAEEMvAKsg34wM9fDEwgQ1dtRSQTIPgNxFdhHIAAAhm4AYg/EmMgCHz7zsCUVMaguHob3FCQYzbD5AECCGTgJSDeCbWJKPD1GwNzSjmD4tZ9DFxgvQr/b8PkAAIIlvVWA/FuUgz99IWBOTyXQcE+nOEOsjhAACGXNnJAHAnE9kAshqyIV5vB4Ms3cALGBkAlj9////9PgTgAAcSEJPEIiDuBeBYQP2CAhOt3BsLJCpSfNzAyMpqDOAABhF4ewh3FAMmf2kAsyqnBUPDjJ8HcdBvoSjWAAGIEEgTUMTAAbf/AwICSVGCgD4hPgJQA8WegWdsBAogFiyJC4C0QgxI3KLj4gIasRpYECCAGkAsJYSAAuRDEAKUEQwZIzgDxvwCxCrJagAAi1kAQAYpFESh/BlQMhJuR1QIEELEGlgOxHBLflAGSh0Gc60DMBpMDCCCiDMRhyXoGSJUaDgpPmDhAgAEAN5Ugk0bMYNIAAAAASUVORK5CYII=";
// tslint:disable-next-line: max-line-length
let clickIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAYCAYAAAD6S912AAAABGdBTUEAALGOfPtRkwAAACBjSFJNAAB6JQAAgIMAAPn/AACA6AAAdTAAAOpgAAA6lwAAF2+XqZnUAAADvklEQVR4nGL8//8/AzJgZGQQAVL+QGwHxBJAzASV+gfEr4H4CBCvA2p7xYAFAAQQI7KBQMPcgFQ8EEsCMR82DUDwGYhfAvEqoNZ16JIAAQQ3EGhYGJCKAWIpHAahA5BrlwC1L0UWBAggJqhhViQaBgKiQBwF1OuILAgQQExAAWEGiDeRDJsEFOM1AFplzMCgrcnAcIoTh6HiQJwENIMfJgAQQCAXOgCxMkLNaqBkvgIDg8Z3BoaC5wwMz9kYGKIVGRg+MjFgB0C1DNYwDkAAgRSBnIzkgnUCDAyswIBdf4+Bof8ZA0PHYwaGO0D5/Tw4DGSGOgoMAAIIZKAKELMj5D8AFXD+BUbyXwhf9Scw5QAt+MmIw0A2qBlgABBAIAN5cSgkBQjAGAABxALEv1BdiA4YobgFmDZPcjMwZLyB+JILmNAl/0AV/YCpBgggkIGg9MTNgMgRWAAL0MuvWRkYJgNzznRgzP4AqmUHGpj/AhgFnxgYlD4yMKiBVQIEEMiQK8g2YAJQ2JUAY/vFZQaGmfeBvgO6qhUYUU5AQ7qASc1Tg4FB35+RkRGUXRkAAgjkwg0MDMedGBh2AW3m+QtxCQuSgZxAl9h+gbAtvzEwJAN9VAXMxzc+Qlwa+JSBoRQUZL1AvBEggECB4wdMJqsYGH6zQ8IKlBWlgOF6/SowpoGGvQKaDgoqKSDxCWjAA2Cs6gF99AXIfgLEGsuA+kAJuwqYjRkBAgjk5S5gQQL00vHJDAwnLgFz1G9gPCElEbE/EMNAAGSBHjR4eIBiGtuBjKVQV4ABQACBDASG5t/dDAwWPQwMZkDbJlyApMG/UEN38UBc9hvIPwCMPFDy/AmM6UnXgN6eDywcniKHOEAAgQw8BsRBQGezASU7gfm9jYGh8hxQIzD2GIDZ7yYwjXwHuuYPMIHfApr2HxghbxcBY/giA4PmE6TUAgYAAQRilALxASCeBYwpb2A4bGBkTNnLAMmf2sDYBWbN73cZGDiAZeBxYBlp1w00CBg5DBlIXpUH4mcgBkAAMUDLw2So5CQQHxkDQRwQCzFAEn8oAyRVg/J+IVQM5ChgvmfYDFIPEEDIGudCDQ1HM9CFAZI9gckJXC2AggmUfwOh8mpQfZUgPkAAIWsEaToOxF+B2ATdpbgwEKRCDbQB8QECCF1SB4hBkXEeiPmJNBCUbEDZlwfEBwgg5CwBUnAFGDHpQCYw+TBsAbI3MUBqO2xFFyj9CELDdRlQLzg3AQQQLlujoAH9H6oRG/4HlT8ExCowvQABBgBOKHD8+UgEvgAAAABJRU5ErkJggg==";
// tslint:disable-next-line: max-line-length
let touchIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAYCAYAAAD6S912AAAACXBIWXMAAAsTAAALEwEAmpwYAAAFEmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDIgNzkuMTYwOTI0LCAyMDE3LzA3LzEzLTAxOjA2OjM5ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOS0wOS0xMVQwNjo1MzozMC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTktMDktMTFUMDY6NTQ6NDAtMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTktMDktMTFUMDY6NTQ6NDAtMDc6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0ic1JHQiBJRUM2MTk2Ni0yLjEiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ODZmNTE5ZGQtN2E3MS1hOTQyLTgwNTktMjc3OTJjNTM1YTNlIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjg2ZjUxOWRkLTdhNzEtYTk0Mi04MDU5LTI3NzkyYzUzNWEzZSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjg2ZjUxOWRkLTdhNzEtYTk0Mi04MDU5LTI3NzkyYzUzNWEzZSI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6ODZmNTE5ZGQtN2E3MS1hOTQyLTgwNTktMjc3OTJjNTM1YTNlIiBzdEV2dDp3aGVuPSIyMDE5LTA5LTExVDA2OjUzOjMwLTA3OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgqF3McAAAOgSURBVDiNlZVdbBRVFMd/d7o7penS7c6ghT60JRLCRx9s0JAIUvajJtCkVYw1IVaKUr/wpQk+qO8YRV8aEw3Q1EjpAwkNlkZNDMEYxUDoh9gSH7CNrXQptbtsHeluu7vHh5kuQ90l8k9ucuece373zJl77igRwa1YXK0BmoFdwFpAc1xZYBb4EegzAnKbPFJuYCyungEOAOuAsnwBwN/ADHDGCEhfQWAsrlqAl4DKAqCVmgV6jICcdhs1B/bUQ8IAHgH2x+IqeB8wFlcm9mvmYOFwq2kavsdNg22msWVzf39VSQFoBfBKLK787gx3A48tG44cCfpHhk/VwKYFn+9QFKL6wTZ9/Z07mvYfnK0aYIcbGARyGXzR/Wg5eOXq4Oj4H5Mnp3fVN0zBjZJjHz3tKwAscpLKATcAxcsGkUQRlGQMYzED0Ng4mgJNLEtXBYC6w8gBVxdY+DAqdwMXH7RSKQBFT090XXVVe+XQULl+7VqZPjWle1zLkssTD/Z5KuVeR+SRR2DWa1ndaxsingpIalCc9ftfu/XW4aH5UOhGIhK+l+Goe4eVsixdmeaB6Fxs5tdIw7MTUJ6urj40BaFEInG88oOjVzc1RJLNSqnmZeC5s2fXZ2u3tlfs3NG2Bma9duK2AoGF7OG3r1gAHR0X75pm0+zQ8MnbX39z5SYEE3V1rddBpoFP7OJAE3jPwFKx/ShA5eL4xK0xvz+bjUa9nlSqiJqaZDqR0LTBwQo9FIomLUtpY2OGtn37XK9p4AfeExGlgN+gqPjEiarzHm+m/mDbwmYQxidio35/NvuA75UFLgCfmgZvAu+LiNKAjZD5bt/zEx83NU32trRsG4GyTDqtKYDOzjpfIqFpS0uorq4tpZkMpFL8FQ63Xr982ew2AnLTvYsGXAL2mQa6EZAPP/v826P1u58cSqfVPLDQ/1VtkWV50um0Sg0M1GZEmIpGV305Mnzql7175v50nZbc5B3ge+C4UqpRRM719akL2P25dXJyVXB+Xv+9tDQ9c+knvWxw0Dy2d8/cXeANp+AA1cA0AM59+Krj7BQR3AN4GTCw2/MF7N4tATocmwcYB86LCO7ALgf64gpgBLs9vdi/BQ27f59z/BuduHdXAlcDPwP/AE+szLTQANod4M77gI6zFpgHhgH//wSexm5fn4jgbnBEZFQp9TrQCwwopfqd85bv6soAAaeuvSJi5T5Knl33O4UWJzDfyDr+H4ANy7H/AvM1z7/FQv/oAAAAAElFTkSuQmCC";

export function scroll(event: Interaction.ScrollEvent, iframe: HTMLIFrameElement): void {
    let data = event.data;
    let scrollTarget = element(data.target as number) as HTMLElement || iframe.contentDocument.body;
    if (scrollTarget) { scrollTarget.scrollTo(data.x, data.y); }
}

export function resize(
    event: Interaction.ResizeEvent,
    iframe: HTMLIFrameElement,
    onresize?: (width: number, height: number) => void): void {
    let data = event.data;
    let width = data.width;
    let height = data.height;
    if (onresize) { onresize(width, height); } else {
        let margin = 10;
        let px = "px";
        let container = iframe.ownerDocument.body;
        let offsetTop = iframe.offsetTop;
        let availableWidth = container.clientWidth - (2 * margin);
        let availableHeight = container.clientHeight - offsetTop - (2 * margin);
        let scale = Math.min(Math.min(availableWidth / width, 1), Math.min(availableHeight / height, 1));
        iframe.removeAttribute("style");
        iframe.style.position = "relative";
        iframe.style.width = width + px;
        iframe.style.height = height + px;
        iframe.style.transformOrigin = "0 0 0";
        iframe.style.transform = "scale(" + scale + ")";
        iframe.style.border = "1px solid #cccccc";
        iframe.style.overflow = "hidden";
        iframe.style.left = ((container.clientWidth - (width * scale)) / 2) + px;
    }
}

export function input(event: Interaction.InputEvent): void {
    let data = event.data;
    let el = element(data.target as number) as HTMLInputElement;
    if (el) {
        switch (el.type) {
            case "checkbox":
            case "radio":
                el.checked = data.value === "true";
                break;
            default:
                el.value = data.value;
                break;
        }
    }
}

export function selection(event: Interaction.SelectionEvent, iframe: HTMLIFrameElement): void {
    let data = event.data;
    let doc = iframe.contentDocument;
    let s = doc.getSelection();
    // Wrapping selection code inside a try / catch to avoid throwing errors when dealing with elements inside the shadow DOM.
    try { s.setBaseAndExtent(element(data.start as number), data.startOffset, element(data.end as number), data.endOffset); } catch (ex) {
        console.warn("Exception encountered while trying to set selection: " + ex);
    }
}

export function pointer(event: Interaction.PointerEvent, iframe: HTMLIFrameElement): void {
    let data = event.data;
    let type = event.event;
    let doc = iframe.contentDocument;
    let p = doc.getElementById("clarity-pointer");
    let pointerWidth = 20;
    let pointerHeight = 24;

    if (p === null) {
        p = doc.createElement("DIV");
        p.id = "clarity-pointer";
        p.style.position = "absolute";
        p.style.zIndex = "10000000";
        p.style.width = pointerWidth + "px";
        p.style.height = pointerHeight + "px";
        doc.body.appendChild(p);
    }

    p.style.left = (data.x - 8) + "px";
    p.style.top = (data.y - 8) + "px";
    switch (type) {
        case Data.Event.Click:
        case Data.Event.RightClick:
        case Data.Event.DoubleClick:
            p.style.background = `url(${clickIcon}) no-repeat left center`;
            break;
        case Data.Event.TouchMove:
        case Data.Event.TouchStart:
        case Data.Event.TouchEnd:
        case Data.Event.TouchCancel:
            p.style.background = `url(${touchIcon}) no-repeat left center`;
            break;
        default:
            p.style.background = `url(${pointerIcon}) no-repeat left center`;
            break;
    }
}