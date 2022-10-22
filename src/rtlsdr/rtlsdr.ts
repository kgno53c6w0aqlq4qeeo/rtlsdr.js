import { 
    KNOWN_DEVICES,
    BLOCK_USB,
    USB_SYSCTL,
    USB_EPA_MAXPKT,
    USB_EPA_CTL,
    BLOCK_SYS,
    DEMOD_CTL_1,
    DEMOD_CTL,
    EEPROM_SIZE,
    GPO,
    GPD,
    GPOE
} from './constants';
import deviceMod from './device-mod';
import tunerMod from './tuners/mod';
import { KNOWN_TUNERS } from './tuners/mod';
import { fromUint, toUint } from './utils';

const DEFAULT_FIR: bigint[] = [
    -54n, -36n, -41n, -40n, -32n, -14n, 14n, 53n, // i8
    101n, 156n, 215n, 273n, 327n, 372n, 404n, 421n, // i12
];

export enum TunerGain {
    Auto,
    Manual,
}

enum DirectSampleMode {
    Off,
    On,
    OnSwap, // Swap I and Q ADC, allowing to select between two inputs
}

const DEF_RTL_XTAL_FREQ: number = 28_800_000;

// state
interface State {
    rate: number;
    bw: number;
    xtal: number;
    tuner_xtal: number;
    freq: number;
    direct_sampling: DirectSampleMode,
    offset_freq: number
    corr: number;
    force_bt: boolean,
    force_ds: boolean
    ppm_correction: number
}
let state: State = {
    rate: 0,
    bw: 0,
    xtal: DEF_RTL_XTAL_FREQ,
    tuner_xtal: DEF_RTL_XTAL_FREQ,
    freq: 0,
    direct_sampling: DirectSampleMode.Off,
    offset_freq: 0,
    corr: 0,
    force_bt: false,
    force_ds: false,
    ppm_correction: 0,
};

const init = async (filters: USBDeviceRequestOptions): Promise<{device: USBDevice, tuner: typeof tunerMod.tuners}> => {
    const device = await getDevice(filters);
    await deviceMod.init(device);
    await deviceMod.testWrite(device)

    await initBaseband(device);

    await setI2cRepeater(device, true);

    const tunerId = await searchTuner(device);
    const tuner: any = tunerMod.tuners[tunerId as keyof typeof tunerMod.tuners];

    // Use the RTL clock value by default
    state.tuner_xtal = state.xtal;
    tuner.setXtalFreq(getTunerXtalFreq());

    // disable Zero-IF mode
    await deviceMod.demodWriteReg(device, 1, 0xb1, 0x1a, 1);

    // only enable In-phase ADC input
    await deviceMod.demodWriteReg(device, 0, 0x08, 0x4d, 1);

    // the R82XX use 3.57 MHz IF for the DVB-T 6 MHz mode, and
    // 4.57 MHz for the 8 MHz mode
    await setIfFreq(device, tuner.R82XX_IF_FREQ);

    // enable spectrum inversion
    await deviceMod.demodWriteReg(device, 1, 0x15, 0x01, 1);

    // Hack to force the Bias T to always be on if we set the IR-Endpoint bit in the EEPROM to 0. Default on EEPROM is 1.
    const {data: buf} = await deviceMod.readEeprom(device, 0, EEPROM_SIZE);
    const uint8Buff = new Uint8Array(buf)
    
    if ((buf[7] & 0x02) == 0) {
        state.force_bt = true;
    } else {
        state.force_bt = false;
    }

    // Hack to force direct sampling mode to always be on if we set the remote-enabled bit in the EEPROM to 1. Default on EEPROM is 0.
    if ((buf[7] & 0x01) != 0) {
        state.force_ds = true;
    } else {
        state.force_ds = false;
    }

    console.log('Init tuner');

    await tuner.init(device);

    await setI2cRepeater(device, false);

    console.log('Init complete');

    return {
        device,
        tuner
    };
};

const getTunerXtalFreq = (): number => (state.tuner_xtal * (1.0 + state.ppm_correction / 1e6));

const getTunerGains = (tuner: any) => tuner.getGains();

const getTunerBandwidth = () => state.bw;

const setTunerBandwidth = async (device: USBDevice, tuner: any, bw: number) => {
    bw = bw > 0 ? bw : state.rate;
    await setI2cRepeater(device, true);
    await tuner.setBandwidth(device, bw);
    await setI2cRepeater(device, false);
    if (tuner.getInfo()?.id == tuner.TUNER_ID) {
        await setIfFreq(device, tuner.getIfFreq());
        await setCenterFreq(device, tuner, state.freq);
    }

    state.bw = bw;
};

