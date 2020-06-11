import { Interaction } from "clarity-js";
import { PartialEvent } from "./core";

export interface InputEvent extends PartialEvent { data: Interaction.InputData; }
export interface ClickEvent extends PartialEvent { data: Interaction.ClickData; }
export interface PointerEvent extends PartialEvent { data: Interaction.PointerData; }
export interface ResizeEvent extends PartialEvent { data: Interaction.ResizeData; }
export interface ScrollEvent extends PartialEvent { data: Interaction.ScrollData; }
export interface SelectionEvent extends PartialEvent { data: Interaction.SelectionData; }
export interface TimelineEvent extends PartialEvent { data: Interaction.TimelineData; }
export interface UnloadEvent extends PartialEvent { data: Interaction.UnloadData; }
export interface VisibilityEvent extends PartialEvent { data: Interaction.VisibilityData; }
export interface InteractionEvent extends PartialEvent {
    data: Interaction.ClickData |
    Interaction.InputData |
    Interaction.PointerData |
    Interaction.ResizeData |
    Interaction.ScrollData |
    Interaction.SelectionData |
    Interaction.TimelineData |
    Interaction.UnloadData |
    Interaction.VisibilityData;
}
