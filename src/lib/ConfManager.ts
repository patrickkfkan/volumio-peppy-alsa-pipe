import { readFile, writeFile } from 'fs/promises';
import pap from './PeppyAlsaPipeContext';
import { kewToJSPromise } from './util/Misc';
import { EOL } from 'os';
import { execCommand, fileExists } from './util/System';
import chokidar from 'chokidar';
import path from 'path';
import { EXPORTS_SHARED_VAR_KEY, FIFO_PATH, MPD_CONF_FILE } from './util/Constants';

/**
 * Defines 'volumioNoPeppy' ALSA output that passes streams through the
 * same ALSA pipeline but without peppyalsa.
 */
const PEPPY_BYPASS_CONF_FILE = '/etc/alsa/conf.d/90-volumio-no-peppy.conf';
const PEPPY_BYPASS_CONF_TMP_FILE = '/tmp/peppy_alsa_pipe_no_peppy.conf';

interface AlsaSnippet {
  inPCM: string;
  outPCM: string;
  contents: string;
}

interface AlsaContribution extends AlsaSnippet {
  pluginName: string;
  configFile: string;
}


export type PeppyBypassStatus = {
  available: true,
  alsaDevice: string
} | {
  available: false,
  reason: string
};

export type MPDConfStatus = {
  modified: true,
  description: string
} | {
  modified: false,
  reason: string
};

export interface PeppyAlsaPipeExports {
  fifoPaths: {
    meter: string;
    spectrum: string;
  },
  alsaDevices: {
    fullPipeline: string;
    peppyBypass: string | null;
    peppyOnly: string;
  }
}

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

export default class ConfManager {

  #playerConfChangeDelayTimer: NodeJS.Timeout | null;
  #peppyBypassStatus: PeppyBypassStatus;
  #mpdConfStatus: MPDConfStatus;
  #playerConfWatcher: ReturnType<typeof chokidar['watch']> | null;
  #isHandlingPlayerConfChange: boolean;

