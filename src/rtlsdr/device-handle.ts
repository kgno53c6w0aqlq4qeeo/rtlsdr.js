import { USBDirection, USBEndpointType } from "./constants";

const open = async (device: USBDevice): Promise<void> => {
    return await device.open();
}

const close = async (device: USBDevice): Promise<void> => await device.close();

const selectConfiguration = async (device: USBDevice): Promise<void> => {
    const configurationValue = device.configuration?.configurationValue;
    if (!configurationValue) {
        throw new Error('device configuration not found');
    }
    return await device.selectConfiguration(configurationValue);
}

const claimInterfaces = async (device: USBDevice): Promise<void> => {
    const interfaces = device?.configuration?.interfaces

    if (!interfaces) {
        throw new Error('device interfaces not found');
    }

    for (let deviceInterface of interfaces) {
        await device.claimInterface(deviceInterface.interfaceNumber);
    }
}

const controlTransferOut = async (device: USBDevice, setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult> => {
    return await device.controlTransferOut(setup, data);
}

const controlTransferIn = async (device: USBDevice, setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult> => {
    return await device.controlTransferIn(setup, length);
}

const selectTransferTarget = async (device: USBDevice, endpointMatch: (endpoint: USBEndpoint) => boolean): Promise<USBEndpoint> => {
    const interfaces = device?.configuration?.interfaces;

    if (!interfaces) {
        throw new Error('device interfaces not found');
    }

    const [transferTarget] = interfaces.map(curInterface => {
        const endpoint = curInterface.alternate?.endpoints?.find(endpointMatch);
        if (!endpoint) {
            return false;
        }

        return {
            interface: curInterface,
            endpoint: endpoint
        };
    }).filter(i => i) || [];

    if (!transferTarget) {
        throw new Error('endpoint or alternate interface not found');
    }

    await device.selectAlternateInterface(transferTarget.interface.interfaceNumber, transferTarget.interface.alternate.alternateSetting);

    return transferTarget.endpoint;
}

const transferIn = async (device: USBDevice, len: number) => {
    const endpointMatch = (endpoint: USBEndpoint) => endpoint.type == USBEndpointType.BULK && endpoint.direction == USBDirection.IN;
    const target = await selectTransferTarget(device, endpointMatch);
    return await device.transferIn(target.endpointNumber, len);
};

const reset = async (device: USBDevice) => {
    await device.reset();
};


export default {
    open,
    close,
    selectConfiguration,
    claimInterfaces,
    controlTransferOut,
    controlTransferIn,
    transferIn,
    reset
}