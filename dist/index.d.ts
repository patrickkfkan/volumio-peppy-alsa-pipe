declare class ControllerPeppyAlsaPipe {
    #private;
    constructor(context: any);
    getUIConfig(): any;
    getConfigurationFiles(): string[];
    /**
     * Plugin lifecycle
     */
    onVolumioStart(): any;
    onStart(): any;
    onStop(): any;
    showStatus(): void;
    configSaveMPDConfSettings(data: Record<string, any>): void;
    getStatus(): {
        fifoPaths: {
            meter: string;
            spectrum: string;
        };
        alsaDevices: {
            fullPipeline: string;
            peppyBypass: import("./lib/ConfManager").PeppyBypassStatus;
            peppyOnly: string;
        };
        mpdConf: import("./lib/ConfManager").MPDConfStatus;
    } | null;
}
export = ControllerPeppyAlsaPipe;
//# sourceMappingURL=index.d.ts.map