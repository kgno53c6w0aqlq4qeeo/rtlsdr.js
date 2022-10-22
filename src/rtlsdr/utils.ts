

export const dec2hex = (n: number): Array<number> => {
    return n ? [n%256].concat(dec2hex(~~(n/256))) : [];
  }
  
export const toBigEndian = (n: number): Array<number> => {
    const hexar = dec2hex(n);
    return hexar.map(h => (h < 16 ? "0x0" : "0x") + h.toString(16))
                .concat(Array(4-hexar.length).filter(i => i)).map(i => parseInt(i)).reverse();
}

export const buf2hex = (buffer: ArrayBuffer): number => parseInt(new Array(new Uint8Array(buffer))
.map(x => x.toString().padStart(2, '0'))
.join(''));

export const toUint = (bits: number, int: number): number => parseInt(BigInt.asUintN(bits, BigInt(int)).toString());

export const toInt = (bits: number, int: number): number => parseInt(BigInt.asIntN(bits, BigInt(int)).toString());

export const fromUint = (bits: number, bigInt: bigint): number => parseInt(BigInt.asUintN(bits, bigInt).toString())