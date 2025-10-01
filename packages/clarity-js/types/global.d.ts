declare global {
    interface Window {
        clarityOverrides?: { [key: string]: ((...args: any[]) => any) | undefined };
        google_tag_data?: {
            ics: {
                addListener: (keys: string[], callback: () => void) => void;
                getConsentState: (key: string) => any;
            };
        };
    }

    interface Function {
        dn?: number;
    }
}

export { };
