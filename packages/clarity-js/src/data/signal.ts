import { ClaritySignal, SignalCallback } from '@clarity-types/data';

export let signalCallback: SignalCallback = null;

export function signal(cb: SignalCallback): void {
  signalCallback = cb;
}

function parseSignals(signalsString: string): ClaritySignal[] {
  const signalsJson: ClaritySignal[] = JSON.parse(signalsString);
  return signalsJson;
}

export function signalEvent(signalsString: string) {
  try {
    if (!signalCallback) {
      return;
    }
    const signals = parseSignals(signalsString);
    signals.forEach((signal) => {
      signalCallback(signal);
    });
  } catch {
    //do nothing
  }
}
