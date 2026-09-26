# 牢大 · Minecraft 陪玩 AI

> 一个会**跟着你玩**的 AI 搭子：进你的世界、跟着你、帮你打怪挖矿、记住你的基地，
> 用中文跟你聊天 —— 装好语音模组后还能**在游戏里开口说话**。

不是攻略助手，不是教程机器人。是那个你挖矿时在旁边絮叨、你被打时冲上去、你死了帮你捡东西的兄弟。
人设是「抽象战神」，招牌台词：**What can I say? Mamba out!**

---

## 它现在会做什么

| | |
|---|---|
| **跟着你** | 15Hz 跟随 + 脱队自动抄近路（有 op 就瞬移，没有就走过去） |
| **听你说话** | 游戏聊天栏说什么都接（不用喊名字），也能听懂「去挖点铁」「跟着我」「给我 32 个木头」 |
| **真的去做** | 砍树、挖矿脉、探路、找村庄、打怪、取东西、丢东西给你 —— 多步任务在后台跑，做完回来汇报 |
| **会看进度** | 知道主线走到第几步、这一步该干嘛；还会算**现在材料够盖什么**（农场/储物间/刷怪塔/传送门/附魔台/铁傀儡农场…），缺料会列清单 |
| **自己在游戏里说话** | Windows 中文 TTS，声音**从它在游戏里的位置传出来**（有距离感，像旁边站着个人） |
| **也能听你说话** | 你在语音频道说话 → 中文识别 → 当成你打的字进大脑（约 0.5 秒） |
| **盯着你的动作** | 你被打/死了优先反应；你捡到钻石、完成进度、丢东西给它、睡下、上下线它都知道 |
| **自修过 wiki** | 跑一次 `bun run study:wiki`，它读 57 个中文 Minecraft Wiki 条目、自己蒸馏成要点常驻记忆；细节随时用 `wiki_notes` 翻原文 |
| **物品名是中文** | 从你本机 Minecraft 的语言文件读（橡木原木 / 粗铁 / 深层铁矿石），和你在屏幕上看到的逐字一致 |
| **硬指令** | `#back` 瞬移到你身边、`#free` 自由活动、`#stop` 停火、`#attack 僵尸`、`#value 铁 400` 改物资上限、`#guide` 看进度… 不走大脑、瞬间生效、不花 token |
| **被调教** | `#good` / `#bad` 给刚才那轮打分，写进 `data/training/` 训练日志 |

---

## 实测数据

下面每个数字都是**在一台普通 Windows 机器 + 一个局域网世界**里真跑出来的，并注明怎么测的 —— 不是估算。

### 反应速度

| 环节 | 实测 | 怎么测的 |
|---|---|---|
| 中文语音合成（TTS） | 5.05 秒的话 ≈ **350–390ms** | Windows SAPI 合成到 WAV，输出 48kHz / 单声道 / 16bit |
| opus 编码 | 5.87 秒音频 → 293 帧 / 27KB，**310ms**（≈19 倍实时） | 纯 JS 的 opusscript 编码器 |
| 语音识别（STT） | 每句 **430–480ms** | 三句中文真跑，逐句对照见下 |
| wiki 查询 | 每次 **340–630ms**（同一词 1 小时内走缓存） | zh.minecraft.wiki 的 MediaWiki API |
| 自修一条 wiki | **1.3–2.4 秒**（取摘要 + 模型蒸馏成要点） | 57 个条目约 2 分钟跑完 |
| 你说完 → 它回话 | 约 **2–3 秒** | 识别 0.5s + 模型一轮 + 合成 0.4s（这一项是估算，不是仪器测的） |

### 语音识别准不准（自测对照）

| 原话 | 识别结果 | 耗时 |
|---|---|---|
| 挖点铁回来 | 花点铁回来 | 482ms |
| 牢大 过来帮我打僵尸 | 老大过来帮我打将使 | 443ms |
| 这附近有钻石吗 | 这附近有钻石马 | 432ms |

识别引擎是 Windows 自带的中文听写，错一两个字是常态；大脑一般能猜对意思，
而且「老大」本来就在唤醒词里（牢大/老大/肘/曼巴/what can i say）。

### 为什么不让 ffmpeg 转码

语音插件默认用 ffmpeg 把音频转成 PCM。实测：**5.87 秒的音频转了 7.5 秒**（0.85 倍实时 —— 对话会卡成幻灯片）。
所以我们让它直接把话说成 48k/单声道/16bit，跳过转码，只剩 opus 那 310ms。

### 代码与知识量

| 项 | 实测 |
|---|---|
| 测试 | **283 个 / 31 个文件全过** |
| 类型检查 | 6 个包全部干净 |
| 物品名中文化 | 从本机 Minecraft 语言文件读到 **2988 条**（官方 zh_cn.json 共 8557 条，筛出物品/方块/生物） |
| 自修笔记体积 | 57 条要点 = 6193 字符 ≈ **3.6k tokens**，放在提示词最前面（稳定前缀，吃到上下文缓存后几乎免费） |

