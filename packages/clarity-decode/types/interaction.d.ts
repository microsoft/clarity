import { Interaction } from "clarity-js";
import { PartialEvent } from "./core";

export interface ClickData extends Interaction.ClickData {
    hashBeta: string;
}

export interface TimelineData extends Interaction.TimelineData {
    hashBeta: string;
}

export interface ClickVizualizationData {
    doc: HTMLElement;
    click: HTMLElement;
    time: number;
}

export interface InputEvent extends PartialEvent { data: Interaction.InputData; }
export interface ChangeEvent extends PartialEvent { data: Interaction.ChangeData; }
export interface ClickEvent extends PartialEvent { data: ClickData; }
export interface ClipboardEvent extends PartialEvent { data: Interaction.ClipboardData; }
export interface PointerEvent extends PartialEvent { data: Interaction.PointerData; }
export interface ResizeEvent extends PartialEvent { data: Interaction.ResizeData; }
export interface ScrollEvent extends PartialEvent { data: Interaction.ScrollData; }
export interface SelectionEvent extends PartialEvent { data: Interaction.SelectionData; }
export interface SubmitEvent extends PartialEvent { data: Interaction.SubmitData; }
export interface TimelineEvent extends PartialEvent { data: TimelineData; }
export interface UnloadEvent extends PartialEvent { data: Interaction.UnloadData; }
export interface VisibilityEvent extends PartialEvent { data: Interaction.VisibilityData; }
export interface InteractionEvent extends PartialEvent {
    data: ClickData |
    Interaction.ChangeData |
    Interaction.ClipboardData |
    Interaction.InputData |
    Interaction.PointerData |
    Interaction.ResizeData |
    Interaction.ScrollData |
    Interaction.SelectionData |
    Interaction.SubmitData |
    TimelineData |
    Interaction.UnloadData |
    Interaction.VisibilityData;
}
