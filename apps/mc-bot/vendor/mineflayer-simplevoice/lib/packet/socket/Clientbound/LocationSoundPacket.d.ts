import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundSocketPacket } from "../SocketPacket";
export type LocationSoundPacketData = {
    channelId: UUID;
    sender: UUID;
    location: {
        x: number;
        y: number;
        z: number;
    };
    data: Uint8Array<ArrayBufferLike>;
    sequenceNumber: bigint;
    distance: number;
    category?: string;
};
export default class ClientboundLocationSoundPacket extends ClientboundSocketPacket<LocationSoundPacketData> {
    constructor(socket: dgram.Socket);
    protected hasFlag(data: number, mask: number): boolean;
    deserialize(data: FriendlyByteBuf): LocationSoundPacketData;
}
