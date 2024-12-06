import { Event } from "@clarity-types/data";
import { AnimationOperation, AnimationState } from "@clarity-types/layout";
import { time } from "@src/core/time";
import { shortid } from "@src/data/metadata";
import encode from "@src/layout/encode";
import { getId } from "@src/layout/dom";
import * as core from "@src/core";

export let state: AnimationState[] = [];
let elementAnimate: (keyframes: Keyframe[] | PropertyIndexedKeyframes, options?: number | KeyframeAnimationOptions) => Animation = null;
let animationPlay: () => void = null;
let animationPause: () => void = null;
let animationCommitStyles: () => void = null;
let animationCancel: () => void = null;
let animationFinish: () => void = null;
const animationId = 'clarityAnimationId';
const operationCount = 'clarityOperationCount';
const maxOperations = 20;

export function start(): void {
    if (
        window["Animation"] && 
        window["Animation"].prototype && 
        window["KeyframeEffect"] && 
        window["KeyframeEffect"].prototype && 
        window["KeyframeEffect"].prototype.getKeyframes &&
        window["KeyframeEffect"].prototype.getTiming
    ) {
        reset();
        overrideAnimationHelper(animationPlay, "play");
        overrideAnimationHelper(animationPause, "pause");
        overrideAnimationHelper(animationCommitStyles, "commitStyles");
        overrideAnimationHelper(animationCancel, "cancel");
        overrideAnimationHelper(animationFinish, "finish");
        if (elementAnimate === null) {
            elementAnimate = Element.prototype.animate;
            Element.prototype.animate = function(): Animation {
                var createdAnimation = elementAnimate.apply(this, arguments);
                trackAnimationOperation(createdAnimation, "play");
                return createdAnimation;
            }
        }
        if (document.getAnimations) {
            for (var animation of document.getAnimations()) {
                if (animation.playState === "finished") {
                    trackAnimationOperation(animation, "finish");
                }
                else if (animation.playState === "paused" || animation.playState === "idle") {
                    trackAnimationOperation(animation, "pause");
                }
                else if (animation.playState === "running") {
                    trackAnimationOperation(animation, "play");
                }
            }
        }
    }    
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
        trackAnimationOperation(this, name);
        return functionToOverride.apply(this, arguments);
      }
    }
  }

function trackAnimationOperation(animation: Animation, name: string) {
    if (core.active()) {
        let effect = <KeyframeEffect>animation.effect;
        let target = getId(effect.target);
        if (target !== null && effect.getKeyframes && effect.getTiming) {
            if (!animation[animationId]) {
                animation[animationId] = shortid();
                animation[operationCount] = 0;
                
                let keyframes = effect.getKeyframes();
                let timing = effect.getTiming();
                track(time(), animation[animationId], AnimationOperation.Create, JSON.stringify(keyframes), JSON.stringify(timing), target);
            }

            if (animation[operationCount]++ < maxOperations)  {
                let operation: AnimationOperation = null;
                switch (name) {
                    case "play":
                        operation = AnimationOperation.Play;
                        break;
                    case "pause":
                        operation = AnimationOperation.Pause;
                        break;
                    case "cancel":
                        operation = AnimationOperation.Cancel;
                        break;
                    case "finish":
                        operation = AnimationOperation.Finish;
                        break;
                    case "commitStyles":
                        operation = AnimationOperation.CommitStyles;
                        break;
                }
                if (operation) {
                    track(time(), animation[animationId], operation);
                }
            }
        }            
    }
}