const setCenterFreq = async (device: USBDevice, tuner: any, freq: number) => {
    console.log('setCenterFreq', {
        freq
    });
    if (state.direct_sampling !== DirectSampleMode.Off) {
        await setIfFreq(device, freq);
    } else {
        await setI2cRepeater(device, true);
        await tuner.setFreq(device, freq - state.offset_freq);
        await setI2cRepeater(device, false);
    }
    state.freq = freq;
};

const setSampleRate = async (device: USBDevice, tuner: any, rate: number) => {
    // Check if rate is supported by the resampler
    if (rate <= 225_000 || rate > 3_200_000 || (rate > 300000 && rate <= 900000)) {
        console.error({rate});
        throw new Error('Invalid sample rate');
    }

    // Compute exact sample rate
    const rsampRatio = ((state.xtal * Math.pow(2, 22) / rate) & 0x0ffffffc);
    console.log('set_sample_rate', {
        rate,
        xtal: state.xtal,
        rsampRatio
    });

    const realResampRatio = rsampRatio | ((rsampRatio & 0x08000000) << 1);
    console.log('real_resamp_ratio', {realResampRatio});
    const realRate = Math.trunc((state.xtal * Math.pow(2, 22)) / realResampRatio);
    if (rate != realRate) {
        console.log('exact sample rate in Hz', realRate);
    }

    // Save exact rate
    state.rate = realRate;

    // Configure tuner
    await setI2cRepeater(device, true);
    let val = state.bw > 0 ? state.bw : state.rate;

    await tuner.setBandwidth(device, val);
    state.bw = val;
    await setI2cRepeater(device, false);
    if (tuner.getInfo()?.id == tuner.TUNER_ID) {
        await setIfFreq(device, tuner.getIfFreq());
        await setCenterFreq(device, tuner, state.freq);
    }

    let tmp: number = (rsampRatio >> 16);
    await deviceMod.demodWriteReg(device, 1, 0x9f, tmp, 2);
    tmp = (rsampRatio & 0xffff);
    await deviceMod.demodWriteReg(device, 1, 0xa1, tmp, 2);

    await setSampleFreqCorrection(device, state.corr);

    // Reset demod (bit 3, soft_rst)
    await deviceMod.demodWriteReg(device, 1, 0x01, 0x14, 1);
    await deviceMod.demodWriteReg(device, 1, 0x01, 0x10, 1);

    // Recalculate offset frequency if offset tuning is enabled
    if (state.offset_freq != 0) {
        await setOffsetTuning(device, true);
    }
};

const getSampleRate = (): number => state.rate;

const setTestmode = async (device: USBDevice, on: boolean): Promise<void> => {
    if (on) {
        await deviceMod.demodWriteReg(device, 0, 0x19, 0x03, 1);
    } else {
        await deviceMod.demodWriteReg(device, 0, 0x19, 0x05, 1);
    }
}

const resetBuffer = async (device: USBDevice): Promise<void> => {
    await deviceMod.writeReg(device, BLOCK_USB, USB_EPA_CTL, 0x1002, 2);
    await deviceMod.writeReg(device, BLOCK_USB, USB_EPA_CTL, 0x0000, 2);
}

const readSync = async (device: USBDevice, len: number): Promise<{ data: DataView, status: string }> => {
    const { data, status } =  await deviceMod.bulkTransfer(device, len);
    if (data === undefined || status === undefined) {
        throw new Error('empty response');
    }
    return { data, status };
};

const close = async (device: USBDevice) => await deviceMod.close(device);

const setOffsetTuning = async (device: USBDevice, enable: boolean): Promise<void>  => {
    // RTL-SDR-BLOG Hack, enables us to turn on the bias tee by clicking on "offset tuning"
    // in software that doesn't have specified bias tee support.
    // Offset tuning is not used for R820T devices so it is no problem.
    await setGPIO(device, 0, enable);
    // TODO: implement the rest when we support tuners beyond R82xx
}

const setGPIO = async (device: USBDevice, gpioPin: number, on: boolean): Promise<void> => {
    // If force_bt is on from the EEPROM, do not allow bias tee to turn off
    if (state.force_bt) {
        on = true;
    }
    await setGPIOOutput(device, gpioPin);
    await setGPIOBit(device, gpioPin, on)
}

