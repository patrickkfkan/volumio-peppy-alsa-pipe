"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _ConfManager_instances, _ConfManager_playerConfChangeDelayTimer, _ConfManager_peppyBypassStatus, _ConfManager_mpdConfStatus, _ConfManager_playerConfWatcher, _ConfManager_isHandlingPlayerConfChange, _ConfManager_init, _ConfManager_handlePlayerConfWatcherEvent, _ConfManager_clearPlayerConfigChangeDelayTimer, _ConfManager_handlePlayerConfChange, _ConfManager_removeNoPeppyConf, _ConfManager_updateNoPeppyConf, _ConfManager_reloadAlsaConf, _ConfManager_updateMPDConf, _ConfManager_updateVolumioSharedVars;
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const PeppyAlsaPipeContext_1 = __importDefault(require("./PeppyAlsaPipeContext"));
const Misc_1 = require("./util/Misc");
const os_1 = require("os");
const System_1 = require("./util/System");
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
const Constants_1 = require("./util/Constants");
/**
 * Defines 'volumioNoPeppy' ALSA output that passes streams through the
 * same ALSA pipeline but without peppyalsa.
 */
const PEPPY_BYPASS_CONF_FILE = '/etc/alsa/conf.d/90-volumio-no-peppy.conf';
const PEPPY_BYPASS_CONF_TMP_FILE = '/tmp/peppy_alsa_pipe_no_peppy.conf';
const FULL_PIPELINE_ALSA_DEVICE = 'volumio';
const PEPPY_BYPASS_ALSA_DEVICE = 'volumioNoPeppy';
const PEPPY_FIFO_ALSA_DEVICE = 'peppy_fifo';
/**
 * Known plugins with alsa contribs that modify / resample streams
 * so DSDs become playable even with Peppy in the ALSA pipeline.
 */
