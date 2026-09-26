import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundPacket } from "../Packet";
export type ClientboundRemoveGroupPacketData = {
    id: UUID;
};
export default class ClientboundRemoveGroupPacket extends ClientboundPacket<ClientboundRemoveGroupPacketData> {
    constructor(bot: Bot);
    deserialize(data: FriendlyByteBuf): ClientboundRemoveGroupPacketData;
}
