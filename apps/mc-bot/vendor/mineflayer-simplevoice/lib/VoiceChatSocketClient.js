"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dgram_1 = __importDefault(require("dgram"));
const events_1 = require("events");
const lib_1 = require("./lib");
const AuthenticateAckPacket_1 = __importDefault(require("./packet/socket/Clientbound/AuthenticateAckPacket"));
const ConnectionCheckAckPacket_1 = __importDefault(require("./packet/socket/Clientbound/ConnectionCheckAckPacket"));
const GroupSoundPacket_1 = __importDefault(require("./packet/socket/Clientbound/GroupSoundPacket"));
const KeepAlivePacket_1 = __importDefault(require("./packet/socket/Clientbound/KeepAlivePacket"));
const LocationSoundPacket_1 = __importDefault(require("./packet/socket/Clientbound/LocationSoundPacket"));
const PingPacket_1 = __importDefault(require("./packet/socket/Clientbound/PingPacket"));
const PlayerSoundPacket_1 = __importDefault(require("./packet/socket/Clientbound/PlayerSoundPacket"));
const AuthenticatePacket_1 = __importDefault(require("./packet/socket/Serverbound/AuthenticatePacket"));
const ConnectionCheckPacket_1 = __importDefault(require("./packet/socket/Serverbound/ConnectionCheckPacket"));
const KeepAlivePacket_2 = __importDefault(require("./packet/socket/Serverbound/KeepAlivePacket"));
const MicPacket_1 = __importDefault(require("./packet/socket/Serverbound/MicPacket"));
const PingPacket_2 = __importDefault(require("./packet/socket/Serverbound/PingPacket"));
const StoredData_1 = require("./StoredData");
class VoiceChatSocketClient extends events_1.EventEmitter {
    bot;
    socket;
    packets;
    logger = lib_1.log.getSubLogger({ name: "Socket" });
    constructor(bot) {
        super();
        this.bot = bot;
        this.logger.debug("Initializing SimpleVoiceSocketClient");
    }
    connect() {
        if (this.socket) {
            this.close();
        }
        this.socket = dgram_1.default.createSocket("udp4");
        this.setupSocketListeners();
        let ip;
        let port;
        if (StoredData_1.StoredData.secretPacketData.voiceHost != "") {
            if (StoredData_1.StoredData.secretPacketData.voiceHost.includes(":")) {
                ip = StoredData_1.StoredData.secretPacketData.voiceHost.split(":")[0];
                port = parseInt(StoredData_1.StoredData.secretPacketData.voiceHost.split(":")[1]);
            }
            else {
                ip = StoredData_1.StoredData.secretPacketData.voiceHost;
                port = StoredData_1.StoredData.secretPacketData.serverPort;
            }
        }
        else {
            ip = "127.0.0.1";
            port = StoredData_1.StoredData.secretPacketData.serverPort;
        }
        this.logger.debug(`Connecting to ${ip}:${port}`);
        this.socket.connect(port, ip);
    }
    getSocket() {
        return this.socket;
    }
    isConnected() {
        return this.socket !== undefined && this.packets !== undefined;
    }
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = undefined;
            this.packets = undefined;
        }
    }
    getPackets() {
        if (!this.packets)
            throw new Error("Packet registry is not initialized");
        return this.packets;
    }
    setupSocketListeners() {
        if (!this.socket) {
            throw new Error("Socket is not initialized");
        }
        this.socket.on("connect", () => {
            this.logger.debug("Connected to the socket");
            this.initializePackets();
            this.emit("connect");
        });
        this.socket.on("close", () => {
            this.logger.warn("Socket closed");
            this.close();
            this.emit("close");
        });
        this.socket.on("error", (err) => {
            this.logger.fatal(`Socket error: ${err.message}`);
            this.close();
            this.emit("error", err);
        });
    }
    initializePackets() {
        if (!this.socket) {
            throw new Error("Socket is not initialized");
        }
        this.packets = {
            authenticatePacket: new AuthenticatePacket_1.default(this.socket),
            authenticateAckPacket: new AuthenticateAckPacket_1.default(this.socket),
            connectionCheckPacket: new ConnectionCheckPacket_1.default(this.socket),
            connectionCheckAckPacket: new ConnectionCheckAckPacket_1.default(this.socket),
            pingPacket: new PingPacket_1.default(this.socket),
            clientboundKeepAlivePacket: new KeepAlivePacket_1.default(this.socket),
            serverboundKeepAlivePacket: new KeepAlivePacket_2.default(this.socket),
            clientboundPingPacket: new PingPacket_1.default(this.socket),
            serverboundPingPacket: new PingPacket_2.default(this.socket),
            playerSoundPacket: new PlayerSoundPacket_1.default(this.socket),
            groupSoundPacket: new GroupSoundPacket_1.default(this.socket),
            locationSoundPacket: new LocationSoundPacket_1.default(this.socket),
            micPacket: new MicPacket_1.default(this.socket),
        };
        this.logger.debug("Packet registry initialized");
    }
}
exports.default = VoiceChatSocketClient;
