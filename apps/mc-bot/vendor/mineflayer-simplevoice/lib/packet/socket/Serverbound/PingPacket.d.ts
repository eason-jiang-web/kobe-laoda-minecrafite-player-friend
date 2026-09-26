import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ServerboundSocketPacket } from "../SocketPacket";
export default class ServerboundPingPacket extends ServerboundSocketPacket<{}> {
    constructor(socket: dgram.Socket);
    serialize(): FriendlyByteBuf;
}
