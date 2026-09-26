import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ServerboundPacket } from "../Packet";
export type ServerboundSetGroupPacketData = {
    group: UUID;
    password?: string;
};
export default class ServerboundSetGroupPacket extends ServerboundPacket<ServerboundSetGroupPacketData> {
    constructor(bot: Bot);
    serialize(data: ServerboundSetGroupPacketData): FriendlyByteBuf;
}