const setGPIOBit = async (device: USBDevice, gpio: number, val: boolean): Promise<void> => {
    gpio = 1 << gpio;
    const { data } = await deviceMod.readReg(device, BLOCK_SYS, GPO, 1);
    if (!data) {
        throw new Error('error reading GPO');
    }
    let r: number = val ? toUint(16, data | gpio) : toUint(16, data & ~gpio);
   
    await deviceMod.writeReg(device, BLOCK_SYS, GPO, r, 1);
}

const setGPIOOutput = async (device: USBDevice, gpio: number): Promise<void> => {
    gpio = 1 << gpio;
    let { data: GPDData } = await deviceMod.readReg(device, BLOCK_SYS, GPD, 1);
    if (!GPDData) {
        throw new Error('error reading GPD');
    }
    await deviceMod.writeReg(device, BLOCK_SYS, GPD, GPDData & ~gpio, 1);
    let { data: GPOEData } = await deviceMod.readReg(device, BLOCK_SYS, GPOE, 1);
    if (!GPOEData) {
        throw new Error('error reading GPD');
    }
    await deviceMod.writeReg(device, BLOCK_SYS, GPOE, GPOEData | gpio, 1);
}

const setSampleFreqCorrection = async (device: USBDevice, ppm: number): Promise<void> => {
    let offs = (ppm * (-1) * Math.pow(2, 24) / 1_000_000);
    await deviceMod.demodWriteReg(device, 1, 0x3f, (offs & 0xff), 1);
    await deviceMod.demodWriteReg(device, 1, 0x3e, ((offs >> 8) & 0x3f), 1);
}

const setIfFreq = async (device: USBDevice, freq: number) => {
    // Get corrected clock value - start with default
    const rtlXtal: number = DEF_RTL_XTAL_FREQ;
    // Apply PPM correction
    const base = 1 << 22;
    const ifFreq: number = (freq * base / rtlXtal * -1);

    let tmp = (ifFreq >> 16) & 0x3f;
    await deviceMod.demodWriteReg(device, 1, 0x19, tmp, 1);
    tmp = (ifFreq >> 8) & 0xff;
    await deviceMod.demodWriteReg(device, 1, 0x1a, tmp, 1);
    tmp = ifFreq & 0xff;
    await deviceMod.demodWriteReg(device, 1, 0x1b, tmp, 1);
};

const initBaseband = async (device: USBDevice) => {
    // Init baseband
    console.log("Initialize USB");
    await deviceMod.writeReg(device, BLOCK_USB, USB_SYSCTL, 0x09, 1);
    await deviceMod.writeReg(device, BLOCK_USB, USB_EPA_MAXPKT, 0x0002, 2);
    await deviceMod.writeReg(device, BLOCK_USB, USB_EPA_CTL, 0x1002, 2);

    console.log("Power-on demod");
    await deviceMod.writeReg(device, BLOCK_SYS, DEMOD_CTL_1, 0x22, 1);
    await deviceMod.writeReg(device, BLOCK_SYS, DEMOD_CTL, 0xe8, 1);

    console.log("Reset demod (bit 3, soft_rst)");
    await deviceMod.resetDemod(device);

    console.log("Disable spectrum inversion and adjust channel rejection");
    await deviceMod.demodWriteReg(device, 1, 0x15, 0x00, 1);
    await deviceMod.demodWriteReg(device, 1, 0x16, 0x0000, 2);

    console.log("Clear DDC shift and IF registers");
    for (let i=0; i<5; i++) {
        await deviceMod.demodWriteReg(device, 1, 0x16 + i, 0x00, 1);
    }
    await setFir(device, DEFAULT_FIR);

    console.log("Enable SDR mode, disable DAGC (bit 5)");
    await deviceMod.demodWriteReg(device, 0, 0x19, 0x05, 1);

    console.log("Init FSM state-holding register");
    await deviceMod.demodWriteReg(device, 1, 0x93, 0xf0, 1);
    await deviceMod.demodWriteReg(device, 1, 0x94, 0x0f, 1);

    console.log('Disable AGC (en_dagc, bit 0)');// (seems to have no effect)
    await deviceMod.demodWriteReg(device, 1, 0x11, 0x00, 1);

    console.log('Disable RF and IF AGC loop');
    await deviceMod.demodWriteReg(device, 1, 0x04, 0x00, 1);

    console.log('Disable PID filter');
    await deviceMod.demodWriteReg(device, 0, 0x61, 0x60, 1);

    console.log('opt_adc_iq = 0, default ADC_I/ADC_Q datapath');
    await deviceMod.demodWriteReg(device, 0, 0x06, 0x80, 1);

    console.log('Enable Zero-IF mode, DC cancellation, and IQ estimation/compensation');
    await deviceMod.demodWriteReg(device, 1, 0xb1, 0x1b, 1);

    console.log('Disable 4.096 MHz clock output on pin TP_CK0');
    await deviceMod.demodWriteReg(device, 0, 0x0d, 0x83, 1);
};

