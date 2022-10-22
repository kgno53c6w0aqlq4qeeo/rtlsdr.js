import * as r820t from './r820t';

export interface TunerInfo {
    id: string,
    name: string,
    i2c_addr: number,
    check_addr: number,
    check_val: number
}

export const KNOWN_TUNERS: TunerInfo[] = [r820t.TUNER_INFO];

export default {
    tuners: {
        r820t
    }
}