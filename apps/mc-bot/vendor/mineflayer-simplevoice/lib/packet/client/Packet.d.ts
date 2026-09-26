import { EventEmitter } from "events";
import { Bot } from "mineflayer";
import { FriendlyByteBuf } from "../../data/FriendlyByteBuf";
export declare abstract class ClientboundPacket<T extends Object> extends EventEmitter {
    private readonly bot;
    private readonly channel;
    private readonly name;
    constructor(bot: Bot, channel: string, name: string);
    abstract deserialize(data: FriendlyByteBuf): T;
}
export declare abstract class ServerboundPacket<T extends Object> {
    private readonly bot;
    private readonly channel;
    private readonly name;
    constructor(bot: Bot, channel: string, name: string);
    protected abstract serialize(data: T): FriendlyByteBuf;
    send(data: T): void;
}
