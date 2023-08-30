import { Event } from "@clarity-types/data";
import { AnimationOperation, AnimationState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId } from "@src/layout/dom";

export let state: AnimationState[] = [];
let animationPlay: () => void = null;
let animationPause: () => void = null;
let animationCancel: () => void = null;
let animationFinish: () => void = null;

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

export function track(time: number, id: string, operation: AnimationOperation, keyFrames?: string, timing?: string, targetId?: number, timeline?: string): void {
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
    state = [];
    reset();
}

function overrideAnimationHelper(whereToStoreFunction: () => void, name: string) {
    if (whereToStoreFunction === null) {
      whereToStoreFunction = Animation.prototype[name];
      Animation['clarity'] = true;
      Animation.prototype[name] = function(): void {
        if (!this['clarityAnimationName']) {
          this['clarityAnimationName'] = shortid();
          let keyframes = (<KeyframeEffect>this.effect).getKeyframes();
          let timing = (<KeyframeEffect>this.effect).getTiming();
          track(time(), this['clarityAnimationName'], AnimationOperation.Create, JSON.stringify(keyframes), JSON.stringify(timing), getId(this.effect.target));
        }

        switch (name) {
            case "play":
                track(time(), this['clarityAnimationName'], AnimationOperation.Play);
                break;
            case "pause":
                track(time(), this['clarityAnimationName'], AnimationOperation.Pause);
                break;
            case "cancel":
                track(time(), this['clarityAnimationName'], AnimationOperation.Cancel);
                break;
            case "finish":
                track(time(), this['clarityAnimationName'], AnimationOperation.Finish);
                break;
        }
        return whereToStoreFunction.apply(this, arguments);
      }
    }
  }