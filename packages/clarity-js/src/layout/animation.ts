import { Event } from "@clarity-types/data";
import { AnimationOperation, AnimationState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId } from "@src/layout/dom";
import * as core from "@src/core";

export let state: AnimationState[] = [];
let animationPlay: () => void = null;
let animationPause: () => void = null;
let animationCancel: () => void = null;
let animationFinish: () => void = null;
const animationId = 'clarityAnimationId';
const operationCount = 'clarityOperationCount';
const maxOperations = 20;

export function start(): void {
    reset();
    overrideAnimationHelper(animationPlay, "play");
    overrideAnimationHelper(animationPause, "pause");
    overrideAnimationHelper(animationCancel, "cancel");
    overrideAnimationHelper(animationFinish, "finish");
}

export function reset(): void {
    state = [];
}

function track(time: number, id: string, operation: AnimationOperation, keyFrames?: string, timing?: string, targetId?: number, timeline?: string): void {
    state.push({
        time,
        event: Event.Animation,
        data: {
            id,
            operation,
            keyFrames,
            timing,
            targetId,
            timeline
        }
    });

    encode(Event.Animation);
}

export function stop(): void {
    reset();
}

function overrideAnimationHelper(functionToOverride: () => void, name: string) {
    if (functionToOverride === null) {
      functionToOverride = Animation.prototype[name];
      Animation.prototype[name] = function(): void {
        if (core.active()) {
            if (!this[animationId]) {
                this[animationId] = shortid();
                this[operationCount] = 0;
                let keyframes = (<KeyframeEffect>this.effect).getKeyframes();
                let timing = (<KeyframeEffect>this.effect).getTiming();
                track(time(), this[animationId], AnimationOperation.Create, JSON.stringify(keyframes), JSON.stringify(timing), getId(this.effect.target));
            }

            if (this[operationCount]++ < maxOperations)  {
                switch (name) {
                    case "play":
                        track(time(), this[animationId], AnimationOperation.Play);
                        break;
                    case "pause":
                        track(time(), this[animationId], AnimationOperation.Pause);
                        break;
                    case "cancel":
                        track(time(), this[animationId], AnimationOperation.Cancel);
                        break;
                    case "finish":
                        track(time(), this[animationId], AnimationOperation.Finish);
                        break;
                }
            }
        }
        
        return functionToOverride.apply(this, arguments);
      }
    }
  }