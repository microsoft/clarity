declare global {
  interface Window {
    clarityOverrides?: { [key: string]: ((...args: any[]) => any) | undefined };
    google_tag_data?: {
      ics: {
        addListener: (keys: string[], callback: () => void) => void;
        getConsentState: (key: string) => any;
        usedUpdate: boolean;
      };
    };
    LiveChatWidget?: {
      off(eventName: string, callback: (data: any) => void): unknown;
      on: (eventName: string, callback: (data: any) => void) => void;
    };
    tidioChatApi?: {
      on: (eventName: string, callback: (data: any) => void) => void;
    };
    $crisp?: {
      push: (
        args: [action: string, eventName: string, callback: (data: any) => void]
      ) => void;
    };
    BrandAgentClarity?: {
      on: (eventName: string, callback: (data: any) => void) => void;
      off: (eventName: string, callback: (data: any) => void) => void;
      emit(eventName: string, event: any): void;
    };
  }

  interface Function {
    dn?: number;
  }
}

export {};
