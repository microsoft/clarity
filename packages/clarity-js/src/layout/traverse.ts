import { Task, Timer } from "@clarity-types/core";
import { Source } from "@clarity-types/layout";
import * as task from "@src/core/task";
import node from "@src/layout/node";

export default async function(root: Node, timer: Timer, source: Source): Promise<void> {
    let primaryQueue = [root];
    let slottedNodesQueue: Node[] = [];
    for (var currentQueue of [primaryQueue, slottedNodesQueue]) {
        while (currentQueue.length > 0) {
            let entry = currentQueue.shift();
            let next = entry.firstChild;
    
            while (next) {
                // During traversal there is not a guarantee that the assigned child here is being found after the slot to which it is placed
                // as the typical parent/child methods don't reflect what is rendered. We need to make sure all other mutations and
                // discoveries are processed before we process a slotted element. Once we are processing the slottedNodesQueue we can
                // skip this effort and go directly to our breadth first traversal.
                if (currentQueue == primaryQueue) {
                    var slottedParent = (next as HTMLElement).assignedSlot;
                    if (slottedParent) {
                        slottedNodesQueue.push(next);
                    } else {
                        currentQueue.push(next);
                    }
                } else {
                    currentQueue.push(next);
                }                
                next = next.nextSibling;
            }
          
            // Check the status of current task to see if we should yield before continuing
            let state = task.state(timer);
            if (state === Task.Wait) { state = await task.suspend(timer); }
            if (state === Task.Stop) { break; }
    
            // Check if processing a node gives us a pointer to one of its sub nodes for traversal
            // E.g. an element node may give us a pointer to traverse shadowDom if shadowRoot property is set
            // Or, an iframe from the same origin could give a pointer to it's document for traversing contents of iframe.
            let subnode = node(entry, source);
            if (subnode) { currentQueue.push(subnode); }
        }
    }
}
