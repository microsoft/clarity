
import { Layout } from "clarity-js";

declare let $0: any;
chrome.devtools.panels.create("Clarity", null, "panel.html");

chrome.devtools.panels.elements.createSidebarPane("Clarity", function(sidebar: any): void {
    function updateClarityInfo(): void {
        let code = "(" + inspect.toString() + ")()";
        let inspectedWindow = chrome.devtools.inspectedWindow as any;
        inspectedWindow.eval(code, { useContentScriptContext: true }, function(result: any): void {
            sidebar.setObject(result);
        });
    }

    chrome.devtools.panels.elements.onSelectionChanged.addListener(updateClarityInfo);
    sidebar.onShown.addListener(updateClarityInfo);
    updateClarityInfo();
});

function inspect(): any {
    let DEVTOOLS_HOOK: string = Layout.Constant.DEVTOOLS_HOOK;
    let hookEnabled = DEVTOOLS_HOOK in window && "history" in window[DEVTOOLS_HOOK];
    let tag = $0 ? $0.tagName : "*NA*";
    let value = hookEnabled && $0 ? window[DEVTOOLS_HOOK].get($0) : null;
    let id = hookEnabled && value ? value.id : null;
    let history = hookEnabled && id ? window[DEVTOOLS_HOOK].history(id) : null;
    let parent = hookEnabled && value ? window[DEVTOOLS_HOOK].getNode(value.parent) : null;
    return { id, tag, node: $0, parent, value, history };
}
