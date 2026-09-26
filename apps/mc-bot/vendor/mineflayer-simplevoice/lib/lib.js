"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
const tslog_1 = require("tslog");
const SoundConverter_1 = __importDefault(require("./SoundConverter"));
const StoredData_1 = require("./StoredData");
const VoiceChatClient_1 = __importDefault(require("./VoiceChatClient"));
const utils_1 = require("./utils");
exports.log = new tslog_1.Logger({ minLevel: 4 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class VoiceChat {
    /** Are you sure you need this? */
    _client;
    isStreaming = false;
    isPaused = false;
    currentStreamController = null;
    sequenceNumber = 0n;
    constructor(bot) {
        this._client = new VoiceChatClient_1.default(bot);
        bot.on("voicechat_connect", () => {
            this.sequenceNumber = 0n;
        });
    }
    /** Get player voice information by username */
    getPlayer(player) {
        const uuid = this._client.getIdByName(player);
        if (!uuid)
            return undefined;
        const data = this._client.getPlayers().get(uuid);
        const playerInfo = {
            ...data,
            playerUUID: utils_1.Utils.uuidToString(data.playerUUID),
            group: data.group ? utils_1.Utils.uuidToString(data.group) : undefined,
        };
        return playerInfo;
    }
    /** Get all player voice information */
    getPlayers() {
        return Array.from(this._client.getPlayers().values()).map((data) => ({
            ...data,
            playerUUID: utils_1.Utils.uuidToString(data.playerUUID),
            group: data.group ? utils_1.Utils.uuidToString(data.group) : undefined,
        }));
    }
    /** Get group voice information by UUID */
    getGroup(uuid) {
        return this._client.getGroups().get(uuid);
    }
    /** Get all group voice information */
    getGroups() {
        return Array.from(this._client.getGroups().values()).map((data) => ({
            ...data,
            id: utils_1.Utils.uuidToString(data.id),
        }));
    }
    /** Join a voice group by name */
    joinGroup(name, password) {
        const group = Array.from(this._client.getGroups().values()).find((group) => group.name === name);
        if (!group) {
            throw new Error(`Group "${name}" not found!`);
        }
        this._client.getPackets().setGroupPacket.send({
            group: group.id,
            password,
        });
    }
    /** Join a voice group by UUID */
    joinGroupByUUID(uuid, password) {
        this._client.getPackets().setGroupPacket.send({
            group: utils_1.Utils.stringToUUID(uuid),
            password,
        });
    }
    /** Leave a voice group */
    leaveGroup() {
        this._client.getPackets().leaveGroupPacket.send({});
    }
    /** Check if the client is connected to the voice chat */
    isConnected() {
        return this._client.isConnected();
    }
    /** Stop the audio stream */
    stopAudio() {
        if (this.currentStreamController) {
            this.currentStreamController.stop();
            this.isStreaming = false;
            this.isPaused = false;
            this.currentStreamController = null;
            exports.log.info("Audio stream stopped.");
        }
    }
    /** Pause the audio stream */
    pauseAudio() {
        if (this.isStreaming &&
            !this.isPaused &&
            this.currentStreamController) {
            this.currentStreamController.pause();
            this.isPaused = true;
            exports.log.info("Audio stream paused.");
        }
    }
    /** Resume the audio stream */
    resumeAudio() {
        if (this.isStreaming && this.isPaused && this.currentStreamController) {
            this.currentStreamController.resume();
            this.isPaused = false;
            exports.log.info("Audio stream resumed.");
        }
    }
    /**
     * Send an audio file to the voice chat
     * @param audio Path to the audio file (wav, mp3, ogg, flac, etc.)
     * @throws Will throw an error if the voice chat is not connected or if another audio stream is active
     */
    async sendAudio(audio) {
        if (!this.isConnected()) {
            throw exports.log.error("Voice chat is not loaded!");
        }
        if (this.isStreaming) {
            throw exports.log.error("Another audio stream is already active!");
        }
        const pcmBuffer = await SoundConverter_1.default.convertToPCM(audio, StoredData_1.StoredData.SAMPLE_RATE, StoredData_1.StoredData.CHANNELS);
        await this.sendPCM(pcmBuffer);
    }
    /**
     * Send a raw PCM buffer to the voice chat
     * @param pcmBuffer Raw PCM buffer (16-bit signed PCM, 48kHz, mono)
     * @throws Will throw an error if the voice chat is not connected or if another audio stream is active
     */
    async sendPCM(pcmBuffer) {
        if (this.isStreaming) {
            throw exports.log.error("Another PCM stream is already active!");
        }
        this.isStreaming = true;
        this.isPaused = false;
        const frameSize = (StoredData_1.StoredData.SAMPLE_RATE / 1000) *
            StoredData_1.StoredData.FRAME_DURATION_MS *
            StoredData_1.StoredData.CHANNELS *
            2; // 1920 bytes
        let shouldStop = false;
        let isPaused = false;
        const controller = {
            stop: () => {
                shouldStop = true;
            },
            pause: () => {
                isPaused = true;
            },
            resume: () => {
                isPaused = false;
            },
        };
        this.currentStreamController = controller;
        const loopStartTime = performance.now();
        const initialSequenceNumber = Number(this.sequenceNumber);
        try {
            for (let i = 0; i < pcmBuffer.length; i += frameSize) {
                if (!this.isConnected()) {
                    exports.log.warn("Voice chat disconnected, stopping audio stream.");
                    break;
                }
                if (shouldStop) {
                    break;
                }
                if (isPaused) {
                    while (isPaused && !shouldStop) {
                        await sleep(100);
                    }
                    if (shouldStop) {
                        break;
                    }
                }
                const frame = pcmBuffer.subarray(i, i + frameSize);
                if (frame.length !== frameSize) {
                    break;
                }
                const opus = this._client.opusEncoder.encode(frame);
                this._client.getSocketClient().getPackets().micPacket.send({
                    sequenceNumber: this.sequenceNumber,
                    data: opus,
                    whispering: false,
                });
                const nextPacketTime = loopStartTime +
                    (Number(this.sequenceNumber) - initialSequenceNumber + 1) *
                        StoredData_1.StoredData.FRAME_DURATION_MS;
                const delay = nextPacketTime - performance.now();
                this.sequenceNumber++;
                if (delay > 0) {
                    await sleep(delay);
                }
            }
        }
        finally {
            this.isStreaming = false;
            this.isPaused = false;
            this.currentStreamController = null;
        }
    }
}
exports.default = VoiceChat;
