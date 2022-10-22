// https://github.com/ccostes/rtl-sdr-rs/blob/main/src/device/mod.rs

import deviceHandle from './device-handle';
import {
    USBRecipient,
    USBRequestType,
    BLOCK_USB,
    USB_SYSCTL,
    EEPROM_SIZE,
    BLOCK_IIC,
    EEPROM_ADDR,
    USBTransferStatus
} from './constants';
import { buf2hex, toBigEndian, toUint } from './utils';
import { buffer } from 'stream/consumers';

interface ParsedReadResponse {
    status: string | undefined,
    data: number | undefined,
    buffer: ArrayBuffer | undefined
}

const init = async (device: USBDevice): Promise<USBDevice> => {
    await deviceHandle.open(device);
    await deviceHandle.selectConfiguration(device);
    await deviceHandle.claimInterfaces(device);
    return device
};

const close = async (device: USBDevice): Promise<void> => await deviceHandle.close(device);

const testWrite = async (device: USBDevice): Promise<USBOutTransferResult> => {
    // try a dummy write and reset device if it fails
    const writeOp = await writeReg(device, BLOCK_USB, USB_SYSCTL, 0x09, 1);
    if (writeOp.bytesWritten == 0 || writeOp.status !== USBTransferStatus.OK) {
        console.log('Resetting device...');
        await deviceHandle.reset(device);
        throw new Error('test write failed');
    }
    return writeOp;
};

const resetDemod = async (device: USBDevice) => {
    await demodWriteReg(device, 0x1, 0x01, 0x14, 1);
    await demodWriteReg(device, 0x1, 0x01, 0x10, 1);
};

const readReg = async (device: USBDevice, block: number, addr: number, len: number): Promise<ParsedReadResponse> => {
    if (len !== 1 && len !== 2) {
        throw new Error('length not valid');
    }
    const index: number = block << 8;
    // Missing parsing as little endian
    const res =  await device.controlTransferIn({
        requestType: USBRequestType.VENDOR,
        recipient: USBRecipient.DEVICE,
        request: 0,
        value: addr,
        index,
    }, len);

    return {
        status: res.status,
        buffer: res?.data?.buffer,
        data: res?.data?.buffer ? buf2hex(res?.data?.buffer) : undefined
    };
}

/// TODO: This only supports len of 1 or 2, maybe use an enum or make this generic?
const writeReg = async (device: USBDevice, block: number, addr: number, val: number, len: number): Promise<USBOutTransferResult> => {
    console.log('writeReg', {
        block,
        addr,
        val,
        len,
    });
    if (len !== 1 && len !== 2) {
        throw new Error('length not valid');
    }
    let data: Array<number> = toBigEndian(val);
    if (data.length == 0) {
        data = [val];
    }
    const dataSlice: Array<number> = len == 1 ? data.slice(0, 1) : data;
    const bufferData = new Uint8Array(dataSlice);
    const index: number = block << 8 | 0x10;

    const res = await deviceHandle.controlTransferOut(device, {
        requestType: USBRequestType.VENDOR,
        recipient: USBRecipient.DEVICE,
        request: 0,
        value: addr,
        index,
    }, bufferData.buffer);

    // Refactor to enum
    if (res.status !== 'ok') {
        console.error(res);
        throw new Error('write error');
    }

    return res;
}

const demodReadReg = async (device: USBDevice, page: number, addr: number): Promise<ParsedReadResponse> => {
    const len = 1;
    const res = await deviceHandle.controlTransferIn(device, {
        requestType: USBRequestType.VENDOR,
        recipient: USBRecipient.DEVICE,
        request: 0,
        value: (addr << 8) | 0x20,
        index: page,
    }, len);

    return {
        status: res.status,
        buffer: res?.data?.buffer,
        data: res?.data?.buffer ? buf2hex(res?.data?.buffer) : undefined
    };
}

