export default class SoundConverter {
    static convertToPCM(name: string, sampleRate: number, channels: number): Promise<Buffer>;
}
