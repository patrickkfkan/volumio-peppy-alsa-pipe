// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import libQ from 'kew';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import vconf from 'v-conf';

import pap from './lib/PeppyAlsaPipeContext';
import { jsPromiseToKew, kewToJSPromise } from './lib/util/Misc';
import { execCommand, mkfifo } from './lib/util/System';
import { FIFO_PATH, MPD_CONF_FILE } from './lib/util/Constants';
import ConfManager from './lib/ConfManager';
import UIConfigHelper from './lib/config/UIConfigHelper';

class ControllerPeppyAlsaPipe {

  #context: any;
  #config: any;
  #commandRouter: any;
  #confManager: ConfManager | null;

  constructor(context: any) {
    this.#context = context;
    this.#commandRouter = this.#context.coreCommand;
    this.#confManager = null;
  }

  getUIConfig() {
    return jsPromiseToKew(this.#doGetUIConfig())
      .fail((error: any) => {
        pap.getLogger().error(`[peppy_alsa_pipe] getUIConfig(): Cannot populate configuration - ${error}`);
        throw error;
      });
  }

  async #doGetUIConfig() {
    const langCode = this.#commandRouter.sharedVars.get('language_code');
    const _uiconf = await kewToJSPromise(this.#commandRouter.i18nJson(
      `${__dirname}/i18n/strings_${langCode}.json`,
      `${__dirname}/i18n/strings_en.json`,
      `${__dirname}/UIConfig.json`));
    const uiconf = UIConfigHelper.observe(_uiconf);

    const mpdConfUIConf = uiconf.section_mpd_conf;

    const mpdConfModify = pap.getConfigValue('mpdConfModify');
    let mpdConfModifyLabel: string;
    switch (mpdConfModify) {
      case 'peppyBypass':
        mpdConfModifyLabel = pap.getI18n('PEPPY_ALSA_PIPE_MODIFY_BYPASS');
        break;
      case 'none':
        mpdConfModifyLabel = pap.getI18n('PEPPY_ALSA_PIPE_MODIFY_NONE');
        break;
    }
    mpdConfUIConf.content.modify.value = {
      value: mpdConfModify,
      label: mpdConfModifyLabel
    };

