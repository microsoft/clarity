import { Event } from "@clarity-types/data";
import { AnimationOperation, AnimationState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId } from "@src/layout/dom";

export let state: AnimationState[] = [];
// TODO (samart): think we should have an animation module probably
let animationPlay: () => void = null;
let animationPause: () => void = null;
let animationCancel: () => void = null;
let animationFinish: () => void = null;
let animationUpdateTiming: () => void = null;
let animationSetKeyFrames: () => void = null;

export function start(): void {
    reset();
    overrideAnimationHelper(animationPlay, "play");
    overrideAnimationHelper(animationPause, "pause");
    overrideAnimationHelper(animationCancel, "cancel");
    overrideAnimationHelper(animationFinish, "finish");
    overrideAnimationHelper(animationUpdateTiming, "updateTiming");
    overrideAnimationHelper(animationSetKeyFrames, "setKeyFrames");
}

export function reset(): void {
    state = [];
}

export function track(time: number, id: string, operation: AnimationOperation, keyFrames?: string, targetId?: number, timeline?: string): void {
    console.log(`animation track operation ${operation} on id ${id}`);
    state.push({
        time,
        event: Event.Animation,
        data: {
            id,
            operation,
            keyFrames,
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

// TODO (samart): these seem to get undone before people are actually calling play on https://cdpn.io/rachelnabors/fullpage/eJyWzm?anon=true&editors=0010&view=
function overrideAnimationHelper(whereToStoreFunction: () => void, name: string) {
    if (whereToStoreFunction === null) {
      whereToStoreFunction = Animation.prototype[name];
      Animation['clarity'] = true;
      Animation.prototype[name] = function(): void {
        console.log(`samart here are animate ${name}`);
        console.log(this);
        if (!this['clarityAnimationName']) {
          this['clarityAnimationName'] = shortid();
          let keyframes = (<KeyframeEffect>this.effect).getKeyframes();
          track(time(), this['clarityAnimationName'], AnimationOperation.Create, JSON.stringify(keyframes), getId(this.effect.target));
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
            // TODO (samart): should have the update timing and keyframes here
        }
        return whereToStoreFunction.apply(this, arguments);
      }
    }
  }