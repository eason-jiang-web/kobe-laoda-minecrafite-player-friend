"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriendlyByteBuf = void 0;
const buffer_1 = require("buffer");
class FriendlyByteBuf {
    buf;
    _readerIndex;
    _writerIndex;
    markedReaderIndex;
    markedWriterIndex;
    constructor(byteBuf) {
        this.buf = byteBuf || buffer_1.Buffer.alloc(0);
        this._readerIndex = 0;
        this._writerIndex = byteBuf ? byteBuf.length : 0;
        this.markedReaderIndex = null;
        this.markedWriterIndex = null;
    }
    getUnderlyingByteBuf() {
        return this.buf;
    }
    getAllBytes() {
        return new Uint8Array(this.buf.slice(0, this.capacity()));
    }
    writeByteArray(bs) {
        this.writeVarInt(bs.length);
        this.writeBytes(buffer_1.Buffer.from(bs));
        return this;
    }
    readByteArray(maxLength = this.readableBytes()) {
        const length = this.readVarInt();
        if (length > maxLength) {
            throw new Error(`ByteArray with size ${length} is bigger than allowed ${maxLength}`);
        }
        const bs = buffer_1.Buffer.alloc(length);
        this.readBytes(bs, 0, length);
        return bs;
    }
    readVarInt() {
        let value = 0;
        let position = 0;
        let currentByte;
        do {
            currentByte = this.readByte();
            value |= (currentByte & 0x7f) << (position * 7);
            position++;
            if (position > 5) {
                throw new Error("VarInt too big");
            }
        } while ((currentByte & 0x80) === 0x80);
        return value;
    }
    // Запись UUID
    writeUUID(uuid) {
        this.writeLong(uuid.mostSignificantBits);
        this.writeLong(uuid.leastSignificantBits);
        return this;
    }
    // Чтение UUID
    readUUID() {
        const mostSignificantBits = this.readLong();
        const leastSignificantBits = this.readLong();
        return { mostSignificantBits, leastSignificantBits };
    }
    readFloat() {
        if (!this.isReadable(4)) {
            throw new Error("Not enough readable bytes for float");
        }
        const value = this.buf.readFloatBE(this._readerIndex);
        this._readerIndex += 4;
        return value;
    }
    writeFloat(value) {
        this.ensureWritable(4);
        this.buf.writeFloatBE(value, this._writerIndex);
        this._writerIndex += 4;
        return this;
    }
    writeVarInt(value) {
        let v = value;
        while ((v & ~0x7f) !== 0) {
            this.writeByte((v & 0x7f) | 0x80);
            v >>>= 7;
        }
        this.writeByte(v);
        return this;
    }
    readUtf(maxLength = 32767) {
        const length = this.readVarInt();
        if (length > maxLength * 4) {
            throw new Error(`The received encoded string buffer length is longer than maximum allowed (${length} > ${maxLength * 4})`);
        }
        if (length < 0) {
            throw new Error("The received encoded string buffer length is less than zero! Weird string!");
        }
        const str = this.toString(this.readerIndex(), this.readerIndex() + length, "utf8");
        this.readerIndex(this.readerIndex() + length);
        if (str.length > maxLength) {
            throw new Error(`The received string length is longer than maximum allowed (${length} > ${maxLength})`);
        }
        return str;
    }
    writeUtf(str, maxLength = 32767) {
        const bs = buffer_1.Buffer.from(str, "utf8");
        if (bs.length > maxLength) {
            throw new Error(`String too big (was ${bs.length} bytes encoded, max ${maxLength})`);
        }
        this.writeVarInt(bs.length);
        this.writeBytes(bs);
        return this;
    }
    capacity(newCapacity) {
        if (newCapacity === undefined) {
            return this.buf.length;
        }
        if (newCapacity < 0 || newCapacity > this.maxCapacity()) {
            throw new Error(`Invalid capacity: ${newCapacity}`);
        }
        if (newCapacity > this.buf.length) {
            const newBuf = buffer_1.Buffer.alloc(newCapacity);
            this.buf.copy(newBuf, 0, 0, this.buf.length);
            this.buf = newBuf;
        }
        else if (newCapacity < this.buf.length) {
            this.buf = this.buf.slice(0, newCapacity);
        }
        return this;
    }
    maxCapacity() {
        return 2 ** 31 - 1;
    }
    readerIndex(index) {
        if (index === undefined) {
            return this._readerIndex;
        }
        if (index < 0 || index > this._writerIndex) {
            throw new Error(`Invalid readerIndex: ${index}`);
        }
        this._readerIndex = index;
        return this;
    }
    writerIndex(index) {
        if (index === undefined) {
            return this._writerIndex;
        }
        if (index < this._readerIndex || index > this.capacity()) {
            throw new Error(`Invalid writerIndex: ${index}`);
        }
        this._writerIndex = index;
        return this;
    }
    setIndex(readerIndex, writerIndex) {
        if (readerIndex < 0 ||
            readerIndex > writerIndex ||
            writerIndex > this.capacity()) {
            throw new Error(`Invalid indices: readerIndex=${readerIndex}, writerIndex=${writerIndex}`);
        }
        this._readerIndex = readerIndex;
        this._writerIndex = writerIndex;
        return this;
    }
    readableBytes() {
        return this._writerIndex - this._readerIndex;
    }
    writableBytes() {
        return this.capacity() - this._writerIndex;
    }
    maxWritableBytes() {
        return this.maxCapacity() - this._writerIndex;
    }
    isReadable(numBytes) {
        return numBytes === undefined
            ? this.readableBytes() > 0
            : this.readableBytes() >= numBytes;
    }
    isWritable(numBytes) {
        return numBytes === undefined
            ? this.writableBytes() > 0
            : this.writableBytes() >= numBytes;
    }
    clear() {
        this._readerIndex = 0;
        this._writerIndex = 0;
        return this;
    }
    markReaderIndex() {
        this.markedReaderIndex = this._readerIndex;
        return this;
    }
    resetReaderIndex() {
        if (this.markedReaderIndex !== null) {
            this._readerIndex = this.markedReaderIndex;
        }
        return this;
    }
    markWriterIndex() {
        this.markedWriterIndex = this._writerIndex;
        return this;
    }
    resetWriterIndex() {
        if (this.markedWriterIndex !== null) {
            this._writerIndex = this.markedWriterIndex;
        }
        return this;
    }
    discardReadBytes() {
        if (this._readerIndex === 0) {
            return this;
        }
        const newBuf = buffer_1.Buffer.alloc(this.capacity());
        this.buf.copy(newBuf, 0, this._readerIndex, this._writerIndex);
        this._writerIndex -= this._readerIndex;
        this._readerIndex = 0;
        this.buf = newBuf;
        return this;
    }
    ensureWritable(minWritableBytes) {
        if (minWritableBytes <= this.writableBytes()) {
            return this;
        }
        const newCapacity = this._writerIndex + minWritableBytes;
        if (newCapacity > this.maxCapacity()) {
            throw new Error(`Required capacity exceeds maxCapacity: ${newCapacity} > ${this.maxCapacity()}`);
        }
        this.capacity(newCapacity);
        return this;
    }
    getByte(index) {
        return this.buf.readUInt8(index);
    }
    getBytes(index, dest, destIndex, length) {
        this.buf.copy(dest, destIndex, index, index + length);
        return this;
    }
    setByte(index, value) {
        this.buf.writeUInt8(value, index);
        return this;
    }
    setBytes(index, src, srcIndex, length) {
        src.copy(this.buf, index, srcIndex, srcIndex + length);
        return this;
    }
    readByte() {
        if (!this.isReadable()) {
            throw new Error("No readable bytes");
        }
        const value = this.buf.readUInt8(this._readerIndex);
        this._readerIndex++;
        return value;
    }
    readBytes(dest, destIndex, length) {
        if (!this.isReadable(length)) {
            throw new Error(`Not enough readable bytes: ${length} required, ${this.readableBytes()} available`);
        }
        this.buf.copy(dest, destIndex, this._readerIndex, this._readerIndex + length);
        this._readerIndex += length;
        return this;
    }
    writeByte(value) {
        this.ensureWritable(1);
        this.buf.writeUInt8(value, this._writerIndex);
        this._writerIndex++;
        return this;
    }
    writeBytes(src, srcIndex, length) {
        if (srcIndex !== undefined && length !== undefined) {
            this.ensureWritable(length);
            src.copy(this.buf, this._writerIndex, srcIndex, srcIndex + length);
            this._writerIndex += length;
        }
        else {
            this.ensureWritable(src.length);
            src.copy(this.buf, this._writerIndex);
            this._writerIndex += src.length;
        }
        return this;
    }
    writeShort(value) {
        this.ensureWritable(2);
        this.buf.writeInt16BE(value, this._writerIndex);
        this._writerIndex += 2;
        return this;
    }
    writeInt(value) {
        this.ensureWritable(4);
        this.buf.writeInt32BE(value, this._writerIndex);
        this._writerIndex += 4;
        return this;
    }
    readInt() {
        if (!this.isReadable(4)) {
            throw new Error("Not enough readable bytes for int");
        }
        const value = this.buf.readInt32BE(this._readerIndex);
        this._readerIndex += 4;
        return value;
    }
    writeLong(value) {
        this.ensureWritable(8);
        this.buf.writeBigInt64BE(value, this._writerIndex);
        this._writerIndex += 8;
        return this;
    }
    readShort() {
        if (!this.isReadable(2)) {
            throw new Error("Not enough readable bytes for short");
        }
        const value = this.buf.readInt16BE(this._readerIndex);
        this._readerIndex += 2;
        return value;
    }
    readLong() {
        if (!this.isReadable(8)) {
            throw new Error("Not enough readable bytes for long");
        }
        const value = this.buf.readBigInt64BE(this._readerIndex);
        this._readerIndex += 8;
        return value;
    }
    readBoolean() {
        if (!this.isReadable(1)) {
            throw new Error("Not enough readable bytes for boolean");
        }
        const value = this.buf.readUInt8(this._readerIndex);
        this._readerIndex++;
        return value !== 0;
    }
    writeBoolean(value) {
        this.ensureWritable(1);
        this.buf.writeUInt8(value ? 1 : 0, this._writerIndex);
        this._writerIndex++;
        return this;
    }
    readDouble() {
        if (!this.isReadable(8)) {
            throw new Error("Not enough readable bytes for double");
        }
        const value = this.buf.readDoubleBE(this._readerIndex);
        this._readerIndex += 8;
        return value;
    }
    writeDouble(value) {
        this.ensureWritable(8);
        this.buf.writeDoubleBE(value, this._writerIndex);
        this._writerIndex += 8;
        return this;
    }
    slice(index, length) {
        return this.buf.slice(index, index + length);
    }
    toString(startOrEncoding, end, encoding) {
        if (typeof startOrEncoding === "string" ||
            startOrEncoding === undefined) {
            return this.buf.toString(startOrEncoding);
        }
        if (startOrEncoding !== undefined && end !== undefined && encoding) {
            return this.buf.toString(encoding, startOrEncoding, end);
        }
        return this.buf.toString();
    }
}
exports.FriendlyByteBuf = FriendlyByteBuf;
