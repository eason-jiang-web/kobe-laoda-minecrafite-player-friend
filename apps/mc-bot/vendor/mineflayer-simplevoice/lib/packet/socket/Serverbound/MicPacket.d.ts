import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ServerboundSocketPacket } from "../SocketPacket";
export type ServerboundMicPacketData = {
    data: Uint8Array;
    whispering: boolean;
    sequenceNumber: bigint;
};
export default class ServerboundMicPacket extends ServerboundSocketPacket<ServerboundMicPacketData> {
    constructor(socket: dgram.Socket);
    protected serialize(data: ServerboundMicPacketData): FriendlyByteBuf;
}
