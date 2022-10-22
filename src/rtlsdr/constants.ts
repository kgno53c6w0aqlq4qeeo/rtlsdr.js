
export const KNOWN_DEVICES = [
    {
        vendorId: 3034,
        productId: 10296,
    }
];

export const EEPROM_ADDR: number = 0xa0;
export const EEPROM_SIZE: number = 256;

// Blocks
export const BLOCK_DEMOD: number = 0;
export const BLOCK_USB: number = 1;
export const BLOCK_SYS: number = 2;
export const BLOCK_TUN: number = 3;
export const BLOCK_ROM: number = 4;
export const BLOCK_IRB: number = 5;
export const BLOCK_IIC: number = 6;

// Sys Registers
export const DEMOD_CTL: number = 0x3000;
export const GPO: number = 0x3001;
export const GPI: number = 0x3002;
export const GPOE: number = 0x3003;
export const GPD: number = 0x3004;
export const SYSINTE: number = 0x3005;
export const SYSINTS: number = 0x3006;
export const GP_CFG0: number = 0x3007;
export const GP_CFG1: number = 0x3008;
export const SYSINTE_1: number = 0x3009;
export const SYSINTS_1: number = 0x300a;
export const DEMOD_CTL_1: number = 0x300b;
export const IR_SUSPEND: number = 0x300c;

// USB Registers
export const USB_SYSCTL: number = 0x2000;
export const USB_CTRL: number = 0x2010;
export const USB_STAT: number = 0x2014;
export const USB_EPA_CFG: number = 0x2144;
export const USB_EPA_CTL: number = 0x2148;
export const USB_EPA_MAXPKT: number = 0x2158;
export const USB_EPA_MAXPKT_2: number = 0x215a;
export const USB_EPA_FIFO_CFG: number = 0x2160;

export enum USBDirection {
    IN = "in",
    OUT = "out"
}
export enum USBEndpointType {
    BULK = "bulk",
    INTERRUPT = "interrupt",
    ISOCHRONOUS = "isochronous"
}
export enum USBRequestType {
    STANDARD = "standard",
    CLASS = "class",
    VENDOR = "vendor"
}
export enum USBRecipient {
    DEVICE = "device",
    INTERFACE = "interface",
    ENDPOINT = "endpoint",
    OTHER = "other"
}
export enum USBTransferStatus {
    OK = "ok",
    STALL = "stall",
    BABBLE = "babble"
}