# Peppy ALSA Pipe for Volumio

A Volumio plugin that adds the [Peppy ALSA Plugin](https://github.com/project-owner/peppyalsa) to Volumio's ALSA pipeline. The Peppy ALSA Plugin provides VU meter and spectrum analyzer data via named pipes.

## How it works

1. Audio data enters Volumio's ALSA pipeline.
2. At some point in the pipeline, the data is duplicated. One copy travels through the rest of the pipeline and arrives at its final destination — the sound card. The other copy gets consumed by the Peppy ALSA plugin.
4. The Peppy ALSA plugin analyzes the data it receives and dumps VU meter units and spectrum bar values to named pipes. Named pipes, or FIFO, are special files on the system used for inter-process communication. In this context, the FIFO data can be read by software such as [PeppyMeter](https://github.com/project-owner/PeppyMeter) and [PeppySpectrum](https://github.com/project-owner/PeppySpectrum) to display a VU meter and spectrum analyzer respectively.

## FIFO Paths

Defined as follows:

- VU meter units: `/tmp/peppy_meter_fifo`
- Spectrum data: `/tmp/peppy_spectrum_fifo`

## ALSA Devices

The default entry point into Volumio's ALSA pipeline is the `volumio` ALSA device. If you click the "Show Status" button in the settings page of Peppy ALSA Pipe, you will see there are two additional devices for "Peppy Bypass" and "Peppy Only".

### Peppy Bypass

Pipeline with Peppy ALSA only works for PCM streams. If you throw a native DSD stream into the pipeline, for instance, you will get an error.

Peppy Bypass creates a separate pipeline that does not incorporate Peppy ALSA. The entry point into this pipeline is the `volumioNoPeppy` ALSA device. Players that fail to play with the default `volumio` ALSA device can try with `volumioNoPeppy` instead. The obvious downside is that, without special facilitation, playback through these players will lack visualizer data from Peppy ALSA.

> Peppy Bypass is not available when the FusionDSP plugin is enabled. This is because FusionDSP processes audio and outputs PCM streams in the end.

### Peppy Only

While "Peppy Bypass" is for bypassing Peppy ALSA, "Peppy Only" sends audio *only* to Peppy ALSA. The relevant ALSA device for Peppy Only is `peppy_fifo`.

This is useful for players such as MPD that are able to send audio to more than one ALSA device. By configuring one output to `volumioNoPeppy` (Peppy Bypass) and another to `peppy_fifo` (Peppy Only), you would be able to achieve native playback + visualizer data.

> By default, Peppy ALSA Pipe automatically configures MPD this way, so you don't have to do it yourself. This can be disabled in the settings.

## Exported Vars

Peppy ALSA Pipe exports relevant information through Volumio's `sharedVars` object, which other plugins can access as follows:

```
// Don't get this wrong!
const SHARED_VAR_KEY = 'plugin.peppy_alsa_pipe.exports';

// Constructor of your plugin
constructor(context) {
    const exports = context.coreCommand.sharedVars.get(SHARED_VAR_KEY, null);

    // `exports` will be a JSON string if Peppy ALSA Pipe has fully started; `null` otherwise.
    if (exports) { 
        const data = JSON.parse(exports);

        // Parsed `data` can also be `null` if Peppy ALSA Pipe was subsequenetly disabled
        if (data) {
            const meterFifo = data.fifoPaths.meter;
            ...
        }
    }
}

/* 
data: {
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
*/

```

> To account for different plugin start times and possibility that exported values might change,
you should make use of `sharedVars.registerCallback(...)`.


## Changelog

0.1.0
- Initial release

## License

GPL v3.0
