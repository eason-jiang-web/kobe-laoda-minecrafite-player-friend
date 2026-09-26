"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerboundPacket = exports.ClientboundPacket = void 0;
const events_1 = require("events");
const FriendlyByteBuf_1 = require("../../data/FriendlyByteBuf");
const lib_1 = require("../../lib");
class ClientboundPacket extends events_1.EventEmitter {
    bot;
    channel;
    name;
    constructor(bot, channel, name) {
        bot._client.on(channel, (raw) => {
            const buf = new FriendlyByteBuf_1.FriendlyByteBuf(raw);
            const data = this.deserialize(buf);
            lib_1.log.getSubLogger({ name: "Client" }).debug(`RECEIVE ${this.name}`);
            lib_1.log.getSubLogger({ name: "Client" }).silly(data);
            this.emit("packet", data);
        });
        super();
        this.bot = bot;
        this.channel = channel;
        this.name = name;
    }
}
exports.ClientboundPacket = ClientboundPacket;
class ServerboundPacket {
    bot;
    channel;
    name;
    constructor(bot, channel, name) {
        this.bot = bot;
        this.channel = channel;
        this.name = name;
    }
    send(data) {
        lib_1.log.getSubLogger({ name: "Client" }).debug(`SEND ${this.name}`);
        lib_1.log.getSubLogger({ name: "Client" }).silly(data);
        this.bot._client.write("custom_payload", {
            channel: this.channel,
            data: Buffer.from(this.serialize(data).getAllBytes()),
        });
    }
}
exports.ServerboundPacket = ServerboundPacket;
