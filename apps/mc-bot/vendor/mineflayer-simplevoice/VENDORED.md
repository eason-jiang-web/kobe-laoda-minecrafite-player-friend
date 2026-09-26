# 为什么这个包是 vendor 进仓库的

上游：https://github.com/Maks-gaming/mineflayer-simplevoice （MIT，见 LICENSE）
版本：1.1.1

它让 mineflayer 机器人能进 **Simple Voice Chat** 的语音频道：

```js
bot.loadPlugin(simplevoice.plugin);
bot.on("voicechat_connect", () => bot.voicechat.sendAudio("/path/to.wav"));
bot.on("voicechat_player_sound", ({ sender, data }) => { /* pcm_s16le */ });
```

## 为什么不写成 package.json 依赖

它依赖 `@discordjs/opus`（原生模块）。官方**没有 Node 24 的预编译包**
（node-v137 ABI 的 tarball 404），回退源码编译又需要 Visual Studio 构建工具 ——
实测 `bun install` 直接失败：

```
node-pre-gyp ERR! Pre-built binaries not installable for @discordjs/opus@0.10.0 and node@24.18.0
node-pre-gyp ERR! UNCAUGHT EXCEPTION spawn EINVAL
error: install script from "@discordjs/opus" exited with 7
```

## 改了什么

- `lib/VoiceChatClient.js` 一行：`require("@discordjs/opus")` → `require("./opus-shim")`
- 新增 `lib/opus-shim.js`：用纯 JS 的 **opusscript** 实现 `encode` / `decode` / `setBitrate`
  （无编译、任何环境可用；实测 48kHz 单声道 1 秒音频编码 17ms ≈ 60 倍实时）

其余文件与上游 1.1.1 一致。

## 怎么用它

**按相对路径 import，不要走包依赖** ——
`bun add file:...` 是**拷贝**而不是软链，改了 vendor 里的代码装好的那份不会变：

```ts
import simplevoice from "../../vendor/mineflayer-simplevoice/lib/index.js";
```

它自己的依赖（ffmpeg / fluent-ffmpeg / node-rsa / opusscript）挂在
`apps/mc-bot/package.json` 里，Node 从 vendor 往上找就能解析到。

要升级：重新下上游 tarball 覆盖 `lib/`，再把上面那一行改回 `./opus-shim`。