    return uiconf;
  }

  getConfigurationFiles() {
    return [ 'config.json' ];
  }

  /**
   * Plugin lifecycle
   */

  onVolumioStart() {
    const configFile = this.#commandRouter.pluginManager.getConfigurationFile(this.#context, 'config.json');
    this.#config = new vconf();
    this.#config.loadFile(configFile);
    return libQ.resolve(true);
  }

  onStart() {
    return jsPromiseToKew<void>((async () => {
      pap.init(this.#context, this.#config);
      this.#confManager = new ConfManager();
      await execCommand('/sbin/modprobe snd-dummy pcm_substreams=1', true);
      await mkfifo(FIFO_PATH.METER);
      await mkfifo(FIFO_PATH.SPECTRUM);
    })());
  }

  onStop() {
    return jsPromiseToKew<void>((async () => {

      if (this.#confManager) {
        await this.#confManager.destroy();
        this.#confManager = null;
      }
      try {
        await execCommand(`/bin/rm ${FIFO_PATH.METER}`, true);
        await execCommand(`/bin/rm ${FIFO_PATH.SPECTRUM}`, true);
      }
      catch (error) {
        // Do nothing
      }
      pap.reset();
    })());
  }

  showStatus() {
    const status = this.getStatus();
    if (!status) {
      pap.toast('error', pap.getI18n('PEPPY_ALSA_PIPE_STATUS_ERR'));
      return;
    }

    /**
     * FIFO paths
     */
    const fifoPathsSection = `
        <tr>
          <td colspan="2"><p><u>${pap.getI18n('PEPPY_ALSA_PIPE_FIFO_PATHS')}</u></p></td>
        </tr>
        <tr>
          <td>${pap.getI18n('PEPPY_ALSA_PIPE_METER')}</td>
          <td>${status.fifoPaths.meter}</td>
        </tr>
        <tr>
          <td>${pap.getI18n('PEPPY_ALSA_PIPE_SPECTRUM')}</td>
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
          <td colspan="2"></br></br><p><u>${pap.getI18n('PEPPY_ALSA_PIPE_ALSA_DEVICES')}</u></p></td>
        </tr>
        <tr>
          <td nowrap>${pap.getI18n('PEPPY_ALSA_PIPE_FULL_PIPELINE')}</td>
          <td>${status.alsaDevices.fullPipeline}</td>
        </tr>
        <tr>
          <td nowrap>
          ${
  hasPeppyBypass ?
    pap.getI18n('PEPPY_ALSA_PIPE_BYPASS', sups.peppyBypass)
    :
    pap.getI18n('PEPPY_ALSA_PIPE_BYPASS_NOSUP')
}
          </td>
          <td>
          ${
  hasPeppyBypass ?
    status.alsaDevices.peppyBypass.alsaDevice
    :
    pap.getI18n('PEPPY_ALSA_PIPE_NA_DESC', status.alsaDevices.peppyBypass.reason)
}
          </td>
        </tr>
        <tr>
          <td nowrap>${pap.getI18n('PEPPY_ALSA_PIPE_PEPPY_ONLY', sups.peppyOnly)}</td>
          <td>${status.alsaDevices.peppyOnly}</td>
        </tr>

    `;
    if (hasPeppyBypass) {
      alsaDevicesSection += `
        <tr>
          <td colspan="2"></br><small>
            ${pap.getI18n('PEPPY_ALSA_PIPE_BYPASS_TIP', sups.peppyBypass, status.alsaDevices.peppyBypass.alsaDevice)}
            </small></td>
        </tr>
      `;
    }
    alsaDevicesSection += `
      <tr>
        <td colspan="2"></br><small>
          ${pap.getI18n('PEPPY_ALSA_PIPE_PEPPY_ONLY_TIP', sups.peppyOnly, status.alsaDevices.peppyOnly)}
        </small></td>
      </tr>
    `;

    /**
     * MPD conf
     */
    let mpdConfSection = `
        <tr>
          <td colspan="2"></br></br><p><u>${pap.getI18n('PEPPY_ALSA_PIPE_MPD_CONF')}</u></p></td>
        </tr>
        <tr>
          <td nowrap>${pap.getI18n('PEPPY_ALSA_PIPE_MODIFIED')}</td>
    `;
    if (status.mpdConf.modified) {
      mpdConfSection += `
          <td>${pap.getI18n('PEPPY_ALSA_PIPE_YES_DESC', status.mpdConf.description)}</td>
      `;
    }
    else {
      mpdConfSection += `
          <td>${pap.getI18n('PEPPY_ALSA_PIPE_NO_DESC', status.mpdConf.reason)}</td>
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
      title: pap.getI18n('PEPPY_ALSA_PIPE'),
      message: html,
      size: 'lg',
      buttons: [ {
        name: pap.getI18n('PEPPY_ALSA_PIPE_CLOSE'),
        class: 'btn btn-warning',
        emit: 'closeModals',
        payload: ''
      } ]
    };

    this.#commandRouter.broadcastMessage('openModal', modalData);
  }

  configSaveMPDConfSettings(data: Record<string, any>) {
    const modify = data.modify.value;
    const oldModify = pap.getConfigValue('mpdConfModify');
    if (modify !== oldModify) {
      pap.setConfigValue('mpdConfModify', modify);
      pap.toast('success', pap.getI18n('PEPPY_ALSA_PIPE_SETTINGS_SAVED'));
      pap.getMpdPlugin().createMPDFile((error: any) => {
        if (error) {
          pap.getLogger().error(
            pap.getErrorMessage(`[peppy_alsa_pipe] Failed to update "${MPD_CONF_FILE}"`, error));
          pap.toast('error', pap.getI18n('PEPPY_ALSA_PIPE_ERR_UPDATE_MPD_CONF'));
        }
      });
    }
  }

  getStatus() {
    if (!this.#confManager) {
      return null;
    }

    return {
      fifoPaths: {
        meter: FIFO_PATH.METER,
        spectrum: FIFO_PATH.SPECTRUM
      },
      alsaDevices: this.#confManager.getAlsaDevices(),
      mpdConf: this.#confManager.getMpdConfStatus()
    };
  }
}

export = ControllerPeppyAlsaPipe;
