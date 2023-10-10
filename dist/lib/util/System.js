"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileExists = exports.mkfifo = exports.execCommand = void 0;
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const PeppyAlsaPipeContext_1 = __importDefault(require("../PeppyAlsaPipeContext"));
function execCommand(cmd, sudo = false, logError = true) {
    return new Promise((resolve, reject) => {
        PeppyAlsaPipeContext_1.default.getLogger().info(`[peppy_alsa_pipe] Executing ${cmd}`);
        (0, child_process_1.exec)(sudo ? `echo volumio | sudo -S ${cmd}` : cmd, { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
            if (error) {
                if (logError) {
                    PeppyAlsaPipeContext_1.default.getLogger().error(PeppyAlsaPipeContext_1.default.getErrorMessage(`[peppy_alsa_pipe] Failed to execute ${cmd}: ${stderr.toString()}`, error));
                }
                reject(error);
            }
            else {
                resolve(stdout.toString());
            }
        });
    });
}
exports.execCommand = execCommand;
async function mkfifo(path) {
    if (fs_1.default.existsSync(path) && !fs_1.default.lstatSync(path).isFIFO()) {
        await execCommand(`/bin/rm ${path}`, true);
    }
    if (!fs_1.default.existsSync(path)) {
        await execCommand(`/usr/bin/mkfifo ${path}`, true);
    }
    return execCommand(`/bin/chmod 0666 ${path}`, true);
}
exports.mkfifo = mkfifo;
function fileExists(path) {
    try {
        return fs_1.default.existsSync(path) && fs_1.default.lstatSync(path).isFile();
    }
    catch (error) {
        return false;
    }
}
exports.fileExists = fileExists;
//# sourceMappingURL=System.js.map