### 发布前自查：拿一份"全新副本"真跑

把仓库内容拷到一个**没有 `node_modules`、没有 `.env`、没有 `data/`** 的干净目录后：

```
bun install      → 330 packages
bun test         → 283 pass / 0 fail
bun run doctor   → ✓ Bun 1.4.2   ✗ 没有 .env  → 教你先 Copy-Item .env.example .env
```

这一步当场揪出**两个只有别人 clone 才会遇到的 bug**（本地怎么跑都是绿的）：

1. vendor 进来的语音插件依赖 `tslog` **从没被声明**（它是相对路径引入的，不在依赖图里）
2. `.gitignore` 的 `data/` **没锚定根目录**，把语音插件的 `lib/data/FriendlyByteBuf.js` 一起忽略了 ——
   那个文件从来没进过仓库，clone 下来语音模块加载即崩

两个都修了。这本身也是一条实测结论：**「本地能跑」和「别人能跑」是两回事。**

---

## 五分钟跑起来

**需要什么**：Windows、[Bun](https://bun.sh)、一个 Minecraft Java 版世界（原版即可，1.7~1.21 里 mineflayer 认识的版本）、
一个 [DeepSeek API key](https://platform.deepseek.com)（很便宜，一天几分钱）。

> **网络提示（中国大陆）**：直连 `github.com` 常常超时。可以挂代理，或用 GitHub 加速前缀来 clone，例如：
> `git clone https://githubproxy.cc/https://github.com/eason-jiang-web/kobe-laoda-minecrafite-player-friend.git`
> （把前缀换成你信得过的加速服务即可；只影响下载，代码本身没区别。）

```powershell
git clone <这个仓库的地址>
cd <项目目录>
bun install

Copy-Item .env.example .env
# 打开 .env，至少填这四项：
#   DEEPSEEK_API_KEY=sk-...
#   MC_VERSION=1.20.6          ← 必须和你启动的版本一字不差
#   MC_OWNER_USERNAME=你的游戏名
#   MC_BOT_USERNAME=Laoda      ← 机器人自己的名字（ASCII，3-16 位）

bun run doctor        # 自检：哪没配好它会直接说，并告诉你怎么改
```

然后：

1. 进游戏 → **Esc → 对局域网开放** → **端口填 25565**（游戏默认给的是随机的，一定要改）→ 允许作弊**开**
2. `bun run bot`（或者双击仓库里的 `牢大.cmd` / 桌面快捷方式，菜单按 `1`）

启动后终端会打出**全部指令和用法**，游戏里它会自己进来、跟你打招呼。

> **想要它在游戏里说话**：给你的客户端装 **Fabric + [Simple Voice Chat](https://modrinth.com/plugin/simple-voice-chat)**，
> 然后在 `.env` 里设 `MC_VOICE=true`。局域网世界 = 你客户端就是服务端，装一次两边都有。
> 装完按 `V` 选麦克风，它就能听见你、也能开口回你。

---

## 常用配置（`.env` 速查）

| 键 | 作用 |
|---|---|
| `MC_SERVER_HOST` / `MC_SERVER_PORT` | 连哪个世界。默认 `127.0.0.1:25565`（局域网世界）。**换成别人的服务器地址也能连** |
| `MC_AUTH` | `offline`（离线/局域网）或 `microsoft`（正版服 —— 第一次启动会打印设备码登录链接） |
| `MC_VERSION` | 世界版本，必须一致 |
| `MC_OWNER_USERNAME` | 它跟着谁、听谁的（硬指令只有这个人能触发） |
| `MC_WAKE_WORDS` | 哪些词算「在叫我」 |
| `MC_AUTOPLAY` | `true`＝没人理它时自己排活干（挖矿/探路/盖东西） |
| `MC_CHAT_REPLY_ALL` | `true`＝你说什么它都回，不用喊名字 |
| `MC_VOICE` / `MC_VOICE_TTS` | 语音开关 / 音色（如 `Microsoft Huihui Desktop`） |
| `MC_VOICE_HEAR` | 听不听你说话（识别） |
| `MC_REPORT_ITEMS` | 攒够多少跟你报一声，如 `any_log:128,rare:10` |
| `MC_GAME_DIR` | 你的游戏目录（读中文物品名 + 自动开 op 用；不填会自动找） |
| `BRAIN_ENABLED` / `DEEPSEEK_API_KEY` | 大脑开关 / key |

完整说明见 `.env.example` 里的注释，以及 **[docs/PCL_DEEPSEEK_SETUP.md](./docs/PCL_DEEPSEEK_SETUP.md)**（中文逐步教程，含排查）。

---

## 常用命令

```powershell
bun run doctor        # 上手自检（配完先跑这个）
bun run bot           # 启动机器人（--watch，改代码自动重启）
bun run study:wiki    # 让它自修一遍 Minecraft Wiki（增量，可反复跑）
bun test              # 全部测试（283 个）
bun run typecheck     # 类型检查
```

游戏里（只有 `MC_OWNER_USERNAME` 打得动）：

```
#back     解除自由活动 + 立刻到我身边     #free     自由活动（不跟、不传送）
#stop     停火（直到 #nonstop）          #attack 僵尸 / #attack eason  点名去打
#stay     原地待命                       #here     走过来（不传送）
#quiet    闭嘴模式（#talk 解除）         #cancel   取消当前任务
#value    看物资评估 + 还缺什么           #value 铁 400   把铁的上限改成 400
#guide    看主线进度 + 现在材料够盖什么    #guide mode     开工向导
#good / #bad   给刚才那轮打分（写进训练日志）
```

---

## 它是怎么搭的

**身体在游戏里，脑子在外面，中间走 MCP。**

| 部分 | 是什么 |
|---|---|
| `apps/mc-bot` | 身体：[Mineflayer](https://github.com/PrismarineJS/mineflayer) 机器人。**15Hz 快循环**（跟随、闪避、吃东西，纯代码不调模型）+ **约 4 秒慢循环**（判断"有没有值得反应的事"，有就叫醒大脑） |
| `apps/brain-deepseek` | 脑子：DeepSeek（或任何 OpenAI 兼容接口）。每次唤醒是一次带工具的对话，能读世界状态、下指令、写记忆 |
| `packages/mcp-server` | 神经：把身体的能力暴露成 MCP 工具、把世界状态暴露成 MCP 资源 |
| `packages/shared` | 类型、schema、人设提示词、进度/工程评估、价值评估、中文物品名 |
| `apps/web` | 落地页（可选，跟机器人无关） |

设计上就一条原则：**"我正在被岩浆烧"这种反射绝不能排在大模型后面**。所以快循环永不等待网络，慢循环才有模型。

想读懂代码，按这个顺序看：`apps/mc-bot/src/index.ts`（接线）→ `slow-loop/`（什么时候叫醒脑子）
→ `chat-commands.ts`（硬指令）→ `apps/brain-deepseek/src/index.ts`（脑子那一轮）。

---

## 常见问题

| 现象 | 原因 / 怎么办 |
|---|---|
| `port 3001 is already in use` | 上一次的机器人还在跑。关掉那个窗口，或改 `.env` 里的 `MCP_PORT` 和 `ITTO_MCP_URL` |
| 一直说"连不上 127.0.0.1:25565" | 世界没开「对局域网开放」，或者**端口没从随机值改成 25565**。它会一直等，改好自己就进来了 |
| 它不说话（语音） | 客户端装 Simple Voice Chat 了吗、`MC_VOICE=true` 吗、游戏里按 `V` 选对麦克风了吗。终端里搜 `语音频道已连上` |
| 它听不到我说话 | 同上，加上：别超过 32 格（默认语音距离）。终端里应该有 `听到 eason 说了 X 秒` |
| `#back` 说"传不过去" | 没有 op。游戏里打一次 `/op <机器人名>`，或者关掉世界双击 `给牢大开权限.cmd` |
| 版本报错 `is not a Minecraft version mineflayer can speak` | 换成它提示的那个版本，或改 `MC_VERSION` 跟你世界一致 |
| 想让它闭嘴/省钱 | `HEARTBEAT_MS=0`、`MC_AUTOPLAY=false`、`MC_CHAT_REPLY_ALL=false` |

更细的排查（含语音、op、皮肤）见 **[docs/PCL_DEEPSEEK_SETUP.md](./docs/PCL_DEEPSEEK_SETUP.md)** 和 **[docs/SKIN_AND_MENU.md](./docs/SKIN_AND_MENU.md)**。

---

## 来源与说明

- 本项目基于 **[silaswu4/itto](https://github.com/silaswu4/itto)** 改造：原来的骨架（快慢双循环 + MCP 分层）保留，
  脑子换成了内置的 DeepSeek，人设、中文、语音、进度/工程评估、自修 wiki、中文物品名、硬指令这些都是后加的。
- 上游仓库**没有 LICENSE 文件**。如果你要公开分发，请先确认上游的授权，或者只自己用/私有仓库。
- 它读的 Minecraft Wiki 内容来自 [zh.minecraft.wiki](https://zh.minecraft.wiki)（CC BY-NC-SA），
  自修笔记默认写在 `data/` 下（**不会被提交**），请勿把大段 wiki 原文再分发。
- `.env` 和 `data/` 都在 `.gitignore` 里 —— 你的 key、世界记忆、训练日志不会被推上去。
