import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ServerboundPacket } from "../Packet";
export default class ServerboundLeaveGroupPacket extends ServerboundPacket<{}> {
    constructor(bot: Bot);
    serialize(): FriendlyByteBuf;
}
