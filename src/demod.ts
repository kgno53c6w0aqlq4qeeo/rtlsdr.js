import * as math from 'mathjs';

import { Complex } from 'mathjs';
import { toInt } from './rtlsdr/utils';

interface State {
    config: any;
    prev_index: number;
    now_lpr: number;
    prev_lpr_index: number;
    lp_now: Complex; // not sure
    demod_pre: Complex; // not sure
}

const state: State = {
    config: {},
    prev_index: 0,
    now_lpr: 0,
    prev_lpr_index: 0,
    lp_now: math.complex(0, 0),
    demod_pre: math.complex(0, 0),
};

onmessage = ({data}) => postMessage(demodulate(data[0], data[1]));

const demodulate = (config: any, buf: ArrayBuffer): Int16Array => {
    state.config = config;
    let buffer = new Uint8Array(buf);
    buffer = rotate90(buffer);

    const bufSigned = Array.from(buffer).map(i => i - 127);

    const complex = bufToComplex(bufSigned);    

    // low-pass filter to downsample to our desired sample rate
    let lowpassed = lowPassComplex(complex);

    // Demodulate FM signal
    let demodulated = fmDemod(lowpassed);

    // Resample and return result
    let output = lowPassReal(demodulated);

     return new Int16Array(output);
};

/// Applies a low-pass filter to a vector of real-valued data
const lowPassReal = (buf: Int16Array) => {
    let result: number[] = [];
    // Simple square-window FIR
    let slow = state.config.rate_resample;
    let fast = state.config.rate_out;
    let i = 0;

    while (i < buf.length) {
        state.now_lpr += buf[i];
        i += 1;
        state.prev_lpr_index += slow;
        if (state.prev_lpr_index < fast) {
            continue;
        }
        const push = Math.trunc(state.now_lpr / Math.trunc(fast / slow));
        // console.log({
        //     now_lpr: state.now_lpr,
        //     fast,
        //     slow,
        //     i,
        //     buf_i: buf[i],
        //     buf,
        //     push: Math.trunc(state.now_lpr / Math.trunc(fast / slow))
        // });
        // if (i == 11) {
        //     throw new Error('stop');
        // }

        result.push(push);
        state.prev_lpr_index -= toInt(32, fast);
        state.now_lpr = 0;
    }
    return result;
};

/// Performs FM demodulation on a vector of complex input data
const fmDemod = (buf: Complex[]): Int16Array => {
    if (buf.length < 1) {
        throw new Error('wrong buffer length');
    }

    let result: number[] = [];
    let pcm = polarDiscriminant(buf[0], state.demod_pre);
    result.push(pcm);
    for (let i=1; i<buf.length; i++) {
        pcm = polarDiscriminantFast(buf[i], buf[i - 1]);
        result.push(pcm);
    }

    const lastComplex = buf.at(-1);
    if (!lastComplex) {
        throw new Error('last complex not found');
    }
    state.demod_pre = lastComplex.clone();

    return new Int16Array(result);
};

/// Find the polar discriminant for a pair of complex values using a fast atan2 approximation
const polarDiscriminantFast = (a: Complex, b: Complex): number => {
    const c: any = math.multiply(a, math.conj(b));
    return fastAtan2(c.im, c.re);
}

/// Fast atan2 approximation
const fastAtan2 = (y: number, x: number) => {
    // Pre-scaled for i16
    // pi = 1 << 14
    let pi4 = 1 << 12;
    let pi34 = 3 * (1 << 12);
    if (x == 0 && y == 0) {
        return 0;
    }
    let yabs = y;
    if (yabs < 0) {
        yabs = -yabs;
    }
    let angle;
    let part1;
    if (x >= 0) {
        part1 = toInt(32, toInt(64, pi4) * toInt(64, x - yabs));
        angle = pi4 - Math.trunc(part1 / (x + yabs));
    } else {
        part1 = toInt(32, toInt(64, pi4) * toInt(64, x + yabs))
        angle = pi34 -  Math.trunc(part1 / (yabs - x));
    }
    if (y < 0) {
        return -angle;
    }

    return Math.round(angle);
};


/// Find the polar discriminant for a pair of complex values using real atan2 function
const polarDiscriminant = (a: Complex, b: Complex): number => {
    const c: any = math.multiply(a, math.conj(b));
    let angle = math.atan2(c.im, c.re);
    return angle / math.pi * (1 << 14);
}



/// Applies a low-pass filter on a vector of complex values
const lowPassComplex = (buf: Complex[]) => {
    let res: Complex[] = [];
    for (let orig=0; orig<buf.length; orig++) {
        state.lp_now = math.add(state.lp_now, buf[orig])

        state.prev_index += 1;
        if (state.prev_index < state.config.downsample) {
            continue;
        }

        res.push(state.lp_now);
        state.lp_now = math.complex(0, 0);
        state.prev_index = 0;
    }
    return res;
};

/// Convert a vector of i16 complex components (real and imaginary) to a vector of i32 Complex values
const bufToComplex = (buf: number[]): Complex[] => {
    const complex: Complex[] = [];
    const chunkSize = 2;
    for (let i = 0; i < buf.length; i += chunkSize) {
        const chunk = buf.slice(i, i + chunkSize);
        complex.push(math.complex(chunk[0], chunk[1]))
    }

   return complex;
};

const rotate90 = (buf: ArrayBuffer): Uint8Array => {
    const u8Buf = new Uint8Array(buf);
    /* 90 rotation is 1+0j, 0+1j, -1+0j, 0-1j
    or [0, 1, -3, 2, -4, -5, 7, -6] */
    let tmp;
    
    for (let i=0; i<buf.byteLength; i+=8) {
        /* uint8_t negation = 255 - x */
        tmp = 255 - u8Buf[i + 3];
        u8Buf[i + 3] = u8Buf[i + 2];
        u8Buf[i + 2] = tmp;

        u8Buf[i + 4] = 255 - u8Buf[i + 4];
        u8Buf[i + 5] = 255 - u8Buf[i + 5];

        tmp = 255 - u8Buf[i + 6];
        u8Buf[i + 6] = u8Buf[i + 7];
        u8Buf[i + 7] = tmp;
    }
    return u8Buf
};

export default {
    demodulate
}