const demodWriteReg = async (device: USBDevice, page: number, addr: number, val: number, len: number): Promise<USBInTransferResult> => {
    if (len !== 1 && len !== 2) {
        throw new Error('length not valid');
    }
    const index = 0x10 | page;
    const newAddress = (addr << 8) | 0x20;

    let data: Array<number> = toBigEndian(val);
    if (data.length == 0) {
        data = [val];
    }
    const dataSlice: Array<number> = len == 1 ? data.slice(0, 1) : data;
    const bufferData = new Uint8Array(dataSlice.length);
    bufferData.set(dataSlice)

    console.log('demodWriteReg', {
        page,
        addr: newAddress,
        val,
        len,
        index,
        bufferData,
        dataSlice
    });

    const res = await deviceHandle.controlTransferOut(device, {
        requestType: USBRequestType.VENDOR,
        recipient: USBRecipient.DEVICE,
        request: 0,
        value: newAddress,
        index,
    }, bufferData.buffer);

    // Refactor to enum
    if (res.status !== 'ok') {
        console.error(res);
        throw new Error('write error');
    }

    await demodReadReg(device, 0x0a, 1);

    return res;
}

const bulkTransfer = async (device: USBDevice, len: number): Promise<{status: string | undefined, data: DataView | undefined}> => {
    const res = await deviceHandle.transferIn(device, len);

    return {
        status: res?.status,
        data: res?.data,
    };
}

const readEeprom = async (device: USBDevice, offset: number, len: number): Promise<{len: number, data: number[]}> => {
    if ((len + offset) > EEPROM_SIZE) {
        throw new Error('length not valid');
    }

    await writeArray(device, BLOCK_IIC, EEPROM_ADDR, [offset], 1);

    let resData: number[] = [];

    for (let i=0; i<len; i++) {
        const response = await readArray(device, BLOCK_IIC, EEPROM_ADDR, 1);
        if (response.data) {
            resData[i] = toUint(8, response.data)
        }
    }

    return {
        len,
        data: resData
    };
}

const i2cReadReg = async (device: USBDevice, i2cAddr: number, reg: number): Promise<ParsedReadResponse> => {
    const regArr: number[] = [reg];
    await writeArray(device, BLOCK_IIC, i2cAddr, regArr, 1);
    return await readArray(device, BLOCK_IIC, i2cAddr, 1);
}

const i2cWrite = async (device: USBDevice, i2cAddr: number, buffer: number[]) => {
    return await writeArray(device, BLOCK_IIC, i2cAddr, buffer, buffer.length);
}

const i2cRead = async (device: USBDevice, i2cAddr: number, len: number) => {
    return await readArray(device, BLOCK_IIC, i2cAddr, len);
}

const readArray = async (device: USBDevice, block: number, addr: number, len: number): Promise<ParsedReadResponse> => {
    const index: number = block << 8;
    const res = await deviceHandle.controlTransferIn(device, {
        requestType: USBRequestType.VENDOR,
        recipient: USBRecipient.DEVICE,
        request: 0,
        value: addr,
        index,
    }, len);

    return {
        status: res.status,
        buffer: res?.data?.buffer,
        data: res?.data?.buffer ? buf2hex(res?.data?.buffer) : undefined
    };
}

const writeArray = async (device: USBDevice, block: number, addr: number, arr: number[], len: number) => {
    const index: number = (block << 8) | 0x10;
    const dataSlice: Array<number> = arr.slice(0, len);
    const bufferData = new Uint8Array(dataSlice);
    const res = await deviceHandle.controlTransferOut(device, {
        requestType: USBRequestType.VENDOR,
        recipient: USBRecipient.DEVICE,
        request: 0,
        value: addr,
        index,
    }, bufferData.buffer);

    console.log('writeArray', {
        block,
        addr,
        arr,
        len,
        index,
    });

    // Refactor to enum
    if (res.status !== 'ok') {
        console.error(res);
        throw new Error('write error');
    }

    return res;
};

export default {
    init,
    close,
    testWrite,
    resetDemod,
    readReg,
    writeReg,
    demodReadReg,
    demodWriteReg,
    bulkTransfer,
    readEeprom,
    i2cReadReg,
    i2cWrite,
    i2cRead,
    readArray,
    writeArray
}