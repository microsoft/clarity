declare global {
    interface Window {
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
