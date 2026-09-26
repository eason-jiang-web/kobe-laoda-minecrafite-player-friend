import { Bot } from "mineflayer";
import { Logger } from "tslog";
import VoiceChatClient from "./VoiceChatClient";
export declare const log: Logger<unknown>;
export default class VoiceChat {
    /** Are you sure you need this? */
    readonly _client: VoiceChatClient;
    private isStreaming;
    private isPaused;
    private currentStreamController;
    private sequenceNumber;
    constructor(bot: Bot);
    /** Get player voice information by username */
    getPlayer(player: string): {
        playerUUID: string;
        group: string | undefined;
        disabled: boolean;
        disconnected: boolean;
        name: string;
    } | undefined;
    /** Get all player voice information */
    getPlayers(): {
        playerUUID: string;
        group: string | undefined;
        disabled: boolean;
        disconnected: boolean;
        name: string;
    }[];
    /** Get group voice information by UUID */
    getGroup(uuid: string): import("./packet/client/Clientbound/AddGroupPacket").ClientboundAddGroupPacketData | undefined;
    /** Get all group voice information */
    getGroups(): {
        id: string;
        name: string;
        hasPassword: boolean;
        persistent: boolean;
        hidden: boolean;
        type: number;
    }[];
    /** Join a voice group by name */
    joinGroup(name: string, password?: string): void;
    /** Join a voice group by UUID */
    joinGroupByUUID(uuid: string, password?: string): void;
    /** Leave a voice group */
    leaveGroup(): void;
    /** Check if the client is connected to the voice chat */
    isConnected(): boolean;
    /** Stop the audio stream */
    stopAudio(): void;
    /** Pause the audio stream */
    pauseAudio(): void;
    /** Resume the audio stream */
    resumeAudio(): void;
    /**
     * Send an audio file to the voice chat
     * @param audio Path to the audio file (wav, mp3, ogg, flac, etc.)
     * @throws Will throw an error if the voice chat is not connected or if another audio stream is active
     */
    sendAudio(audio: string): Promise<void>;
    /**
     * Send a raw PCM buffer to the voice chat
     * @param pcmBuffer Raw PCM buffer (16-bit signed PCM, 48kHz, mono)
     * @throws Will throw an error if the voice chat is not connected or if another audio stream is active
     */
    sendPCM(pcmBuffer: Buffer): Promise<void>;
}
