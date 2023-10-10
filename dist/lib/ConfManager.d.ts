export type PeppyBypassStatus = {
    available: true;
    alsaDevice: string;
} | {
    available: false;
    reason: string;
};
export type MPDConfStatus = {
    modified: true;
    description: string;
} | {
    modified: false;
    reason: string;
};
export interface PeppyAlsaPipeExports {
    fifoPaths: {
        meter: string;
        spectrum: string;
    };
    alsaDevices: {
        fullPipeline: string;
        peppyBypass: string | null;
        peppyOnly: string;
    };
}
export default class ConfManager {
    #private;
    constructor();
    destroy(): Promise<void>;
    getAlsaDevices(): {
        fullPipeline: string;
        peppyBypass: PeppyBypassStatus;
        peppyOnly: string;
    };
    getMpdConfStatus(): MPDConfStatus;
}
//# sourceMappingURL=ConfManager.d.ts.map