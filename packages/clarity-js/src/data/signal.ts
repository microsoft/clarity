import { ClaritySignal, SignalCallback } from '@clarity-types/data';

export let signalCallback: SignalCallback = null;

export function signal(cb: SignalCallback): void {
  signalCallback = cb;
}

function parseSignals(signalsPayload: string): ClaritySignal[] {
  try{
    const parsedSignals: ClaritySignal[] = JSON.parse(signalsPayload);
    return parsedSignals;
  }catch{
    return []
  }
}

export function signalsEvent(signalsPayload: string) {
  try {
    if (!signalCallback) {
      return;
    }
    const signals = parseSignals(signalsPayload);
    signals.forEach((signal) => {
      signalCallback(signal);
    });
  } catch {
    //do nothing
  }
}
