import { ClaritySignal, SignalCallback } from '@clarity-types/data';

export let signalCallback: SignalCallback = null;

export function signal(cb: SignalCallback): void {
  signalCallback = cb;
}

export function signalsEvent(signalsPayload: string) {
  try {
    if (signalCallback) {
      (JSON.parse(signalsPayload) as ClaritySignal[]).forEach(s => signalCallback(s));
    }
  } catch {
    //do nothing
  }
}
