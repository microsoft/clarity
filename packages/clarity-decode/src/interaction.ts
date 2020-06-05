import { Data, Interaction } from "clarity-js";
import { InteractionEvent } from "../types/interaction";

export function decode(tokens: Data.Token[]): InteractionEvent  {
    let time = tokens[0] as number;
    let event = tokens[1] as Data.Event;
    switch (event) {
        case Data.Event.MouseDown:
        case Data.Event.MouseUp:
        case Data.Event.MouseMove:
        case Data.Event.MouseWheel:
        case Data.Event.DoubleClick:
        case Data.Event.TouchStart:
        case Data.Event.TouchCancel:
        case Data.Event.TouchEnd:
        case Data.Event.TouchMove:
            let pointerData: Interaction.PointerData = {
                target: tokens[2] as number,
                x: tokens[3] as number,
                y: tokens[4] as number,
                region: tokens.length > 5 ? tokens[5] as number : null
            };
            return { time, event, data: pointerData };
        case Data.Event.Click:
            let clickData: Interaction.ClickData = {
                target: tokens[2] as number,
                x: tokens[3] as number,
                y: tokens[4] as number,
                eX: tokens[5] as number,
                eY: tokens[6] as number,
                button: tokens[5] as number,
                text: tokens[6] as string,
                link: tokens[7] as string,
                hash: tokens[8] as string,
                region: tokens.length > 9 ? tokens[9] as number : null
            };
            return { time, event, data: clickData };
            break;
        case Data.Event.Baseline:
            let baselineData: Interaction.BaselineData = {
                scrollX: tokens[2] as number,
                scrollY: tokens[3] as number,
                pointerX: tokens[4] as number,
                pointerY: tokens[5] as number
            }
            return { time, event, data: baselineData };
        case Data.Event.Resize:
            let resizeData: Interaction.ResizeData = { width: tokens[2] as number, height: tokens[3] as number };
            return { time, event, data: resizeData };
        case Data.Event.Input:
            let inputData: Interaction.InputData = {
                target: tokens[2] as number,
                value: tokens[3] as string,
                region: tokens.length > 4 ? tokens[4] as number : null
            };
            return { time, event, data: inputData };
        case Data.Event.Selection:
            let selectionData: Interaction.SelectionData = {
                start: tokens[2] as number,
                startOffset: tokens[3] as number,
                end: tokens[4] as number,
                endOffset: tokens[5] as number,
                region: tokens.length > 6 ? tokens[6] as number : null
            };
            return { time, event, data: selectionData };
        case Data.Event.Scroll:
            let scrollData: Interaction.ScrollData = {
                target: tokens[2] as number,
                x: tokens[3] as number,
                y: tokens[4] as number,
                region: tokens.length > 5 ? tokens[5] as number : null
            };
            return { time, event, data: scrollData };
        case Data.Event.Visibility:
            let visibleData: Interaction.VisibilityData = { visible: tokens[2] as string };
            return { time, event, data: visibleData };
        case Data.Event.Unload:
            let unloadData: Interaction.UnloadData = { name: tokens[2] as string };
            return { time, event, data: unloadData };
    }
    return null;
}
