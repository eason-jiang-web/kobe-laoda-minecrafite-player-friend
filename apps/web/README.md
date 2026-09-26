# apps/web — 上游的宣传落地页

这个目录是 itto **上游自带的官网落地页**（Next.js），不是牢大本体。
牢大的本体在 `apps/mc-bot` + `apps/brain-deepseek`。

## 关于宣传视频

上游原本在 `public/video/` 放了 7 段宣传片（`hero.mp4`、`hero-loop.mp4`、
`banner.mp4` 等），合计 **34.1 MB**，占了整个仓库体积的绝大部分。
这些素材拍的是上游那个 bot，跟牢大无关，**已删除**，仓库因此从 36 MB 降到约 6 MB。

页面里对应的位置现在是**无源的 `<video>` 占位**（纯黑底 + 文字排版照旧），
不会产生 404，也不影响 `next build`。以后想放回自己的素材：把文件丢进
`public/video/`，再把各 section 里删掉的 `src="/video/xxx.mp4"` 加回去即可。