const PEPPY_COMPAT_PLUGINS = [
    'fusiondsp'
];
class ConfManager {
    constructor() {
        _ConfManager_instances.add(this);
        _ConfManager_playerConfChangeDelayTimer.set(this, void 0);
        _ConfManager_peppyBypassStatus.set(this, void 0);
        _ConfManager_mpdConfStatus.set(this, void 0);
        _ConfManager_playerConfWatcher.set(this, void 0);
        _ConfManager_isHandlingPlayerConfChange.set(this, void 0);
        __classPrivateFieldSet(this, _ConfManager_peppyBypassStatus, {
            available: false,
            reason: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_NOT_READY')
        }, "f");
        __classPrivateFieldSet(this, _ConfManager_mpdConfStatus, {
            modified: false,
            reason: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_NOT_READY')
        }, "f");
        __classPrivateFieldSet(this, _ConfManager_playerConfWatcher, null, "f");
        __classPrivateFieldSet(this, _ConfManager_isHandlingPlayerConfChange, false, "f");
        __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_init).call(this);
    }
    async destroy() {
        __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_clearPlayerConfigChangeDelayTimer).call(this);
        if (__classPrivateFieldGet(this, _ConfManager_playerConfWatcher, "f")) {
            __classPrivateFieldGet(this, _ConfManager_playerConfWatcher, "f").removeAllListeners();
            await __classPrivateFieldGet(this, _ConfManager_playerConfWatcher, "f").close();
            __classPrivateFieldSet(this, _ConfManager_playerConfWatcher, null, "f");
        }
        await __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_removeNoPeppyConf).call(this);
        __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_updateVolumioSharedVars).call(this, true);
    }
    getAlsaDevices() {
        return {
            fullPipeline: FULL_PIPELINE_ALSA_DEVICE,
            peppyBypass: __classPrivateFieldGet(this, _ConfManager_peppyBypassStatus, "f"),
            peppyOnly: PEPPY_FIFO_ALSA_DEVICE
        };
    }
    getMpdConfStatus() {
        return __classPrivateFieldGet(this, _ConfManager_mpdConfStatus, "f");
    }
}
exports.default = ConfManager;
_ConfManager_playerConfChangeDelayTimer = new WeakMap(), _ConfManager_peppyBypassStatus = new WeakMap(), _ConfManager_mpdConfStatus = new WeakMap(), _ConfManager_playerConfWatcher = new WeakMap(), _ConfManager_isHandlingPlayerConfChange = new WeakMap(), _ConfManager_instances = new WeakSet(), _ConfManager_init = function _ConfManager_init() {
    __classPrivateFieldSet(this, _ConfManager_playerConfWatcher, chokidar_1.default.watch(Constants_1.MPD_CONF_FILE), "f");
    __classPrivateFieldGet(this, _ConfManager_playerConfWatcher, "f").on('add', __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_handlePlayerConfWatcherEvent).bind(this));
    __classPrivateFieldGet(this, _ConfManager_playerConfWatcher, "f").on('change', __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_handlePlayerConfWatcherEvent).bind(this));
}, _ConfManager_handlePlayerConfWatcherEvent = function _ConfManager_handlePlayerConfWatcherEvent(_path) {
    if (!__classPrivateFieldGet(this, _ConfManager_isHandlingPlayerConfChange, "f") && path_1.default.basename(_path) === path_1.default.basename(Constants_1.MPD_CONF_FILE)) {
        // Guard against multiple events within a short interval.
        // We set a delay timer to avoid multiple executions.
        __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_clearPlayerConfigChangeDelayTimer).call(this);
        __classPrivateFieldSet(this, _ConfManager_playerConfChangeDelayTimer, setTimeout(async () => {
            __classPrivateFieldSet(this, _ConfManager_isHandlingPlayerConfChange, true, "f");
            await __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_handlePlayerConfChange).call(this);
            __classPrivateFieldSet(this, _ConfManager_isHandlingPlayerConfChange, false, "f");
        }, 1500), "f");
    }
}, _ConfManager_clearPlayerConfigChangeDelayTimer = function _ConfManager_clearPlayerConfigChangeDelayTimer() {
    if (__classPrivateFieldGet(this, _ConfManager_playerConfChangeDelayTimer, "f")) {
        clearTimeout(__classPrivateFieldGet(this, _ConfManager_playerConfChangeDelayTimer, "f"));
        __classPrivateFieldSet(this, _ConfManager_playerConfChangeDelayTimer, null, "f");
    }
}, _ConfManager_handlePlayerConfChange = async function _ConfManager_handlePlayerConfChange() {
    await __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_updateNoPeppyConf).call(this);
    await __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_updateMPDConf).call(this);
    __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_updateVolumioSharedVars).call(this);
}, _ConfManager_removeNoPeppyConf = async function _ConfManager_removeNoPeppyConf() {
    if ((0, System_1.fileExists)(PEPPY_BYPASS_CONF_FILE)) {
        try {
            await (0, System_1.execCommand)(`/bin/rm ${PEPPY_BYPASS_CONF_FILE}`, true);
            await __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_reloadAlsaConf).call(this);
        }
        catch (error) {
            PeppyAlsaPipeContext_1.default.getLogger().error(`[peppy_alsa_pipe] Failed to remove "${PEPPY_BYPASS_CONF_FILE}"`);
        }
    }
}, _ConfManager_updateNoPeppyConf = async function _ConfManager_updateNoPeppyConf() {
    const alsaController = PeppyAlsaPipeContext_1.default.getAlsaController();
    const contribs = (await (0, Misc_1.kewToJSPromise)(alsaController.getPluginALSAContributions()))
        .filter((c) => c.pluginName !== 'peppy_alsa_pipe');
    const compatPlugin = contribs.find(({ pluginName }) => PEPPY_COMPAT_PLUGINS.includes(pluginName));
    if (compatPlugin) {
        __classPrivateFieldSet(this, _ConfManager_peppyBypassStatus, {
            available: false,
            reason: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_BYPASS_COMPAT_PLUGIN', compatPlugin.pluginName)
        }, "f");
        await __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_removeNoPeppyConf).call(this);
        return;
    }
    const snippets = await Promise.all(contribs.map(async (contrib) => {
        if (contrib.configFile) {
            try {
                const contents = await (0, promises_1.readFile)(contrib.configFile, { encoding: 'utf-8' });
                return {
                    inPCM: contrib.inPCM,
                    outPCM: contrib.outPCM,
                    contents
                };
            }
            catch (error) {
                return null;
            }
        }
        return null;
    }));
    let outPCM = PEPPY_BYPASS_ALSA_DEVICE;
    const confParts = [];
    for (const snippet of snippets) {
        if (snippet) {
            confParts.push(`
          pcm.${outPCM} {
            type empty
            slave.pcm "${snippet.inPCM}"
          }

          ${snippet.contents}
        `);
            outPCM = snippet.outPCM;
        }
    }
    confParts.push(`
      pcm.${outPCM} {
        type empty
        slave.pcm "volumioOutput"
      }
    `);
    // ALSA ctl - for players like Squeezelite which requires it for Hardware mixer
    const outputDevice = alsaController.getConfigParam('outputdevice');
    const card = outputDevice.indexOf(',') >= 0 ? outputDevice.charAt(0) : outputDevice;
    confParts.push(`
      ctl.${PEPPY_BYPASS_ALSA_DEVICE} {
        type hw
        card ${card}
      }  
    `);
    let noPeppyConf = confParts.join(os_1.EOL);
    // Find and modify all defined PCM names
    const pcmNameRegex = /(pcm|pcm_slave)\.(.+) {/gm;
    const pcmNameMatches = noPeppyConf.matchAll(pcmNameRegex);
    const pcmNames = [];
    for (const p of pcmNameMatches) {
        pcmNames.push(p[2]);
    }
    noPeppyConf = noPeppyConf
        .replace(pcmNameRegex, '$1.$2_noPeppy {')
        .replace(`${PEPPY_BYPASS_ALSA_DEVICE}_noPeppy`, PEPPY_BYPASS_ALSA_DEVICE);
    // Modify slave references
    const slaveNameRegex = /(pcm|slave)(?!\.) +(.+)/;
    const modifiedConfLines = [];
    for (const line of noPeppyConf.split(os_1.EOL)) {
        let slaveName = line.match(slaveNameRegex)?.[2];
        if (slaveName && slaveName.startsWith('"') && slaveName.endsWith('"')) {
            slaveName = slaveName.substring(1, slaveName.length - 1);
        }
        if (slaveName && slaveName !== PEPPY_BYPASS_ALSA_DEVICE &&
            slaveName !== 'volumioOutput' && pcmNames.indexOf(slaveName) >= 0) {
            modifiedConfLines.push(line.replace(slaveNameRegex, `$1 "${slaveName}_noPeppy"`));
        }
        else {
            modifiedConfLines.push(line);
        }
    }
    // Finalize noPeppyConf
    noPeppyConf = modifiedConfLines.join(os_1.EOL) + os_1.EOL;
    try {
        await (0, promises_1.writeFile)(PEPPY_BYPASS_CONF_TMP_FILE, noPeppyConf);
        await (0, System_1.execCommand)(`/bin/mv ${PEPPY_BYPASS_CONF_TMP_FILE} ${PEPPY_BYPASS_CONF_FILE}`, true);
        await __classPrivateFieldGet(this, _ConfManager_instances, "m", _ConfManager_reloadAlsaConf).call(this);
    }
    catch (error) {
        PeppyAlsaPipeContext_1.default.getLogger().error(PeppyAlsaPipeContext_1.default.getErrorMessage(`[peppy_alsa_pipe] Failed to update "${PEPPY_BYPASS_CONF_FILE}":`, error));
        PeppyAlsaPipeContext_1.default.toast('error', PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_ERR_UPDATE_ALSA_CONF'));
        __classPrivateFieldSet(this, _ConfManager_peppyBypassStatus, {
            available: false,
            reason: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_CONF_UPDATE_ERR', PEPPY_BYPASS_CONF_FILE)
        }, "f");
        return;
    }
    __classPrivateFieldSet(this, _ConfManager_peppyBypassStatus, {
        available: true,
        alsaDevice: PEPPY_BYPASS_ALSA_DEVICE
    }, "f");
    PeppyAlsaPipeContext_1.default.toast('success', PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_ALSA_CONF_UPDATED'));
}, _ConfManager_reloadAlsaConf = function _ConfManager_reloadAlsaConf() {
    return (0, System_1.execCommand)('/usr/sbin/alsactl -L -R nrestore', true);
}, _ConfManager_updateMPDConf = async function _ConfManager_updateMPDConf() {
    if (PeppyAlsaPipeContext_1.default.getConfigValue('mpdConfModify') === 'none') {
        __classPrivateFieldSet(this, _ConfManager_mpdConfStatus, {
            modified: false,
            reason: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_NO_MOD_BY_SETTING')
        }, "f");
        return;
    }
    if (!__classPrivateFieldGet(this, _ConfManager_peppyBypassStatus, "f").available) {
        __classPrivateFieldSet(this, _ConfManager_mpdConfStatus, {
            modified: false,
            reason: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_BYPASS_UNAVAILABLE')
        }, "f");
        return;
    }
    try {
        await (0, System_1.execCommand)(`/usr/bin/sudo /bin/chmod 777 ${Constants_1.MPD_CONF_FILE}`, true);
        const conf = await (0, promises_1.readFile)(Constants_1.MPD_CONF_FILE, { encoding: 'utf-8' });
        const volumioAudioOutputRegex = new RegExp(`(^(?!#).?audio_output.*?{.+?type.*?)("${FULL_PIPELINE_ALSA_DEVICE}")(.*?})`, 'gms');
        const injectPeppyAudioOutput = `
        audio_output {
          type      "alsa"
          name      "${PEPPY_FIFO_ALSA_DEVICE}"
          device    "peppy_fifo"
          format    "44100:16:2"
        }
      `;
        const newConf = conf.replace(volumioAudioOutputRegex, `$1"${PEPPY_BYPASS_ALSA_DEVICE}"$3
        ${injectPeppyAudioOutput}
      `);
        await (0, promises_1.writeFile)(Constants_1.MPD_CONF_FILE, newConf);
    }
    catch (error) {
        PeppyAlsaPipeContext_1.default.getLogger().error(PeppyAlsaPipeContext_1.default.getErrorMessage(`[peppy_alsa_pipe] Failed to update "${Constants_1.MPD_CONF_FILE}"`, error));
        PeppyAlsaPipeContext_1.default.toast('error', PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_ERR_UPDATE_MPD_CONF'));
        __classPrivateFieldSet(this, _ConfManager_mpdConfStatus, {
            modified: false,
            reason: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_CONF_UPDATE_ERR', Constants_1.MPD_CONF_FILE)
        }, "f");
        return;
    }
    __classPrivateFieldSet(this, _ConfManager_mpdConfStatus, {
        modified: true,
        description: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_MPD_CONF_BYPASS', PEPPY_BYPASS_ALSA_DEVICE, PEPPY_FIFO_ALSA_DEVICE)
    }, "f");
    PeppyAlsaPipeContext_1.default.toast('success', PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_MPD_CONF_UPDATED'));
    PeppyAlsaPipeContext_1.default.getMpdPlugin().restartMpd();
}, _ConfManager_updateVolumioSharedVars = function _ConfManager_updateVolumioSharedVars(destroy = false) {
    let exports = null;
    if (!destroy) {
        const alsaDevices = this.getAlsaDevices();
        let bypass;
        if (alsaDevices.peppyBypass.available) {
            bypass = alsaDevices.peppyBypass.alsaDevice;
        }
        else {
            bypass = null;
        }
        exports = {
            fifoPaths: {
                meter: Constants_1.FIFO_PATH.METER,
                spectrum: Constants_1.FIFO_PATH.SPECTRUM
            },
            alsaDevices: {
                fullPipeline: alsaDevices.fullPipeline,
                peppyBypass: bypass,
                peppyOnly: alsaDevices.peppyOnly
            }
        };
    }
    /**
     * Do not call `delete(key)` on sharedVars even if destroy=true, otherwise ALL callbacks registered
     * under the key will get deleted as well!
     */
    PeppyAlsaPipeContext_1.default.getVolumioSharedVars().set(Constants_1.EXPORTS_SHARED_VAR_KEY, JSON.stringify(exports));
};
//# sourceMappingURL=ConfManager.js.map