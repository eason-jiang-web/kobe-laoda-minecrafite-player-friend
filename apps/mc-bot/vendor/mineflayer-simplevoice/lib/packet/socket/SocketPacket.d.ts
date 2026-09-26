import dgram from "dgram";
import EventEmitter from "events";
import { FriendlyByteBuf } from "../../data/FriendlyByteBuf";
export declare abstract class ClientboundSocketPacket<T extends Object> extends EventEmitter {
    private readonly socket;
    private readonly index;
    private readonly name;
    constructor(socket: dgram.Socket, index: number, name: string);
    abstract deserialize(data: FriendlyByteBuf): T;
}
export declare abstract class ServerboundSocketPacket<T extends Object> {
    private readonly socket;
    protected readonly index: number;
    private readonly name;
    constructor(socket: dgram.Socket, index: number, name: string);
    protected abstract serialize(data: T): FriendlyByteBuf;
    send(data: T): void;
}
