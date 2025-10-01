import { Event } from "@clarity-types/data";
import { active } from "@src/core";
import { schedule } from "@src/core/task";
import encode from "@src/layout/encode";

export const elements: string[] = [];

const definedElements = new Set<string>();
function register(tag: string) {
    if (!definedElements.has(tag)) {
        definedElements.add(tag);
        elements.push(tag);
        schedule(encode.bind(this, Event.CustomElement));
    }
}

export function check(tag: string) {
    if (window.customElements?.get && window.customElements.get(tag)) {
        register(tag);
    }
}

export function start() {
    window.clarityOverrides = window.clarityOverrides || {};
    if (window.customElements?.define && !window.clarityOverrides.define) {
        window.clarityOverrides.define = window.customElements.define;
        window.customElements.define = function () {
            if (active()) {
                register(arguments[0]);
            }
            return window.clarityOverrides.define.apply(this, arguments);
        };
    }
}

export function reset() {
    elements.length = 0;
}

export function stop() {
    reset();
    definedElements.clear();
}