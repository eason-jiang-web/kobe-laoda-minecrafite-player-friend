import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundPacket } from "../Packet";
export type ClientboundAddGroupPacketData = {
    id: UUID;
    name: string;
    hasPassword: boolean;
    persistent: boolean;
    hidden: boolean;
    type: number;
};
export default class ClientboundAddGroupPacket extends ClientboundPacket<ClientboundAddGroupPacketData> {
    constructor(bot: Bot);
    deserialize(data: FriendlyByteBuf): ClientboundAddGroupPacketData;
}
