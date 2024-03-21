import { SlotState } from "@clarity-types/layout";
import { Event } from "@clarity-types/data";
import { getId } from "@src/layout/dom";
import encode from "./encode";

export let state: SlotState[] = [];

export function compute(): void {
    console.log(`start of slot compute and we have ${state.length} in state`);
    for (var stateElement of state) {
        if (stateElement.assignedSlot <= 0) {
            // we need to find the id of the slotted parent of this element and add it
            // to the state for eventual transmission
            let element = (stateElement.node as HTMLElement);
            // todo (samart): not sure the getId will work on assignedSlot since it is a htmlslotelement rather than a Node
            let assignedSlotId = getId(element.assignedSlot);
            if (assignedSlotId != null) {
                console.log('found slot');
                stateElement.assignedSlot = assignedSlotId;
            } else {
                // todo (samart): we should probably remove this one from the state or something - if we don't have the parent we cant slot it
                console.log('sam unexpected state');
            }

        }
    }
    console.log(`end of slot compute and we have ${state.length} in state`);
    if (state.length > 0) {
        encode(Event.Slot);
    }
}

export function reset(): void {
    state = [];
    
}

export function stop(): void {
    reset();
}
