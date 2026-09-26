import dgram from "dgram";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundSocketPacket } from "../SocketPacket";
export default class ClientboundKeepAlivePacket extends ClientboundSocketPacket<{}> {
    constructor(socket: dgram.Socket);
    deserialize(data: FriendlyByteBuf): {};
}
