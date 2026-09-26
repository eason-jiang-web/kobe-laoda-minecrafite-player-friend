"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
class SoundConverter {
    static convertToPCM(name, sampleRate, channels) {
        return new Promise((resolve, reject) => {
            let chunks = [];
            const ffmpegCommand = (0, fluent_ffmpeg_1.default)(name)
                .audioCodec("pcm_s16le")
                .format("s16le")
                .audioChannels(channels)
                .audioFrequency(sampleRate)
                .audioFilters("aresample=48000")
                .on("error", reject);
            const audioStream = ffmpegCommand.pipe();
            audioStream.on("data", (chunk) => {
                chunks.push(chunk);
            });
            audioStream.on("end", () => {
                let outputBuffer = Buffer.concat(chunks);
                resolve(outputBuffer);
            });
        });
    }
}
exports.default = SoundConverter;
