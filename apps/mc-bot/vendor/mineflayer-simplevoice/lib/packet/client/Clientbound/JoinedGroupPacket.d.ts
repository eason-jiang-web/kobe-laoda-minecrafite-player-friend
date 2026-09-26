import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundPacket } from "../Packet";
export type ClientboundJoinedGroupPacketData = {
    id?: UUID;
    wrongPassword: boolean;
};
export default class ClientboundJoinedGroupPacket extends ClientboundPacket<ClientboundJoinedGroupPacketData> {
    constructor(bot: Bot);
    deserialize(data: FriendlyByteBuf): ClientboundJoinedGroupPacketData;
}
