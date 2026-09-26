import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundPacket } from "../Packet";
import { ClientboundPlayerStatePacketData } from "./PlayerStatePacket";
export type ClientboundPlayerStatesPacketData = Map<string, ClientboundPlayerStatePacketData>;
export default class ClientboundPlayerStatesPacket extends ClientboundPacket<ClientboundPlayerStatesPacketData> {
    constructor(bot: Bot);
    deserialize(data: FriendlyByteBuf): ClientboundPlayerStatesPacketData;
}
