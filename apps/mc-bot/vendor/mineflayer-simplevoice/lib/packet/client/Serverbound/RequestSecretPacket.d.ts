import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ServerboundPacket } from "../Packet";
export type ServerboundRequestSecretPacketData = {
    compatibilityVersion: number;
};
export default class ServerboundRequestSecretPacket extends ServerboundPacket<ServerboundRequestSecretPacketData> {
    constructor(bot: Bot);
    serialize(data: ServerboundRequestSecretPacketData): FriendlyByteBuf;
}
