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
var _ControllerPeppyAlsaPipe_instances, _ControllerPeppyAlsaPipe_context, _ControllerPeppyAlsaPipe_config, _ControllerPeppyAlsaPipe_commandRouter, _ControllerPeppyAlsaPipe_confManager, _ControllerPeppyAlsaPipe_doGetUIConfig;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const kew_1 = __importDefault(require("kew"));
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const v_conf_1 = __importDefault(require("v-conf"));
const PeppyAlsaPipeContext_1 = __importDefault(require("./lib/PeppyAlsaPipeContext"));
const Misc_1 = require("./lib/util/Misc");
const System_1 = require("./lib/util/System");
const Constants_1 = require("./lib/util/Constants");
const ConfManager_1 = __importDefault(require("./lib/ConfManager"));
const UIConfigHelper_1 = __importDefault(require("./lib/config/UIConfigHelper"));
class ControllerPeppyAlsaPipe {
    constructor(context) {
        _ControllerPeppyAlsaPipe_instances.add(this);
        _ControllerPeppyAlsaPipe_context.set(this, void 0);
        _ControllerPeppyAlsaPipe_config.set(this, void 0);
        _ControllerPeppyAlsaPipe_commandRouter.set(this, void 0);
        _ControllerPeppyAlsaPipe_confManager.set(this, void 0);
        __classPrivateFieldSet(this, _ControllerPeppyAlsaPipe_context, context, "f");
        __classPrivateFieldSet(this, _ControllerPeppyAlsaPipe_commandRouter, __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_context, "f").coreCommand, "f");
        __classPrivateFieldSet(this, _ControllerPeppyAlsaPipe_confManager, null, "f");
    }
    getUIConfig() {
        return (0, Misc_1.jsPromiseToKew)(__classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_instances, "m", _ControllerPeppyAlsaPipe_doGetUIConfig).call(this))
            .fail((error) => {
            PeppyAlsaPipeContext_1.default.getLogger().error(`[peppy_alsa_pipe] getUIConfig(): Cannot populate configuration - ${error}`);
            throw error;
        });
    }
    getConfigurationFiles() {
        return ['config.json'];
    }
    /**
     * Plugin lifecycle
     */
    onVolumioStart() {
        const configFile = __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_commandRouter, "f").pluginManager.getConfigurationFile(__classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_context, "f"), 'config.json');
        __classPrivateFieldSet(this, _ControllerPeppyAlsaPipe_config, new v_conf_1.default(), "f");
        __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_config, "f").loadFile(configFile);
        return kew_1.default.resolve(true);
    }
    onStart() {
        return (0, Misc_1.jsPromiseToKew)((async () => {
            PeppyAlsaPipeContext_1.default.init(__classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_context, "f"), __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_config, "f"));
            __classPrivateFieldSet(this, _ControllerPeppyAlsaPipe_confManager, new ConfManager_1.default(), "f");
            await (0, System_1.execCommand)('/sbin/modprobe snd-dummy pcm_substreams=1', true);
            await (0, System_1.mkfifo)(Constants_1.FIFO_PATH.METER);
            await (0, System_1.mkfifo)(Constants_1.FIFO_PATH.SPECTRUM);
        })());
    }
    onStop() {
        return (0, Misc_1.jsPromiseToKew)((async () => {
            if (__classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_confManager, "f")) {
                await __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_confManager, "f").destroy();
                __classPrivateFieldSet(this, _ControllerPeppyAlsaPipe_confManager, null, "f");
            }
            try {
                await (0, System_1.execCommand)(`/bin/rm ${Constants_1.FIFO_PATH.METER}`, true);
                await (0, System_1.execCommand)(`/bin/rm ${Constants_1.FIFO_PATH.SPECTRUM}`, true);
            }
            catch (error) {
                // Do nothing
            }
            PeppyAlsaPipeContext_1.default.reset();
        })());
    }
    showStatus() {
        const status = this.getStatus();
        if (!status) {
            PeppyAlsaPipeContext_1.default.toast('error', PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_STATUS_ERR'));
            return;
        }
        /**
         * FIFO paths
         */
        const fifoPathsSection = `
        <tr>
          <td colspan="2"><p><u>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_FIFO_PATHS')}</u></p></td>
        </tr>
        <tr>
          <td>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_METER')}</td>
          <td>${status.fifoPaths.meter}</td>
        </tr>
        <tr>
          <td>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_SPECTRUM')}</td>
          <td>${status.fifoPaths.spectrum}</td>
        </tr>
    `;
        /**
         * Peppy Bypass
         */
        const hasPeppyBypass = status.alsaDevices.peppyBypass.available;
        const sups = {
            peppyBypass: 1,
            peppyOnly: !hasPeppyBypass ? 1 : 2
        };
        let alsaDevicesSection = `
        <tr>
          <td colspan="2"></br></br><p><u>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_ALSA_DEVICES')}</u></p></td>
        </tr>
        <tr>
          <td nowrap>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_FULL_PIPELINE')}</td>
          <td>${status.alsaDevices.fullPipeline}</td>
        </tr>
        <tr>
          <td nowrap>
          ${hasPeppyBypass ?
            PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_BYPASS', sups.peppyBypass)
            :
                PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_BYPASS_NOSUP')}
          </td>
          <td>
          ${hasPeppyBypass ?
            status.alsaDevices.peppyBypass.alsaDevice
            :
                PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_NA_DESC', status.alsaDevices.peppyBypass.reason)}
          </td>
        </tr>
        <tr>
          <td nowrap>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_PEPPY_ONLY', sups.peppyOnly)}</td>
          <td>${status.alsaDevices.peppyOnly}</td>
        </tr>

    `;
        if (hasPeppyBypass) {
            alsaDevicesSection += `
        <tr>
          <td colspan="2"></br><small>
            ${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_BYPASS_TIP', sups.peppyBypass, status.alsaDevices.peppyBypass.alsaDevice)}
            </small></td>
        </tr>
      `;
        }
        alsaDevicesSection += `
      <tr>
        <td colspan="2"></br><small>
          ${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_PEPPY_ONLY_TIP', sups.peppyOnly, status.alsaDevices.peppyOnly)}
        </small></td>
      </tr>
    `;
        /**
         * MPD conf
         */
        let mpdConfSection = `
        <tr>
          <td colspan="2"></br></br><p><u>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_MPD_CONF')}</u></p></td>
        </tr>
        <tr>
          <td nowrap>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_MODIFIED')}</td>
    `;
        if (status.mpdConf.modified) {
            mpdConfSection += `
          <td>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_YES_DESC', status.mpdConf.description)}</td>
      `;
        }
        else {
            mpdConfSection += `
          <td>${PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_NO_DESC', status.mpdConf.reason)}</td>
      `;
        }
        mpdConfSection += `
        </tr>
    `;
        /**
         * Combine
         */
        const html = `
      <table>
      ${fifoPathsSection}
      ${alsaDevicesSection}
      ${mpdConfSection}
      </table>
    `;
        const modalData = {
            title: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE'),
            message: html,
            size: 'lg',
            buttons: [{
                    name: PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_CLOSE'),
                    class: 'btn btn-warning',
                    emit: 'closeModals',
                    payload: ''
                }]
        };
        __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_commandRouter, "f").broadcastMessage('openModal', modalData);
    }
    configSaveMPDConfSettings(data) {
        const modify = data.modify.value;
        const oldModify = PeppyAlsaPipeContext_1.default.getConfigValue('mpdConfModify');
        if (modify !== oldModify) {
            PeppyAlsaPipeContext_1.default.setConfigValue('mpdConfModify', modify);
            PeppyAlsaPipeContext_1.default.toast('success', PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_SETTINGS_SAVED'));
            PeppyAlsaPipeContext_1.default.getMpdPlugin().createMPDFile((error) => {
                if (error) {
                    PeppyAlsaPipeContext_1.default.getLogger().error(PeppyAlsaPipeContext_1.default.getErrorMessage(`[peppy_alsa_pipe] Failed to update "${Constants_1.MPD_CONF_FILE}"`, error));
                    PeppyAlsaPipeContext_1.default.toast('error', PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_ERR_UPDATE_MPD_CONF'));
                }
            });
        }
    }
    getStatus() {
        if (!__classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_confManager, "f")) {
            return null;
        }
        return {
            fifoPaths: {
                meter: Constants_1.FIFO_PATH.METER,
                spectrum: Constants_1.FIFO_PATH.SPECTRUM
            },
            alsaDevices: __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_confManager, "f").getAlsaDevices(),
            mpdConf: __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_confManager, "f").getMpdConfStatus()
        };
    }
}
_ControllerPeppyAlsaPipe_context = new WeakMap(), _ControllerPeppyAlsaPipe_config = new WeakMap(), _ControllerPeppyAlsaPipe_commandRouter = new WeakMap(), _ControllerPeppyAlsaPipe_confManager = new WeakMap(), _ControllerPeppyAlsaPipe_instances = new WeakSet(), _ControllerPeppyAlsaPipe_doGetUIConfig = async function _ControllerPeppyAlsaPipe_doGetUIConfig() {
    const langCode = __classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_commandRouter, "f").sharedVars.get('language_code');
    const _uiconf = await (0, Misc_1.kewToJSPromise)(__classPrivateFieldGet(this, _ControllerPeppyAlsaPipe_commandRouter, "f").i18nJson(`${__dirname}/i18n/strings_${langCode}.json`, `${__dirname}/i18n/strings_en.json`, `${__dirname}/UIConfig.json`));
    const uiconf = UIConfigHelper_1.default.observe(_uiconf);
    const mpdConfUIConf = uiconf.section_mpd_conf;
    const mpdConfModify = PeppyAlsaPipeContext_1.default.getConfigValue('mpdConfModify');
    let mpdConfModifyLabel;
    switch (mpdConfModify) {
        case 'peppyBypass':
            mpdConfModifyLabel = PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_MODIFY_BYPASS');
            break;
        case 'none':
            mpdConfModifyLabel = PeppyAlsaPipeContext_1.default.getI18n('PEPPY_ALSA_PIPE_MODIFY_NONE');
            break;
    }
    mpdConfUIConf.content.modify.value = {
        value: mpdConfModify,
        label: mpdConfModifyLabel
    };
    return uiconf;
};
module.exports = ControllerPeppyAlsaPipe;
//# sourceMappingURL=index.js.map