import { Bot } from "mineflayer";
import VoiceChat from "./lib";
/** The function for changing the logging level, by default - 4, and these are warnings, errors and fatal */
export declare function setLoggingLevel(level?: number): void;
export declare function plugin(bot: Bot): void;
export * from "./lib";
declare const _default: {
    plugin: typeof plugin;
    setLoggingLevel: typeof setLoggingLevel;
};
export default _default;
declare module "mineflayer" {
    interface Bot {
        voicechat: VoiceChat;
    }
    interface BotEvents {
        voicechat_location_sound: (data: {
            channelId: string;
            sender?: string;
            data: Buffer;
            raw: Buffer;
            sequenceNumber: BigInt;
            distance: number;
            category?: string;
        }) => void;
        voicechat_player_sound: (data: {
            channelId: string;
            sender?: string;
            data: Buffer;
            raw: Buffer;
            sequenceNumber: BigInt;
            distance: number;
            whispering: boolean;
            category?: string;
        }) => void;
        voicechat_group_sound: (data: {
            channelId: string;
            sender?: string;
            data: Buffer;
            raw: Buffer;
            sequenceNumber: BigInt;
            category?: string;
        }) => void;
        voicechat_connect: () => void;
        voicechat_group_add: (data: {
            id: string;
            name: string;
            hasPassword: boolean;
            persistent: boolean;
            hidden: boolean;
            type: number;
        }) => void;
        voicechat_group_remove: (data: {
            id: string;
        }) => void;
    }
}
