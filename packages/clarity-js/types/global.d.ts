declare global {
  interface Window {
    clarityOverrides?: { [key: string]: ((...args: any[]) => any) | undefined };
    google_tag_data?: {
      ics: {
        addListener: (keys: string[], callback: () => void) => void;
        getConsentState: (key: string) => any;
      };
    };
    LiveChatWidget?: {
      off(eventName: string, callback: (data: any) => void): unknown;
      on: (eventName: string, callback: (data: any) => void) => void;
    };
    tidioChatApi?: {
      on: (eventName: string, callback: (data: any) => void) => void;
    };
  }

  interface Function {
    dn?: number;
  }
}

export {};
