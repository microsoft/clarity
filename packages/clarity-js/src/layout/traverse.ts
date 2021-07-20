import { Task, Timer } from "@clarity-types/core";
import { Source } from "@clarity-types/layout";
import * as task from "@src/core/task";
import processNode from "./node";

export default async function(root: Node, timer: Timer, source: Source): Promise<void> {
    let queue = [root];
    while (queue.length > 0) {
        let node = queue.shift();
        let next = node.firstChild;

        while (next) {
            queue.push(next);
            next = next.nextSibling;
        }
      
        // Check the status of current task to see if we should yield before continuing
        let state = task.state(timer);
        if (state === Task.Wait) { state = await task.suspend(timer); }
        if (state === Task.Stop) { break; }

        // Check if processing a node gives us a pointer to one of its sub nodes for traversal
        // E.g. an element node may give us a pointer to traverse shadowDom if shadowRoot property is set
        // Or, an iframe from the same origin could give a pointer to it's document for traversing contents of iframe.
        let subnode = processNode(node, source);
        if (subnode) { queue.push(subnode); }
    }
}
