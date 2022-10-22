import React, { useState } from 'react';
import './App.css';

import rtlsdr from './rtlsdr/rtlsdr';
import { TunerGain } from './rtlsdr/rtlsdr';
import Plotly from 'plotly.js-dist-min'


const demod = new Worker(new URL('./demod', import.meta.url));
const audio = new Worker(new URL('./audio', import.meta.url));

const useRange = (step: number, defaultValue: number, minValue: number, maxValue: number, onMouseUp: () => {}) => {
  const [value, setValue] = useState(defaultValue.toString());
  const input = <input type='range' step={step} value={value} min={minValue} max={maxValue} onChange={e => setValue(e.target.value)} onMouseUp={() => onMouseUp()} />;
  return [value, input];
};

const numberWithCommas = (x: number) => {
  return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

(()=>{
  const console_log = window.console.log;
  window.console.log = function(...args){
    console_log(...args);
    var textarea: any = document.getElementById('my_console');
    if(!textarea) {
      return
    };
    // let value: string = textarea?.value || '';
    args.forEach(arg=>textarea.value = `${JSON.stringify(arg)}\n` + textarea.value);
  }
})();


let tuner: any, device: any = undefined;

function App() {
  const [s, sampleRateInput] = useRange(1_000, 32_000, 8_000, 32_000, () => start());
  const [f, frequencyInput] = useRange(100_000, 96_000_000, 80_000_000, 100_000_000, () => start());
  const [started, setStarted] = useState(false);

  const frequency = parseInt(f as string);
  const sampleRate = parseInt(s as string);

  let dev: USBDevice;

  // Radio and demodulation config
  const FREQUENCY: number = frequency; // Frequency in Hz, 91.1MHz WREK Atlanta
  const SAMPLE_RATE: number = 170_000; // Demodulation sample rate, 170kHz
  const RATE_RESAMPLE: number = sampleRate; // Output sample rate, 32kHz

  const configure = async (device: USBDevice, tuner: any, freq: number, rate: number) => {
     // Use auto-gain
     await rtlsdr.setTunerGain(device, tuner, TunerGain.Auto);
     // Disable bias-tee
     await rtlsdr.setBiasTee(device, false);
     // Reset the endpoint before we try to read from it (mandatory)
     await rtlsdr.resetBuffer(device);
     // Set the frequency
     await rtlsdr.setCenterFreq(device, tuner, freq); // maybe not calling it
     // Set sample rate
     await rtlsdr.setSampleRate(device, tuner, rate);
  };

  /// Determine the optimal radio and demodulation configurations for given
/// frequency and sample rate.
const optimalSettings = (freq: number, rate: number) => {
  let downsample = (1_000_000 / rate) + 1;
  let capture_rate = downsample * rate;

  // Use offset-tuning
  let capture_freq = freq + capture_rate / 4;
  let outputScale = (1 << 15) / (128 * downsample);
  if (outputScale < 1) {
    outputScale = 1;
  }
  return {
    radioConfig: {
      capture_freq,
      capture_rate
    },
    demodConfig: {
      rate_in: SAMPLE_RATE,
          rate_out: SAMPLE_RATE,
          rate_resample: RATE_RESAMPLE,
          downsample: downsample,
          output_scale: outputScale,
    }
  }
}

  const start = async () => {
      setStarted(true);
      if (!device || !tuner) {
        const { tuner: t, device: d } = await rtlsdr.init({filters:[{vendorId: 3034}]});
        tuner = t;
        device = d;
      }

      await device.reset();

      const DEFAULT_BUF_LENGTH: number = (16 * 16384);

      const { radioConfig, demodConfig } = optimalSettings(FREQUENCY, SAMPLE_RATE);

      await configure(device, tuner, radioConfig.capture_freq, radioConfig.capture_rate);

      dev = device;

      console.log(`Sampling at ${rtlsdr.getSampleRate()} S/s`);

      console.log(`Tuned to ${rtlsdr.getCenterFreq()} Hz.`);

      console.log(`Bandwidth is ${rtlsdr.getTunerBandwidth()} Hz`)

      console.log('Reading samples in sync mode...')

      while (true) {
        const { data: { buffer } } = await rtlsdr.readSync(device, DEFAULT_BUF_LENGTH * 4);

        if (buffer.byteLength < DEFAULT_BUF_LENGTH * 4) {
          console.error({
            byteLength: buffer.byteLength
          });
          throw new Error('Short read ({:#?}), samples lost, exiting!');
        }

        demod.postMessage([demodConfig, buffer]);

        demod.onmessage = (e) => {
          const demodulated = e.data;

          audio.postMessage([demodulated, sampleRate]);

          audio.onmessage = (e) => {
            const wavBytes = e.data;
                      // show audio player
            const audio = document.createElement("audio");

            const blob = new Blob([wavBytes], { type: 'audio/wav' })
            audio.src = URL.createObjectURL(blob)
  
            audio.play();
          }
        }

      }
  };

  const close = async () => {
    setStarted(false);
    await rtlsdr.close(dev);
  };


  const plotStyle = {
    width:"600px", 
    height: "250px;"
  }

  return (
    <div className="App">
      <header className="App-header">
        <span>RTLSDR.js</span> <br />
        Frequency: {frequencyInput} {numberWithCommas(frequency)} <br />
        Sample Rate: {sampleRateInput} {numberWithCommas(sampleRate)} <br />
        <div className="buttons">
          <button onClick={start} disabled={started}>
              Start
          </button>
          <button onClick={close} disabled={!started}>
              Stop
          </button>
        </div>
        <textarea id="my_console" rows={25}></textarea>
      </header>
    </div>
  );
}

export default App;
