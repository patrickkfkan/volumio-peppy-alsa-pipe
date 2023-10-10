#!/bin/bash

ARCH="$(arch)"
PLUGIN_PATH="/data/plugins/audio_interface/peppy_alsa_pipe"
ALSA_BASE_PATH="${PLUGIN_PATH}/alsa-lib"

cleanup_exit_err() {
    rm -rf "${PLUGIN_PATH}"
    exit -1
}

if [ $ARCH = "armv6l" ] || [ $ARCH = "armv7l" ]; then
    PEPPY_ALSA_PATH="${ALSA_BASE_PATH}/armhf"
elif [ $ARCH = "x86_64" ]; then
    PEPPY_ALSA_PATH="${ALSA_BASE_PATH}/x86_64"
fi

if [ -z $PEPPY_ALSA_PATH ]; then
    echo "Unknown arch: ${ARCH}. Installation cannot proceed."
    cleanup_exit_err
fi

ln -s ${PEPPY_ALSA_PATH}/libpeppyalsa.so.0.0.0 ${PEPPY_ALSA_PATH}/libpeppyalsa.so
ln -s ${PEPPY_ALSA_PATH}/libpeppyalsa.so.0.0.0 ${PEPPY_ALSA_PATH}/libpeppyalsa.so.0
ln -s ${PEPPY_ALSA_PATH}/libpeppyalsa.so ${ALSA_BASE_PATH}/libpeppyalsa.so

echo "Peppy ALSA Pipe installed"
echo "plugininstallend"
