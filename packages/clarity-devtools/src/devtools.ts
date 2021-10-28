import { Data } from "clarity-js";

declare let $0: any;
chrome.devtools.panels.create("Clarity", null, "panel.html");

chrome.devtools.panels.elements.createSidebarPane("Clarity", function(sidebar: any): void {
    function updateClarityInfo(): void {
        let code = "(" + inspect.toString() + ")()";
        let inspectedWindow = chrome.devtools.inspectedWindow as any;
        inspectedWindow.eval(code, function(result: any): void {
            sidebar.setObject(result);
        });
    }

    chrome.devtools.panels.elements.onSelectionChanged.addListener(updateClarityInfo);
    sidebar.onShown.addListener(updateClarityInfo);
    updateClarityInfo();
});

function inspect(): any {
    let clarity = window[Data.Constant.Clarity];
    let tag = $0 ? $0.tagName : "*NA*";
    let value = $0 && "h" in clarity ? clarity.h("get", $0) : null;
    let id = value ? value.id : null;
    let output = { id, tag, value };
    return output;
}
