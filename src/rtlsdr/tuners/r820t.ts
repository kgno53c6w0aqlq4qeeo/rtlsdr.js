// https://github.com/osmocom/rtl-sdr/blob/master/src/tuner_r82xx.c

import { TunerInfo } from "./mod";
import deviceMod from '../device-mod';
import { TunerGain } from '../rtlsdr';
import { toUint } from "../utils";

export const TUNER_ID: string = 'r820t';

export const TUNER_INFO: TunerInfo = {
    id: TUNER_ID,
    name: "Rafael Micro R820T",
    i2c_addr: 0x34,
    check_addr: 0x00,
    check_val: 0x69
};

const GAINS: Number[] = [
    0, 9, 14, 27, 37, 77, 87, 125, 144, 157, 166, 197, 207, 229, 254, 280, 297, 328, 338, 364, 372,
    386, 402, 421, 434, 439, 445, 480, 496,
];

const R82XX_LNA_GAIN_STEPS: number[] =
    [0, 9, 13, 40, 38, 13, 31, 22, 26, 31, 26, 14, 19, 5, 35, 13];

const R82XX_MIXER_GAIN_STEPS: number[] =
    [0, 5, 10, 10, 19, 9, 10, 25, 17, 10, 8, 16, 13, 6, 3, -8];

interface FreqRange {
    freq: number,       // Start freq, in MHz
    open_d: number,      // low
    rf_mux_ploy: number, // R26[7:6]=0 (LPF)  R26[1:0]=2 (low)
    tf_c: number,        // R27[7:0]  band2,band0
    xtal_cap20p: number, // R16[1:0]  20pF (10)
    xtal_cap10p: number,
    xtal_cap0p: number,
}

