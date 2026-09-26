import { ClientboundSecretPacketData } from "./packet/client/Clientbound/SecretPacket";
export declare namespace StoredData {
    let secretPacketData: ClientboundSecretPacketData;
    const SAMPLE_RATE = 48000;
    const CHANNELS = 1;
    const FRAME_DURATION_MS = 20;
    const BITRATE = 48000;
}
