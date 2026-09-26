<#
  把牢大发布到 GitHub —— 双击「发布到GitHub.cmd」跑的就是它。

  为什么要脚本：git 推 GitHub 现在只能用 Token 或浏览器授权（密码早就不支持了），
  而且这份工作区是从上游克隆来的，得先把 remote 换成你自己的仓库，
  否则会试图往别人的仓库推。这里把这几步串起来。

  用法：
    双击「发布到GitHub.cmd」，或
    powershell -File scripts\publish.ps1 -RepoUrl https://github.com/你/仓库.git
    只想看看会做什么（不改任何东西）：加 -DryRun

  必须 UTF-8 带 BOM。
#>
param(
  [string]$RepoUrl = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Say($msg, $color = "Gray") { Write-Host "  $msg" -ForegroundColor $color }

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkGray
Write-Host "     把 牢大 发布到 GitHub" -ForegroundColor Magenta
Write-Host "  ============================================================" -ForegroundColor DarkGray
Write-Host ""

# ── 0. 本地状态 ────────────────────────────────────────────────
Say ("当前提交：" + (git log --oneline -1))
$dirty = (git status --short | Measure-Object).Count
if ($dirty -gt 0) { Say ("注意：还有 " + $dirty + " 项没提交，推送只会带上已提交的内容。") "Yellow" }

# 现有 remote（用 git remote 列表判断，别对不存在的 remote 调 get-url —— 那样在 PS 5.1 会直接终止脚本）
$remotes = @(git remote)
$originUrl = if ($remotes -contains "origin") { (git remote get-url origin) } else { $null }
Say ("现有 remote：" + (($remotes | ForEach-Object { $_ }) -join ", "))

# ── 1. 仓库地址 ────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
  Write-Host ""
  Say "先在 GitHub 网页上新建一个仓库（名字只能用 ASCII，比如 laoda-mc-buddy）。" "White"
  Say "建议先选 Private。中文名写在仓库简介里就行。" "White"
  Write-Host ""
  $RepoUrl = (Read-Host "  把仓库地址贴进来（https://github.com/你/仓库.git）").Trim()
}

if ($RepoUrl -notmatch "^https://github\.com/.+/.+") {
  Say "这不像 GitHub 仓库地址（要以 https://github.com/ 开头）。退出，什么都没有改。" "Red"
  exit 1
}

# ── 2. 计划（-DryRun 到此为止，绝不改 remote）──────────────────
Write-Host ""
Say "打算这么做：" "White"
if ($originUrl) {
  if ($originUrl -match "silaswu4/itto") {
    Say "  1) 把上游 origin 改名成 upstream（留作参考，不推送）"
  } else {
    Say ("  1) 把现有 origin（" + $originUrl + "）换成你的仓库")
  }
} else {
  Say "  1) 加一个 origin 指向你的仓库"
}
Say ("  2) git push -u origin main  →  " + $RepoUrl)
Write-Host ""

if ($DryRun) {
  Say "（-DryRun：只显示计划，没有改 remote、没有推送。）" "Yellow"
  Write-Host ""
  exit 0
}

# ── 3. 执行 remote 变更 ────────────────────────────────────────
if ($originUrl) {
  if ($originUrl -match "silaswu4/itto") {
    git remote rename origin upstream
    git remote add origin $RepoUrl
  } else {
    git remote set-url origin $RepoUrl
  }
} else {
  git remote add origin $RepoUrl
}
Say "远端确认："
git remote -v | ForEach-Object { Say ("  " + $_) }

# ── 4. 推送 ────────────────────────────────────────────────────
Write-Host ""
Say "开始推送 —— 会弹出浏览器让你授权 GitHub（一次就好）。" "White"
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Say "推送失败。常见原因：" "Red"
  Say "  · GitHub 上还没建这个仓库" "Red"
  Say "  · 授权弹窗没走完 / 网络不通（挂了代理再试）" "Red"
  Say "  · 或改用 Token：地址写成 https://<用户名>:<Token>@github.com/<用户名>/<仓库>.git" "Red"
  exit 1
}

Write-Host ""
Say "✓ 发布完成。" "Green"
Say ("  " + ($RepoUrl -replace "\.git$", "")) "Green"
Write-Host ""
Say "接下来：" "White"
Say "  1. 不是 Private 的话，去仓库设置里改成 Private —— 上游没有 LICENSE，公开前先确认授权" "White"
Say "  2. 别人拿到后：bun install → 填 .env → bun run doctor → bun run bot" "White"