const FREQ_RANGES: FreqRange[] = [
    {
        freq: 0,
        open_d: 0x08,
        rf_mux_ploy: 0x02,
        tf_c: 0xdf,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 50,
        open_d: 0x08,
        rf_mux_ploy: 0x02,
        tf_c: 0xbe,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 55,
        open_d: 0x08,
        rf_mux_ploy: 0x02,
        tf_c: 0x8b,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 60,
        open_d: 0x08,
        rf_mux_ploy: 0x02,
        tf_c: 0x7b,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 65,
        open_d: 0x08,
        rf_mux_ploy: 0x02,
        tf_c: 0x69,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 70,
        open_d: 0x08,
        rf_mux_ploy: 0x02,
        tf_c: 0x58,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 75,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x44,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 80,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x44,
        xtal_cap20p: 0x02,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 90,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x34,
        xtal_cap20p: 0x01,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 100,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x34,
        xtal_cap20p: 0x01,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 110,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x24,
        xtal_cap20p: 0x01,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 120,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x24,
        xtal_cap20p: 0x01,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 140,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x14,
        xtal_cap20p: 0x01,
        xtal_cap10p: 0x01,
        xtal_cap0p: 0x00,
    },
    {
        freq: 180,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x13,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
    {
        freq: 220,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x13,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
    {
        freq: 250,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x11,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
    {
        freq: 280,
        open_d: 0x00,
        rf_mux_ploy: 0x02,
        tf_c: 0x00,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
    {
        freq: 310,
        open_d: 0x00,
        rf_mux_ploy: 0x41,
        tf_c: 0x00,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
    {
        freq: 450,
        open_d: 0x00,
        rf_mux_ploy: 0x41,
        tf_c: 0x00,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
    {
        freq: 588,
        open_d: 0x00,
        rf_mux_ploy: 0x40,
        tf_c: 0x00,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
    {
        freq: 650,
        open_d: 0x00,
        rf_mux_ploy: 0x40,
        tf_c: 0x00,
        xtal_cap20p: 0x00,
        xtal_cap10p: 0x00,
        xtal_cap0p: 0x00,
    },
];

enum TunerType {
    TunerRadio,
    TunerAnalogTv,
    TunerDigitalTv,
}

enum DeliverySystem {
    SysUndefined,
    SysDvbt,
    SysDvbt2,
    SysIsdbt,
}

enum XtalCapValue {
    XtalLowCap30p,
    XtalLowCap20p,
    XtalLowCap10p,
    XtalLowCap0p,
    XtalHighCap0p,
}


const DELIVERY_SYSTEM_CONFIG = {
    [DeliverySystem.SysDvbt]: {
        mixer_top: 0x24, /* mixer top:13 , top-1, low-discharge */
        lna_top: 0xe5, /* detect bw 3, lna top:4, predet top:2 */
        cp_cur: 0x38, /* 111, auto */
        div_buf_cur: 0x30, /* 11, 150u */
        lna_vth_l: 0x53, /* lna vth 0.84	,  vtl 0.64 */
        mixer_vth_l: 0x75, /* mixer vth 1.04, vtl 0.84 */
        air_cable1_in: 0x00,
        cable2_in: 0x00,
        pre_dect: 0x40,
        lna_discharge: 14,
        filter_cur: 0x40, /* 10, low */
    },
    [DeliverySystem.SysDvbt2]: {
        mixer_top: 0x24, /* mixer top:13 , top-1, low-discharge */
        lna_top: 0xe5, /* detect bw 3, lna top:4, predet top:2 */
        lna_vth_l: 0x53, /* lna vth 0.84	,  vtl 0.64 */
        mixer_vth_l: 0x75, /* mixer vth 1.04, vtl 0.84 */
        air_cable1_in: 0x00,
        cable2_in: 0x00,
        pre_dect: 0x40,
        lna_discharge: 14,
        cp_cur: 0x38, /* 111, auto */
        div_buf_cur: 0x30, /* 11, 150u */
        filter_cur: 0x40, /* 10, low */
    },
    [DeliverySystem.SysIsdbt]: {
        mixer_top: 0x24, /* mixer top:13 , top-1, low-discharge */
        lna_top: 0xe5, /* detect bw 3, lna top:4, predet top:2 */
        lna_vth_l: 0x75, /* lna vth 1.04	,  vtl 0.84 */
        mixer_vth_l: 0x75, /* mixer vth 1.04, vtl 0.84 */
        air_cable1_in: 0x00,
        cable2_in: 0x00,
        pre_dect: 0x40,
        lna_discharge: 14,
        cp_cur: 0x38, /* 111, auto */
        div_buf_cur: 0x30, /* 11, 150u */
        filter_cur: 0x40, /* 10, low */
    },
    [DeliverySystem.SysUndefined]: {
        // DVB-T 8M
        mixer_top: 0x24, /* mixer top:13 , top-1, low-discharge */
        lna_top: 0xe5, /* detect bw 3, lna top:4, predet top:2 */
        lna_vth_l: 0x53, /* lna vth 0.84	,  vtl 0.64 */
        mixer_vth_l: 0x75, /* mixer vth 1.04, vtl 0.84 */
        air_cable1_in: 0x00,
        cable2_in: 0x00,
        pre_dect: 0x40,
        lna_discharge: 14,
        cp_cur: 0x38, /* 111, auto */
        div_buf_cur: 0x30, /* 11, 150u */
        filter_cur: 0x40, /* 10, low */
    }
}

// Init registers (32 total, first 5 are read-only)
const REG_INIT: number[] = [
    0x83, 0x32, 0x75, /* 05 to 07 */
    0xc0, 0x40, 0xd6, 0x6c, /* 08 to 0b */
    0xf5, 0x63, 0x75, 0x68, /* 0c to 0f */
    0x6c, 0x83, 0x80, 0x00, /* 10 to 13 */
    0x0f, 0x00, 0xc0, 0x30, /* 14 to 17 */
    0x48, 0xcc, 0x60, 0x00, /* 18 to 1b */
    0x54, 0xae, 0x4a, 0xc0, /* 1c to 1f */
];

const R820T_I2C_ADDR: number = 0x34;
// const R828D_I2C_ADDR: u8 = 0x74; for now only support the T
const VER_NUM: number = 49;
export const R82XX_IF_FREQ: number = 3570000;
const NUM_REGS: number = 32;
const RW_REG_START: number = 5; // registers 0-4 are read-only
const NUM_CACHE_REGS: number = NUM_REGS - RW_REG_START; // only cache RW regs
const MAX_I2C_MSG_LEN: number = 8;

// state
interface State {
    regsLocalCache: number[];
    xtal: number;
    xtal_cap_sel: XtalCapValue;
    int_freq: number;
    has_lock: boolean;
    fil_cal_code: number;
};
let state: State = {
    regsLocalCache: [],
    xtal: 0,
    xtal_cap_sel: 0,
    int_freq: 0,
    has_lock: false,
    fil_cal_code: 0,
} 
export const init = async (device: USBDevice) => {
    // TODO: set different I2C address and rafael_chip for R828D
    const usePredetect = false;

    // <original>TODO: R828D might need r82xx_xtal_check()
    state.xtal_cap_sel = XtalCapValue.XtalHighCap0p;

    // Initialize registers
    await writeRegs(device, 0x05, REG_INIT);

    await setTvStandard(device, TunerType.TunerDigitalTv);

    await sysfreqSel(device, 0, TunerType.TunerDigitalTv, DeliverySystem.SysDvbt, usePredetect);

    // this.init_done = true;
};

const sysfreqSel = async (device: USBDevice, freq: number, tunerType: TunerType, deliverySystem: DeliverySystem, usePredetect: boolean) => {
    if ((freq == 506000000) || (freq == 666000000) || (freq == 818000000)) {
        DELIVERY_SYSTEM_CONFIG[DeliverySystem.SysDvbt].mixer_top = 0x14; /* mixer top:14 , top-1, low-discharge */
        DELIVERY_SYSTEM_CONFIG[DeliverySystem.SysDvbt].lna_top = 0xe5; /* detect bw 3, lna top:4, predet top:2 */
        DELIVERY_SYSTEM_CONFIG[DeliverySystem.SysDvbt].cp_cur = 0x28; /* 101, 0.2 */
        DELIVERY_SYSTEM_CONFIG[DeliverySystem.SysDvbt].div_buf_cur = 0x20; /* 10, 200u */
    }

    const config = DELIVERY_SYSTEM_CONFIG[deliverySystem];

    if (usePredetect) {
        await writeRegMask(device, 0x06, config.pre_dect, 0x40);
    }

    await writeRegMask(device, 0x1d, config.lna_top, 0xc7);
    await writeRegMask(device, 0x1c, config.mixer_top, 0xf8);
    await writeRegs(device, 0x0d, [config.lna_vth_l]);
    await writeRegs(device, 0x0e, [config.mixer_vth_l]);

    // Air-IN only for Astrometa
    await writeRegMask(device, 0x05, config.air_cable1_in, 0x60);
    await writeRegMask(device, 0x06, config.cable2_in, 0x08);
    await writeRegMask(device, 0x11, config.cp_cur, 0x38);

    // RTLSDRBLOG. Improve L-band performance by setting PLL drop out to 2.0v
    // config.div_buf_cur = 0xa0;

    await writeRegMask(device, 0x17, config.div_buf_cur, 0x30);
    await writeRegMask(device, 0x0a, config.filter_cur, 0x60);

    // Set LNA
    if (tunerType !== TunerType.TunerAnalogTv) {
        // LNA TOP: lowest
        await writeRegMask(device, 0x1d, 0, 0x38);
        // 0: normal mode
        await writeRegMask(device, 0x1c, 0, 0x04);
        // 0: PRE_DECT off
        await writeRegMask(device, 0x06, 0, 0x40);
        // agc clk 250hz
        await writeRegMask(device, 0x1a, 0x30, 0x30);

        // write LNA TOP = 3
        await writeRegMask(device, 0x1d, 0x18, 0x38);

        /*
         * write discharge mode
         * FIXME: IMHO, the mask here is wrong, but it matches
         * what's there at the original driver
         */
        await writeRegMask(device, 0x1c, config.mixer_top, 0x04);
        // LNA discharge current
        await writeRegMask(device, 0x1e, config.lna_discharge, 0x1f);
        // agc clk 60hz
        await writeRegMask(device, 0x1a, 0x20, 0x30);
    } else {
        // PRE_DECT off
        await writeRegMask(device, 0x06, 0, 0x40);
        // write LNA TOP
        await writeRegMask(device, 0x1d, config.lna_top, 0x38);

        /*
         * write discharge mode
         * FIXME: IMHO, the mask here is wrong, but it matches
         * what's there at the original driver
         */
        await writeRegMask(device, 0x1c, config.mixer_top, 0x04);
        // LNA discharge current
        await writeRegMask(device, 0x1e, config.lna_discharge, 0x1f);
        // agc clk 1Khz, external det1 cap 1u
        await writeRegMask(device, 0x1a, 0x00, 0x30);
    }
    await writeRegMask(device, 0x10, config.lna_discharge, 0x04);
    console.log('========s===s==s=s==s========');
};

const setTvStandard = async (device: USBDevice, tunerType: TunerType): Promise<void> => {
    /* BW < 6 MHz */
    let ifKhz = 3570;
    let filtCalLo = 56000; /* 52000->56000 */
    let filtGain = 0x10; /* +3db, 6mhz on */
    let imgR = 0x00; /* image negative */
    let filtQ = 0x10; /* r10[4]:low q(1'b1) */
    let hpCor = 0x6b; /* 1.7m disable, +2cap, 1.0mhz */
    let extEnable = 0x60; /* r30[6]=1 ext enable; r30[5]:1 ext at lna max-1 */
    let loopThrough = 0x01; /* r5[7], lt off */
    let ltAtt = 0x00; /* r31[7], lt att enable */
    let fltExtWidest = 0x00; /* r15[7]: flt_ext_wide off */
    let polyfilCur = 0x60; /* r25[6:5]:min */

    // Initialize register cache
    state.regsLocalCache = REG_INIT.slice(0, NUM_CACHE_REGS)

    // Init Flag & Xtal_check Result (inits VGA gain, needed?)
    await writeRegMask(device, 0x0c, 0x00, 0x0f);

    // Version
    await writeRegMask(device, 0x13, VER_NUM, 0x3f);

    // for LT Gain test
    if (tunerType !== TunerType.TunerAnalogTv) {
        await writeRegMask(device, 0x1d, 0x00, 0x38);
    }
    state.int_freq = ifKhz * 1000;
    
    /* Check if standard changed. If so, filter calibration is needed */
    /* Since we call this function only once in rtlsdr, force calibration */
    let needCalibration = true;
    if (needCalibration) {
        for (let i=0;i<2;i++) {
            // Set filt_cap
            await writeRegMask(device, 0x0b, hpCor, 0x60);
            // set cali clk = on
            await writeRegMask(device, 0x0f, 0x04, 0x04);
            // X'tal cap 0pF for PLL
            await writeRegMask(device, 0x10, 0x00, 0x03);
            console.log('need_calibration', state.fil_cal_code);
            await setPll(device, filtCalLo * 1000);

            // Start trigger
            await writeRegMask(device, 0x0b, 0x10, 0x10);
            // Stop trigger
            await writeRegMask(device, 0x0b, 0x00, 0x04);

            // Check if calibration worked
            let data = await readReg(device, 0x00, 5);
            state.fil_cal_code = data[4] & 0x0f;
            if ((state.fil_cal_code & state.fil_cal_code) != 0x0f) {
                break;
            }
            // Narrowest
            if (state.fil_cal_code == 0x0f) {
                state.fil_cal_code = 0;
            }
        }
    }
    console.log('========s===s==s=s==s========');
    await writeRegMask(device, 0x0a, filtQ | state.fil_cal_code, 0x1f);

    // Set BW, Filter_gain, and HP corner
    await writeRegMask(device, 0x0b, hpCor, 0xef);

    // Set Img_R
    await writeRegMask(device, 0x07, imgR, 0x80);

    // Set filt_3dB, V6MHz
    await writeRegMask(device, 0x06, filtGain, 0x30);

    // Channel filter extension
    await writeRegMask(device, 0x1e, extEnable, 0x60);

    // Loop through
    await writeRegMask(device, 0x05, loopThrough, 0x80);

    // Loop through attenuation
    await writeRegMask(device, 0x1f, ltAtt, 0x80);

    // Filter extension widest
    await writeRegMask(device, 0x0f, fltExtWidest, 0x80);

    // RF poly filter current
    await writeRegMask(device, 0x19, polyfilCur, 0x60);
};

/// Write register with bit-masked data
const writeRegMask = async (device: USBDevice, reg: number, val: number, bitMask: number): Promise<void> => {
    let rc = readCacheReg(reg);
    // Compute the desired register value: (rc & !mask) gets the unmasked bits and leaves the masked as 0,
    // and (val & mask) gets just the masked bits we want to set. Or together to get the desired register.

    let applied: number = (rc & ~bitMask) | (val & bitMask);
    return await writeRegs(device, reg, [applied]);
};

/// Read register data from local cache
/// # Panics
///     * reg < RW_REG_START
///     * reg > NUM_REGS
const readCacheReg = (reg: number) => {
    if (reg < RW_REG_START) {
        throw new Error('reg is less than reg start');
    }
    let index = reg - RW_REG_START;
    if (index >= NUM_CACHE_REGS) {
        throw new Error('index is higher than cache regs');
    }
    return state.regsLocalCache[index];
};

/// Write data to device registers (r82xx_write)
const writeRegs = async (device: USBDevice, reg: number, val: number[]): Promise<void> => {
    // Store write in local cache
    regCacheStore(reg, val);

    // Use I2C to write to device in chunks of MAX_I2C_MSG_LEN
    let len: number = val.length
    let valIndex: number = 0;
    let regIndex: number = reg;

    while (true) {
        // First byte in message is the register addr, then the data
        let size = len > MAX_I2C_MSG_LEN - 1 ? MAX_I2C_MSG_LEN : len;
        let buf: number[] = [regIndex, ...val.slice(valIndex, valIndex + size)];

        await deviceMod.i2cWrite(device, R820T_I2C_ADDR, buf);
        valIndex += size;
        regIndex += size;
        len -= size;
        if (len <= 0) {
            break;
        }
    }
};

/// Cache register values locally.
    /// Will panic if reg < RW_REG_START or (reg + len) > NUM_CACHE_REGS + 1
const regCacheStore = async (reg: number, val: number[]) => {
    if (reg < RW_REG_START) {
        throw new Error('reg value is less than start');
    }

    reg = reg - RW_REG_START;
    if ((reg + val.length) > NUM_CACHE_REGS) {
        throw new Error('out of range');
    }

    state.regsLocalCache.splice(reg, val.length, ...val);
}

// (r82xx_read)
const readReg = async (device: USBDevice, reg: number, len: number) => {
    await deviceMod.i2cWrite(device, R820T_I2C_ADDR, [reg]);
    const {buffer} = await deviceMod.i2cRead(device, R820T_I2C_ADDR, len);
    if (!buffer) {
        throw new Error('buffer is empty');
    }

    const uintArray = new Uint8Array(buffer);

    // not sure it works
    for (let i=0; i<uintArray.length; i++) {
        uintArray[i] = bitReverse(uintArray[i]);
    }

    return uintArray;
}

const bitReverse = (byte: number):number => {
    const LUT: number[] = [
        0x0, 0x8, 0x4, 0xc, 0x2, 0xa, 0x6, 0xe, 0x1, 0x9, 0x5, 0xd, 0x3, 0xb, 0x7, 0xf,
    ];
    return (LUT[(byte & 0xf)] << 4) | LUT[(byte >> 4)]
}

export const setXtalFreq = (freq: number): void => {
    state.xtal = freq;
};

export const getXtalFreq = (): number => state.xtal;

export const getGains = () => GAINS;

export const getInfo = () => TUNER_INFO;

export const getIfFreq = () => state.int_freq;

export const setGain = async (device: USBDevice, mode: TunerGain, gain?: number): Promise<void> => {
    if (mode == TunerGain.Auto) {
        // LNA
        await writeRegMask(device, 0x05, 0, 0x10);
        // Mixer
        await writeRegMask(device, 0x07, 0x10, 0x10);
        // Set fixed VGA gain for now (26.5 dB)
        await writeRegMask(device, 0x0c, 0x0b, 0x9f);
    } else if (mode == TunerGain.Manual) {
        if (gain === undefined) {
            throw new Error('manual gain value missing');
        }
        // LNA auto off
        await writeRegMask(device, 0x05, 0x10, 0x10);
        // Mixer auto off
        await writeRegMask(device, 0x07, 0, 0x10);

        const data = await readReg(device, 0x00, 4);

        // Set fixed VGA gain for now (16.3 dB)
        await writeRegMask(device, 0x0c, 0x08, 0x9f); //init val 0x08 0x0c works well at 1;

        let totalGain: number = 0;
        let mixIndex: number = 0;
        let lnaIndex: number = 0;

        for (let i=0;i<15;i++) {
            if (totalGain >= gain) {
                break;
            }
            lnaIndex += 1;
            totalGain += R82XX_LNA_GAIN_STEPS[lnaIndex];

            if (totalGain >= gain) {
                break;
            }

            mixIndex += 1;
            totalGain += R82XX_MIXER_GAIN_STEPS[mixIndex];
        }

         // Set LNA gain
         await writeRegMask(device, 0x05, lnaIndex, 0x0f);

         // Set mixer gain
         await writeRegMask(device, 0x07, mixIndex, 0x0f);

         // LNA
         await writeRegMask(device, 0x05, 0, 0x10);

         // Mixer
         await writeRegMask(device, 0x07, 0x10, 0x10);

         // Set fixed VGA gain for now (26.5dB)
         await writeRegMask(device, 0x0c, 0x0b, 0x9f);
    }
}

export const setFreq = async (device: USBDevice, freq: number) => {
    console.log('set_freq', {freq});
    let loFreq = freq + state.int_freq;
    console.log('set_freq - ', {loFreq});
    await setMux(device, loFreq);
    await setPll(device, loFreq);
};

export const setMux = async (device: USBDevice, freq: number) => {
    // Get the proper frequency range
    let freqMhz = freq / 1_000_000;
    // Find the range that freq is within
    let range = (() => {
       let r = FREQ_RANGES[0];
       for (let range of FREQ_RANGES) {
           if (freqMhz < range.freq) {
               // past freq, break
               break;
           }
           // range still below freq, save it and continue iterating
           r = range;
       }
       return r
    })()

    // Open Drain
    await writeRegMask(device, 0x17, range.open_d, 0x08);

    // RF_MUX, Polymux
    await writeRegMask(device, 0x1a, range.rf_mux_ploy, 0xc3);

    // TF Band
    await writeRegs(device, 0x1b, [range.tf_c]);

    // XTAL CAP & Drive
    let val: XtalCapValue = XtalCapValue.XtalLowCap0p;
    if (state.xtal_cap_sel == XtalCapValue.XtalLowCap30p || state.xtal_cap_sel == XtalCapValue.XtalLowCap20p) {
        val = range.xtal_cap20p | 0x08
    } else if (state.xtal_cap_sel == XtalCapValue.XtalLowCap10p) {
        val = range.xtal_cap10p | 0x08
    } else if (state.xtal_cap_sel == XtalCapValue.XtalHighCap0p) {
        val = range.xtal_cap0p | 0x00
    } else if (state.xtal_cap_sel == XtalCapValue.XtalLowCap0p) {
        val = range.xtal_cap0p | 0x08
    }
   
    await writeRegMask(device, 0x10, val, 0x0b);
    await writeRegMask(device, 0x08, 0x00, 0x3f);
    await writeRegMask(device, 0x09, 0x00, 0x3f);
};

export const setPll = async (device: USBDevice, freq: number) => {
    console.log('freq', {freq});
    // Frequency in kHz
    const freqKhz = Math.floor((freq + 500) / 1000);
    console.log('freq (kHz)', {freqKhz});
    console.log({
        state_xtal: state.xtal
    });
    const pllRef = state.xtal;
    const pllRefKhz = Math.trunc((state.xtal + 500) / 1000);

    const refdiv2 = 0;
    await writeRegMask(device, 0x10, refdiv2, 0x10);

    // Set PLL auto-tune = 128kHz
    await writeRegMask(device, 0x1a, 0x00, 0x0c);

    // Set VCO current = 100 (RTL-SDR Blog Mod: MAX CURRENT)
    await writeRegMask(device, 0x12, 0x80, 0xe0);

    // Test turning tracking filter off
    // await writeRegMask(device, 0x1a, 0x40, 0xc0;

    // Calculate divider
    let vcoMin: number = 1770000;
    let vcoMax: number = vcoMin * 2;
    let mixDiv: number = 2;
    let divBuf: number = 0;
    let divNum: number = 0;
    while (mixDiv <= 64) {
        if (((freqKhz * mixDiv) >= vcoMin) && ((freqKhz * mixDiv) < vcoMax)) {
            divBuf = mixDiv;
            while (divBuf > 2) {
                divBuf = divBuf >> 1;
                divNum += 1;
            }
            break;
        }
        mixDiv = mixDiv << 1;
    }

    let data: Uint8Array = await readReg(device, 0x00, 5);
    // TODO: if chip is R828D set vco_power_ref = 1
    const vcoPowerRef = 2;
    const vcoFineTune = (data[4] & 0x30) >> 4;
    if (vcoFineTune > vcoPowerRef) {
        divNum = divNum - 1;
    } else if (vcoFineTune < vcoPowerRef) {
        divNum = divNum + 1;
    }

    await writeRegMask(device, 0x10, divNum << 5, 0xe0);

    let vcoFreq = freq * mixDiv;
    console.log('vco_freq', {
        vcoFreq,
        freq,
        mixDiv
    });
    let nint = Math.floor((vcoFreq / (2 * pllRef)));
    console.log('nint', {
        nint
    });
    // VCO contribution by SDM (kHz)
    let vcoFra = ((vcoFreq - 2 * pllRef * nint) / 1000);

    if (nint > ((128 / vcoPowerRef) - 1)) {
        console.error({freq})
        throw new Error('No valid PLL values');
    }

    let ni = Math.floor((nint - 13) / 4); // Maybe math.round()
    let si = (nint - 4 * ni - 13);
    console.log({
        ni,
        si,
        reg: ni + (si << 6)
    });
    await writeRegs(device, 0x14, [ni + (si << 6)]);

    // pw_sdm
    if (vcoFra == 0) {
        await writeRegMask(device, 0x12, 0x08, 0x08);
    } else {
        await writeRegMask(device, 0x12, 0x00, 0x08);
    }

    // SDM Calculator
    let sdm: number = 0;
    let nSdm: number = 2;
   
    while (vcoFra > 1) {
        if (vcoFra > (2 * pllRefKhz / nSdm)) {
            sdm = sdm + 32768 / (nSdm / 2);
            vcoFra = Math.round(vcoFra - 2 * pllRefKhz / nSdm);
            if (nSdm >= 0x8000) {
                break;
            }
        }
        nSdm = nSdm << 1;
    }

    await writeRegs(device, 0x16, [toUint(8, sdm >> 8)]);
    await writeRegs(device, 0x15, [toUint(8, sdm & 0xff)]);

    for (let i=0; i<2; i++) {
        // Check if PLL has locked
        data = await readReg(device, 0x00, 3);
        if ((data[2] & 0x40) != 0) {
            break;
        }
        if (i == 0) {
            // Didn't lock, increase VCO current
            // await writeRegMask(device, 0x12, 0x06, 0xff);
            await writeRegMask(device, 0x12, 0x80, 0xe0);
        }
    }
    if ((data[2] & 0x40) == 0) {
        console.log('[R82xx] PLL not locked!');
        state.has_lock = false;
        return;
    }
    state.has_lock = true;

    // Set PLL auto-tune = 8kHz
    await writeRegMask(device, 0x1a, 0x08, 0x08);
};

export const setBandwidth = async (device: USBDevice, bwIn: number) => {
    let bw: number = bwIn;
    const FILT_HP_BW1: number = 350_000;
    const FILT_HP_BW2: number = 380_000;
    const R82XX_IF_LOW_PASS_BW_TABLE: number[] = [
        1_700_000, 1_600_000, 1_550_000, 1_450_000, 1_200_000, 900_000, 700_000, 550_000,
        450_000, 350_000,
    ];

    let reg_0a: number = 0;
    let reg_0b: number = 0;

    if (bw > 7_000_000) {
        // BW: 8MHz
        state.int_freq = 4_570_000;
        reg_0a = 0x10;
        reg_0b = 0x0b;
    } else if (bw > 6_000_000) {
        // BW: 7MHz
        state.int_freq = 4_570_000;
        reg_0a = 0x10;
        reg_0b = 0x2a;
    } else if (bw > R82XX_IF_LOW_PASS_BW_TABLE[0] + FILT_HP_BW1 + FILT_HP_BW2) {
        // BW: 6MHz
        state.int_freq = 3_570_000;
        reg_0a = 0x10;
        reg_0b = 0x6b;
    } else {
        state.int_freq = 2_300_000;
        reg_0a = 0x00;
        reg_0b = 0x80;

        let realBw = 0;
        if (bw > R82XX_IF_LOW_PASS_BW_TABLE[0] + FILT_HP_BW1) {
            bw -= FILT_HP_BW2;
            state.int_freq += FILT_HP_BW2;
            realBw += FILT_HP_BW2;
        } else {
            reg_0b |= 0x20;
        }

        if (bw > R82XX_IF_LOW_PASS_BW_TABLE[0]) {
            bw -= FILT_HP_BW1;
            state.int_freq += FILT_HP_BW1;
            realBw += FILT_HP_BW1;
        } else {
            reg_0b |= 0x40;
        }

        // Find low-pass filter
        let lpIdx: number = 0;
        // Want the element before the first that is lower than bw
        for (let i=0; i<R82XX_IF_LOW_PASS_BW_TABLE.length; i++) {
            const freq = R82XX_IF_LOW_PASS_BW_TABLE[i];
            if (bw > freq) {
                break;
            }
            lpIdx = i;
        }
      
        reg_0b |= 15 - lpIdx;
        realBw += R82XX_IF_LOW_PASS_BW_TABLE[lpIdx];

        state.int_freq -= (realBw / 2);
    }

    await writeRegMask(device, 0x0a, reg_0a, 0x10);
    await writeRegMask(device, 0x0b, reg_0b, 0xef);
};