  constructor() {
    this.#peppyBypassStatus = {
      available: false,
      reason: pap.getI18n('PEPPY_ALSA_PIPE_NOT_READY')
    };
    this.#mpdConfStatus = {
      modified: false,
      reason: pap.getI18n('PEPPY_ALSA_PIPE_NOT_READY')
    };
    this.#playerConfWatcher = null;
    this.#isHandlingPlayerConfChange = false;
    this.#init();
  }

  #init() {
    this.#playerConfWatcher = chokidar.watch(MPD_CONF_FILE);
    this.#playerConfWatcher.on('add', this.#handlePlayerConfWatcherEvent.bind(this));
    this.#playerConfWatcher.on('change', this.#handlePlayerConfWatcherEvent.bind(this));
  }

  #handlePlayerConfWatcherEvent(_path: string) {
    if (!this.#isHandlingPlayerConfChange && path.basename(_path) === path.basename(MPD_CONF_FILE)) {
      // Guard against multiple events within a short interval.
      // We set a delay timer to avoid multiple executions.
      this.#clearPlayerConfigChangeDelayTimer();
      this.#playerConfChangeDelayTimer = setTimeout(async () => {
        this.#isHandlingPlayerConfChange = true;
        await this.#handlePlayerConfChange();
        this.#isHandlingPlayerConfChange = false;
      }, 1500);
    }
  }

  #clearPlayerConfigChangeDelayTimer() {
    if (this.#playerConfChangeDelayTimer) {
      clearTimeout(this.#playerConfChangeDelayTimer);
      this.#playerConfChangeDelayTimer = null;
    }
  }

  async #handlePlayerConfChange() {
    await this.#updateNoPeppyConf();
    await this.#updateMPDConf();
    this.#updateVolumioSharedVars();
  }

  async #removeNoPeppyConf() {
    if (fileExists(PEPPY_BYPASS_CONF_FILE)) {
      try {
        await execCommand(`/bin/rm ${PEPPY_BYPASS_CONF_FILE}`, true);
        await this.#reloadAlsaConf();
      }
      catch (error) {
        pap.getLogger().error(`[peppy_alsa_pipe] Failed to remove "${PEPPY_BYPASS_CONF_FILE}"`);
      }
    }
  }

  async #updateNoPeppyConf() {
    const alsaController = pap.getAlsaController();

    const contribs = (await kewToJSPromise(alsaController.getPluginALSAContributions()) as AlsaContribution[])
      .filter((c) => c.pluginName !== 'peppy_alsa_pipe');

    const compatPlugin = contribs.find(({pluginName}) => PEPPY_COMPAT_PLUGINS.includes(pluginName));
    if (compatPlugin) {
      this.#peppyBypassStatus = {
        available: false,
        reason: pap.getI18n('PEPPY_ALSA_PIPE_BYPASS_COMPAT_PLUGIN', compatPlugin.pluginName)
      };
      await this.#removeNoPeppyConf();
      return;
    }

    const snippets: Array<AlsaSnippet | null> = await Promise.all(contribs.map(async (contrib) => {
      if (contrib.configFile) {
        try {
          const contents = await readFile(contrib.configFile, { encoding: 'utf-8'});
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
    let hasSoftVolume = false;
    const confParts: string[] = [];
    for (const snippet of snippets) {
      if (snippet) {
        confParts.push(`
          pcm.${outPCM} {
            type empty
            slave.pcm "${snippet.inPCM}"
          }

        `);

        /**
         * Break if we encounter 'softvolume'. This should be the last
         * PCM in the pipeline before 'volumioOutput'. Volumio creates
         * 'SoftMaster' control under 'softvolume' and uses it for software
         * volume - we need to preserve this.
         */
        if (snippet.inPCM === 'softvolume') {
          hasSoftVolume = true;
          break;
        }

        confParts.push(snippet.contents);

        outPCM = snippet.outPCM;
      }
    }
    if (!hasSoftVolume) {
      confParts.push(`
        pcm.${outPCM} {
          type empty
          slave.pcm "volumioOutput"
        }
      `);
    }

    // ALSA ctl - for players like Squeezelite which requires it for Hardware mixer
    const outputDevice = alsaController.getConfigParam('outputdevice');
    const card = outputDevice.indexOf(',') >= 0 ? outputDevice.charAt(0) : outputDevice;
    confParts.push(`
      ctl.${PEPPY_BYPASS_ALSA_DEVICE} {
        type hw
        card ${card}
      }  
    `);

    let noPeppyConf = confParts.join(EOL);

    // Find and modify all defined PCM names
    const pcmNameRegex = /(pcm|pcm_slave)\.(.+) {/gm;
    const pcmNameMatches = noPeppyConf.matchAll(pcmNameRegex);
    const pcmNames: string[] = [];
    for (const p of pcmNameMatches) {
      pcmNames.push(p[2]);
    }
    noPeppyConf = noPeppyConf
      .replace(pcmNameRegex, '$1.$2_noPeppy {')
      .replace(`${PEPPY_BYPASS_ALSA_DEVICE}_noPeppy`, PEPPY_BYPASS_ALSA_DEVICE);

    if (hasSoftVolume) {
      noPeppyConf = noPeppyConf.replace('softvolume_noPeppy', 'softvolume');
    }

    // Modify slave references
    const slaveNameRegex = /(pcm|slave)(?!\.) +(.+)/;
    const modifiedConfLines: string[] = [];
    for (const line of noPeppyConf.split(EOL)) {
      let slaveName = line.match(slaveNameRegex)?.[2];
      if (slaveName && slaveName.startsWith('"') && slaveName.endsWith('"')) {
        slaveName = slaveName.substring(1, slaveName.length - 1);
      }
      if (slaveName && slaveName !== PEPPY_BYPASS_ALSA_DEVICE &&
        slaveName !== 'softvolume' &&
        slaveName !== 'volumioOutput' && pcmNames.indexOf(slaveName) >= 0) {

        modifiedConfLines.push(line.replace(slaveNameRegex, `$1 "${slaveName}_noPeppy"`));
      }
      else {
        modifiedConfLines.push(line);
      }
    }

    // Finalize noPeppyConf
    noPeppyConf = modifiedConfLines.join(EOL) + EOL;

    try {
      await writeFile(PEPPY_BYPASS_CONF_TMP_FILE, noPeppyConf);
      await execCommand(`/bin/mv ${PEPPY_BYPASS_CONF_TMP_FILE} ${PEPPY_BYPASS_CONF_FILE}`, true);
      await this.#reloadAlsaConf();
    }
    catch (error) {
      pap.getLogger().error(
        pap.getErrorMessage(`[peppy_alsa_pipe] Failed to update "${PEPPY_BYPASS_CONF_FILE}":`, error));
      pap.toast('error', pap.getI18n('PEPPY_ALSA_PIPE_ERR_UPDATE_ALSA_CONF'));
      this.#peppyBypassStatus = {
        available: false,
        reason: pap.getI18n('PEPPY_ALSA_PIPE_CONF_UPDATE_ERR', PEPPY_BYPASS_CONF_FILE)
      };
      return;
    }

    this.#peppyBypassStatus = {
      available: true,
      alsaDevice: PEPPY_BYPASS_ALSA_DEVICE
    };

    pap.toast('success', pap.getI18n('PEPPY_ALSA_PIPE_ALSA_CONF_UPDATED'));
  }

  #reloadAlsaConf() {
    return execCommand('/usr/sbin/alsactl -L -R nrestore', true);
  }

  async #updateMPDConf() {
    if (pap.getConfigValue('mpdConfModify') === 'none') {
      this.#mpdConfStatus = {
        modified: false,
        reason: pap.getI18n('PEPPY_ALSA_PIPE_NO_MOD_BY_SETTING')
      };
      return;
    }
    if (!this.#peppyBypassStatus.available) {
      this.#mpdConfStatus = {
        modified: false,
        reason: pap.getI18n('PEPPY_ALSA_PIPE_BYPASS_UNAVAILABLE')
      };
      return;
    }
    try {
      await execCommand(`/usr/bin/sudo /bin/chmod 777 ${MPD_CONF_FILE}`, true);
      const conf = await readFile(MPD_CONF_FILE, { encoding: 'utf-8' });
      const volumioAudioOutputRegex = new RegExp(`(^(?!#).?audio_output.*?{.+?type.*?)("${FULL_PIPELINE_ALSA_DEVICE}")(.*?})`, 'gms');
      const injectPeppyAudioOutput = `
        audio_output {
          type      "alsa"
          name      "${PEPPY_FIFO_ALSA_DEVICE}"
          device    "peppy_fifo"
          format    "44100:16:2"
        }
      `;
      const newConf = conf.replace(volumioAudioOutputRegex,
        `$1"${PEPPY_BYPASS_ALSA_DEVICE}"$3
        ${injectPeppyAudioOutput}
      `);

      await writeFile(MPD_CONF_FILE, newConf);
    }
    catch (error) {
      pap.getLogger().error(
        pap.getErrorMessage(`[peppy_alsa_pipe] Failed to update "${MPD_CONF_FILE}"`, error));
      pap.toast('error', pap.getI18n('PEPPY_ALSA_PIPE_ERR_UPDATE_MPD_CONF'));
      this.#mpdConfStatus = {
        modified: false,
        reason: pap.getI18n('PEPPY_ALSA_PIPE_CONF_UPDATE_ERR', MPD_CONF_FILE)
      };
      return;
    }

    this.#mpdConfStatus = {
      modified: true,
      description: pap.getI18n('PEPPY_ALSA_PIPE_MPD_CONF_BYPASS', PEPPY_BYPASS_ALSA_DEVICE, PEPPY_FIFO_ALSA_DEVICE)
    };

    pap.toast('success', pap.getI18n('PEPPY_ALSA_PIPE_MPD_CONF_UPDATED'));
    pap.getMpdPlugin().restartMpd();
  }

  async destroy() {
    this.#clearPlayerConfigChangeDelayTimer();
    if (this.#playerConfWatcher) {
      this.#playerConfWatcher.removeAllListeners();
      await this.#playerConfWatcher.close();
      this.#playerConfWatcher = null;
    }
    await this.#removeNoPeppyConf();
    this.#updateVolumioSharedVars(true);
  }

  getAlsaDevices() {
    return {
      fullPipeline: FULL_PIPELINE_ALSA_DEVICE,
      peppyBypass: this.#peppyBypassStatus,
      peppyOnly: PEPPY_FIFO_ALSA_DEVICE
    };
  }

  getMpdConfStatus() {
    return this.#mpdConfStatus;
  }

  #updateVolumioSharedVars(destroy = false) {
    let exports: PeppyAlsaPipeExports | null = null;

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
          meter: FIFO_PATH.METER,
          spectrum: FIFO_PATH.SPECTRUM
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
    pap.getVolumioSharedVars().set(EXPORTS_SHARED_VAR_KEY, JSON.stringify(exports));
  }
}
