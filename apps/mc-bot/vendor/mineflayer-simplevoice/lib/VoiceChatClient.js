"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const opus_1 = require("./opus-shim");
const lib_1 = require("./lib");
const AddGroupPacket_1 = __importDefault(require("./packet/client/Clientbound/AddGroupPacket"));
const JoinedGroupPacket_1 = __importDefault(require("./packet/client/Clientbound/JoinedGroupPacket"));
const PlayerStatePacket_1 = __importDefault(require("./packet/client/Clientbound/PlayerStatePacket"));
const PlayerStatesPacket_1 = __importDefault(require("./packet/client/Clientbound/PlayerStatesPacket"));
const RemoveGroupPacket_1 = __importDefault(require("./packet/client/Clientbound/RemoveGroupPacket"));
const SecretPacket_1 = __importDefault(require("./packet/client/Clientbound/SecretPacket"));
const LeaveGroupPacket_1 = __importDefault(require("./packet/client/Serverbound/LeaveGroupPacket"));
const RequestSecretPacket_1 = __importDefault(require("./packet/client/Serverbound/RequestSecretPacket"));
const SetGroupPacket_1 = __importDefault(require("./packet/client/Serverbound/SetGroupPacket"));
const StoredData_1 = require("./StoredData");
const utils_1 = require("./utils");
const VoiceChatSocketClient_1 = __importDefault(require("./VoiceChatSocketClient"));
class VoiceChatClient {
    bot;
    compatibilityVersion = 18;
    socketClient;
    logger = lib_1.log.getSubLogger({ name: "VoiceClient" });
    opusEncoder = new opus_1.OpusEncoder(StoredData_1.StoredData.SAMPLE_RATE, StoredData_1.StoredData.CHANNELS);
    packets;
    connected = false;
    players = new Map();
    groups = new Map();
    constructor(bot) {
        this.bot = bot;
        this.opusEncoder.setBitrate(StoredData_1.StoredData.BITRATE);
        this.socketClient = new VoiceChatSocketClient_1.default(bot);
        this.packets = this.initializePackets();
        this.setupEvents();
    }
    getSocketClient() {
        return this.socketClient;
    }
    isConnected() {
        return this.connected;
    }
    getPlayers() {
        return this.players;
    }
    getGroups() {
        return this.groups;
    }
    getNameBySenderID(senderID) {
        const player = this.players.get(senderID);
        return player?.name;
    }
    getIdByName(username) {
        for (const [id, player] of this.players) {
            if (player.name === username) {
                return id;
            }
        }
        return undefined;
    }
    initializePackets() {
        return {
            requestSecretPacket: new RequestSecretPacket_1.default(this.bot),
            secretPacket: new SecretPacket_1.default(this.bot),
            playerStatePacket: new PlayerStatePacket_1.default(this.bot),
            playerStatesPacket: new PlayerStatesPacket_1.default(this.bot),
            addGroupPacket: new AddGroupPacket_1.default(this.bot),
            setGroupPacket: new SetGroupPacket_1.default(this.bot),
            removeGroupPacket: new RemoveGroupPacket_1.default(this.bot),
            leaveGroupPacket: new LeaveGroupPacket_1.default(this.bot),
            joinedGroupPacket: new JoinedGroupPacket_1.default(this.bot),
        };
    }
    getPackets() {
        return this.packets;
    }
    registerChannels() {
        this.logger.debug("Registering channels");
        const channels = [
            "voicechat:secret",
            "voicechat:player_state",
            "voicechat:player_states",
            "voicechat:set_group",
            "voicechat:add_group",
            "voicechat:remove_group",
            "voicechat:leave_group",
            "voicechat:joined_group",
            "voicechat:main",
        ];
        for (const channel of channels) {
            this.bot._client.registerChannel(channel, undefined, true);
        }
    }
    setupEvents() {
        this.logger.debug("Setting up events");
        this.bot.once("login", () => {
            this.registerChannels();
        });
        this.bot._client.on("state", (state) => {
            if (state == "play") {
                setTimeout(() => {
                    this.packets.requestSecretPacket.send({
                        compatibilityVersion: this.compatibilityVersion,
                    });
                }, 1000);
            }
            else {
                this.connected = false;
                this.socketClient.close();
            }
        });
        this.packets.secretPacket.on("packet", (data) => {
            this.players.clear();
            this.groups.clear();
            StoredData_1.StoredData.secretPacketData = data;
            // this.socketClient.close();
            this.socketClient.connect();
            this.socketClient.once("connect", () => {
                this.setupSocketEvents();
            });
            this.socketClient.on("connect", () => {
                this.logger.debug("Connected to socket, sending authentication");
                const connector = setInterval(() => {
                    if (!this.socketClient.isConnected() || this.connected) {
                        clearInterval(connector);
                    }
                    this.socketClient.getPackets().authenticatePacket.send({
                        playerUUID: StoredData_1.StoredData.secretPacketData.playerUUID,
                        secret: StoredData_1.StoredData.secretPacketData.secret,
                    });
                }, 500);
            });
            this.socketClient.on("close", () => {
                this.connected = false;
            });
            this.socketClient.on("error", () => {
                this.connected = false;
            });
        });
        this.packets.playerStatePacket.on("packet", (data) => {
            this.players.set(utils_1.Utils.uuidToString(data.playerUUID), data);
        });
        this.packets.playerStatesPacket.on("packet", (data) => {
            this.players = data;
        });
        this.packets.addGroupPacket.on("packet", (data) => {
            const groupId = utils_1.Utils.uuidToString(data.id);
            this.groups.set(groupId, data);
            this.bot.emit("voicechat_group_add", {
                id: groupId,
                name: data.name,
                hasPassword: data.hasPassword,
                persistent: data.persistent,
                hidden: data.hidden,
                type: data.type,
            });
        });
        this.packets.removeGroupPacket.on("packet", (data) => {
            const groupId = utils_1.Utils.uuidToString(data.id);
            this.groups.delete(groupId);
            this.bot.emit("voicechat_group_remove", { id: groupId });
        });
        this.logger.debug("Event listeners registered");
    }
    setupSocketEvents() {
        // [patched] 这个方法是在"每次收到密钥包"时被调用的，上游没有防重入 ——
        // 密钥包来两次，同一个音频包就会被 emit 两次，机器人那边会把音频拼重、
        // 识别也会重复。所以这里只注册一次。
        if (this._socketEventsReady) {
            this.logger.debug("Socket events already registered, skipping");
            return;
        }
        this._socketEventsReady = true;
        const socketPackets = this.socketClient.getPackets();
        if (!socketPackets) {
            this.logger.error("Socket packets not initialized");
            return;
        }
        socketPackets.authenticateAckPacket.on("packet", () => {
            socketPackets.connectionCheckPacket.send({});
        });
        socketPackets.connectionCheckAckPacket.on("packet", () => {
            if (!this.connected) {
                this.connected = true;
                this.bot.emit("voicechat_connect");
            }
        });
        socketPackets.clientboundKeepAlivePacket.on("packet", () => {
            socketPackets.serverboundKeepAlivePacket.send({});
        });
        socketPackets.clientboundPingPacket.on("packet", () => {
            socketPackets.serverboundPingPacket.send({});
        });
        socketPackets.playerSoundPacket.on("packet", (data) => {
            // [patched] 解码一个坏包不该把整条音频流打死：解不出来就发原包，
            // 上层会忽略它（原来这里一抛异常，整个 socket 处理就断了）。
            let decoded;
            try {
                decoded = this.opusEncoder.decode(data.data);
            }
            catch (e) {
                exports.log.warn("opus decode failed, forwarding raw packet: " + e.message);
                decoded = Buffer.alloc(0);
            }
            this.bot.emit("voicechat_player_sound", {
                ...data,
                data: decoded,
                raw: data.data,
                channelId: utils_1.Utils.uuidToString(data.channelId),
                sender: this.getNameBySenderID(utils_1.Utils.uuidToString(data.sender)),
            });
        });
        socketPackets.locationSoundPacket.on("packet", (data) => {
            this.bot.emit("voicechat_location_sound", {
                ...data,
                data: this.opusEncoder.decode(data.data),
                raw: data.data,
                channelId: utils_1.Utils.uuidToString(data.channelId),
                sender: this.getNameBySenderID(utils_1.Utils.uuidToString(data.sender)),
            });
        });
        socketPackets.groupSoundPacket.on("packet", (data) => {
            this.bot.emit("voicechat_group_sound", {
                ...data,
                data: this.opusEncoder.decode(data.data),
                raw: data.data,
                channelId: utils_1.Utils.uuidToString(data.channelId),
                sender: this.getNameBySenderID(utils_1.Utils.uuidToString(data.sender)),
            });
        });
    }
}
exports.default = VoiceChatClient;
