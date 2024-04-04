import { Data, Interaction, Layout } from "clarity-js";
import { InteractionEvent, ClickData, TimelineData } from "../types/interaction";

export function decode(tokens: Data.Token[]): InteractionEvent {
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
                y: tokens[4] as number
            };
            return { time, event, data: pointerData };
        case Data.Event.Click:
            let clickHashes = (tokens[12] as string).split(Data.Constant.Dot);
            let clickData: ClickData = {
                target: tokens[2] as number,
                x: tokens[3] as number,
                y: tokens[4] as number,
                eX: tokens[5] as number,
                eY: tokens[6] as number,
                button: tokens[7] as number,
                reaction: tokens[8] as number,
                context: tokens[9] as number,
                text: tokens[10] as string,
                link: tokens[11] as string,
                hash: clickHashes[0],
                hashBeta: clickHashes.length > 0 ? clickHashes[1] : null,
                trust: tokens.length > 13 ? tokens[13] as number : Data.BooleanFlag.True
            };
            return { time, event, data: clickData };
        case Data.Event.Clipboard:
            let clipData: Interaction.ClipboardData = { target: tokens[2] as number, action: tokens[3] as Interaction.Clipboard };
            return { time, event, data: clipData };
        case Data.Event.Resize:
            let resizeData: Interaction.ResizeData = { width: tokens[2] as number, height: tokens[3] as number };
            return { time, event, data: resizeData };
        case Data.Event.Input:
            let inputData: Interaction.InputData = { target: tokens[2] as number, value: tokens[3] as string };
            return { time, event, data: inputData };
        case Data.Event.Selection:
            let selectionData: Interaction.SelectionData = {
                start: tokens[2] as number,
                startOffset: tokens[3] as number,
                end: tokens[4] as number,
                endOffset: tokens[5] as number
            };
            return { time, event, data: selectionData };
        case Data.Event.Change:
            let changeData: Interaction.ChangeData = {
                target: tokens[2] as number,
                type: tokens[3] as string,
                value: tokens[4] as string,
                checksum: tokens[5] as string
            };
            return { time, event, data: changeData };
        case Data.Event.Submit:
            let submitData: Interaction.SubmitData = {
                target: tokens[2] as number
            };
            return { time, event, data: submitData };
        case Data.Event.Scroll:
            let scrollData: Interaction.ScrollData = {
                target: tokens[2] as number,
                x: tokens[3] as number,
                y: tokens[4] as number,
                topElement: tokens[5] as string,
                bottomElement: tokens[6] as string
            };
            return { time, event, data: scrollData };
        case Data.Event.Timeline:
            let timelineHashes = (tokens[3] as string).split(Data.Constant.Dot);
            let timelineData: TimelineData = {
                type: tokens[2] as number,
                hash: timelineHashes[Layout.Selector.Alpha],
                x: tokens[4] as number,
                y: tokens[5] as number,
                reaction: tokens[6] as number,
                context: tokens[7] as number,
                hashBeta: timelineHashes.length > 0 ? timelineHashes[Layout.Selector.Beta] : null
            };
            return { time, event, data: timelineData };
        case Data.Event.Visibility:
            let visibleData: Interaction.VisibilityData = { visible: tokens[2] as string };
            return { time, event, data: visibleData };
        case Data.Event.Unload:
            let unloadData: Interaction.UnloadData = { name: tokens[2] as string };
            return { time, event, data: unloadData };
    }
    return null;
}