const setI2cRepeater = async (device: USBDevice, bool: boolean) => {
    const val = bool ? 0x18 : 0x10;
    return await deviceMod.demodWriteReg(device, 0x1, 0x01, val, 1);
};

const setFir = async (device: USBDevice, fir: bigint[]): Promise<void> => {
    const TMP_LEN: number = 20;
    let tmp = [];
    for (let i=0;i<8;i++) {
        let val = fir[i];
        if (val < -128 || val > 127) {
            console.error({val});
            throw new Error('i8 FIR coefficient out of bounds!');
        }
        tmp[i] = parseInt(BigInt.asUintN(8, val).toString());
    }

    // Next 12 are i12, so don't line up with byte boundaries and need to unpack
    // 12 i12 values from 4 pairs of bytes in fir. Example:
    // fir: 4b5, 7f8, 3e8, 619
    // tmp: 4b, 57, f8, 3e, 86, 19
    for (let i=0; i<8; i+=2) {
        let val0 = fromUint(16, fir[8 + i]);
        let val1 = fromUint(16, fir[8 + i + 1]);
        if (val0 < -2048 || val0 > 2047) {
            console.error({
                val0
            });
            throw new Error('i12 FIR coefficient out of bounds');
        } else if (val1 < -2048 || val1 > 2047) {
            console.error({
                val1
            });
            throw new Error('i12 FIR coefficient out of bounds');
        }
        
        tmp[8 + i * 3 / 2] = toUint(8, val0 >> 4);
        tmp[8 + i * 3 / 2 + 1] = toUint(8, (val0 << 4) | ((val1 >> 8) & 0x0f));
        tmp[8 + i * 3 / 2 + 2] = toUint(8, val1);
    }

    for (let i=0; i<TMP_LEN; i++) {
        await deviceMod.demodWriteReg(device, 1, 0x1c + i, tmp[i], 1);
    }
};

const searchTuner = async (device: USBDevice): Promise<string> => {
    for (let tunerInfo of KNOWN_TUNERS) {
        const regVal = await deviceMod.i2cReadReg(device, tunerInfo.i2c_addr, tunerInfo.check_addr);
        console.log(`Probing I2C address ${tunerInfo.i2c_addr} checking address ${tunerInfo.check_addr}`);

        if (regVal.data === tunerInfo.check_val) {
            return tunerInfo.id;
        }
    }
    throw new Error('tuner not found');
};

const getDevice = async (filters: USBDeviceRequestOptions): Promise<USBDevice> => {
    const devices = await navigator.usb.getDevices();
    let device = devices.find(device => validateDeviceSupport(device))
    if (!device) {
        device = await navigator.usb.requestDevice(filters);
    }
    if (!device || !validateDeviceSupport(device)) {
        throw new Error('Device not supported');
    }
    return device;
}

const validateDeviceSupport = (device: USBDevice) => {
    for (let knownDevice of KNOWN_DEVICES) {
        if (knownDevice.vendorId == device.vendorId && knownDevice.productId == device.productId) {
            return true;
        }
    }
    return false;
}

const getCenterFreq = (): number => state.freq;

// TunerGain has mode and gain, so this replaces rtlsdr_set_tuner_gain_mode
const setTunerGain = async (device: USBDevice, tuner: any, mode: TunerGain, gain?: number): Promise<void> => {
    await setI2cRepeater(device, true);
    await tuner.setGain(device, mode, gain);
    await setI2cRepeater(device, false);
}

const setBiasTee = async (device: USBDevice, on: boolean): Promise<void> => await setGPIO(device, 0, on);

export default {
    init,
    close,
    getTunerGains,
    setSampleRate,
    getSampleRate,
    setTestmode,
    resetBuffer,
    readSync,
    getCenterFreq,
    setCenterFreq,
    setTunerGain,
    setBiasTee,
    setTunerBandwidth,
    getTunerBandwidth
}