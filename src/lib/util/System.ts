import fs from 'fs';
import { exec } from 'child_process';
import pap from '../PeppyAlsaPipeContext';

export function execCommand(cmd: string, sudo = false, logError = true) {
  return new Promise<string>((resolve, reject) => {
    pap.getLogger().info(`[peppy_alsa_pipe] Executing ${cmd}`);
    exec(sudo ? `echo volumio | sudo -S ${cmd}` : cmd, { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
      if (error) {
        if (logError) {
          pap.getLogger().error(pap.getErrorMessage(`[peppy_alsa_pipe] Failed to execute ${cmd}: ${stderr.toString()}`, error));
        }
        reject(error);
      }
      else {
        resolve(stdout.toString());
      }
    });
  });
}

export async function mkfifo(path: string) {
  if (fs.existsSync(path) && !fs.lstatSync(path).isFIFO()) {
    await execCommand(`/bin/rm ${path}`, true);
  }
  if (!fs.existsSync(path)) {
    await execCommand(`/usr/bin/mkfifo ${path}`, true);
  }
  return execCommand(`/bin/chmod 0666 ${path}`, true);
}

export function fileExists(path: string) {
  try {
    return fs.existsSync(path) && fs.lstatSync(path).isFile();
  }
  catch (error) {
    return false;
  }
}
