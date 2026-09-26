import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ServerboundSocketPacket } from "../SocketPacket";
export default class ServerboundConnectionCheckPacket extends ServerboundSocketPacket<{}> {
    constructor(socket: dgram.Socket);
    protected serialize(): FriendlyByteBuf;
}
