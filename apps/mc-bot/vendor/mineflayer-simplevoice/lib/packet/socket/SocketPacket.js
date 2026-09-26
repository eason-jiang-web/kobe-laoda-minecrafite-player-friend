"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerboundSocketPacket = exports.ClientboundSocketPacket = void 0;
const events_1 = __importDefault(require("events"));
const AESEncryption_1 = require("../../AESEncryption");
const FriendlyByteBuf_1 = require("../../data/FriendlyByteBuf");
const lib_1 = require("../../lib");
const StoredData_1 = require("../../StoredData");
const MAGIC_BYTE = 0xff;
class ClientboundSocketPacket extends events_1.default {
    socket;
    index;
    name;
    constructor(socket, index, name) {
        super();
        this.socket = socket;
        this.index = index;
        this.name = name;
        this.socket.on("message", (raw) => {
            const buf = new FriendlyByteBuf_1.FriendlyByteBuf(raw);
            if (buf.readByte() !== MAGIC_BYTE)
                return;
            const rawPayload = buf.readByteArray();
            const payload = new FriendlyByteBuf_1.FriendlyByteBuf(AESEncryption_1.AESEncryption.decrypt(Buffer.from(rawPayload)));
            const index = payload.readByte();
            if (this.index != index)
                return;
            const data = this.deserialize(payload);
            lib_1.log.getSubLogger({ name: "Socket" }).debug(`RECEIVE ${this.name}`);
            lib_1.log.getSubLogger({ name: "Socket" }).silly(data);
            this.emit("packet", data);
        });
    }
}
exports.ClientboundSocketPacket = ClientboundSocketPacket;
class ServerboundSocketPacket {
    socket;
    index;
    name;
    constructor(socket, index, name) {
        this.socket = socket;
        this.index = index;
        this.name = name;
    }
    send(data) {
        lib_1.log.getSubLogger({ name: "Socket" }).debug(`SEND ${this.name}`);
        lib_1.log.getSubLogger({ name: "Socket" }).silly(data);
        // Create single buffer with packet data
        const buf = new FriendlyByteBuf_1.FriendlyByteBuf();
        buf.writeByte(MAGIC_BYTE);
        buf.writeUUID(StoredData_1.StoredData.secretPacketData.playerUUID);
        const packetbuf = new FriendlyByteBuf_1.FriendlyByteBuf();
        packetbuf.writeByte(this.index);
        packetbuf.writeBytes(Buffer.from(this.serialize(data).getAllBytes()));
        const payload = Buffer.from(packetbuf.getAllBytes());
        buf.writeByteArray(AESEncryption_1.AESEncryption.encrypt(payload));
        // Send encrypted data
        this.socket.send(buf.getAllBytes());
    }
}
exports.ServerboundSocketPacket = ServerboundSocketPacket;
