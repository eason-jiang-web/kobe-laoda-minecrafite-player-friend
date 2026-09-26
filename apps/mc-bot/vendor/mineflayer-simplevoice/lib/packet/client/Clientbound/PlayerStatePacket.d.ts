import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../../data/FriendlyByteBuf";
import { ClientboundPacket } from "../Packet";
export type ClientboundPlayerStatePacketData = {
    disabled: boolean;
    disconnected: boolean;
    playerUUID: UUID;
    name: string;
    group: UUID | undefined;
};
export default class ClientboundPlayerStatePacket extends ClientboundPacket<ClientboundPlayerStatePacketData> {
    constructor(bot: Bot);
    deserialize(data: FriendlyByteBuf): ClientboundPlayerStatePacketData;
}
