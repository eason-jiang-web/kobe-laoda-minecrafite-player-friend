import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ServerboundSocketPacket } from "../SocketPacket";
export type ServerboundAuthenticatePacketData = {
    playerUUID: UUID;
    secret: UUID;
};
export default class ServerboundAuthenticatePacket extends ServerboundSocketPacket<ServerboundAuthenticatePacketData> {
    constructor(socket: dgram.Socket);
    protected serialize(data: ServerboundAuthenticatePacketData): FriendlyByteBuf;
}
