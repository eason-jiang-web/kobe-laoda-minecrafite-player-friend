<#
  把牢大发布会 GitHub —— 双击「发布到GitHub.cmd」跑的就是它。

  为什么要脚本：git 推 GitHub 现在只能用 Token 或浏览器登录（密码早就不行了），
  而且第一次得先在上游仓库的克隆里把 remote 换掉（不然会往别人的仓库推）。
  这里把这几步串起来，你只需要：建好仓库 → 贴地址 → 浏览器点一次授权。

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

# ── 1. 本地状态检查 ─────────────────────────────────────────────
$dirty = (git status --short | Measure-Object).Count
$head = (git log --oneline -1)
Say ("当前提交：" + $head)
if ($dirty -gt 0) {
  Say ("还有 " + $dirty + " 项没提交 —— 先跑一次发布脚本外层的 git add/commit，或者告诉我。") "Yellow"
}

# ── 2. 问仓库地址 ───────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
  Write-Host ""
  Say "先在 GitHub 网页上新建一个仓库（名字只能用 ASCII，比如 laoda-mc-buddy），" "White"
  Say "建议先选 Private；中文名写在仓库简介里就行。" "White"
  Say "建好后把仓库地址贴进来（形如 https://github.com/你的用户名/laoda-mc-buddy.git）" "White"
  Write-Host ""
  $RepoUrl = (Read-Host "  仓库地址").Trim()
}

if ($RepoUrl -notmatch "^https://github\.com/.+/.+") {
  Say "这不像 GitHub 仓库地址（应该以 https://github.com/ 开头）。退出。" "Red"
  exit 1
}

# ── 3. 换 remote（上游那个是别人的克隆，不能往那儿推）────────────
$originUrl = (git remote get-url origin 2>$null)
if ($originUrl -and $originUrl -notmatch "silaswu4/itto") {
  Say ("origin 已经是：" + $originUrl)
  Say "把它换成你给的新地址。"
  git remote set-url origin $RepoUrl
} else {
  if ($originUrl) {
    Say "把上游那个 origin 改名成 upstream（留作参考，不推送）。"
    git remote rename origin upstream
  }
  Say ("加一个新 origin：" + $RepoUrl)
  git remote add origin $RepoUrl
}

Say ("远端确认：")
git remote -v | ForEach-Object { Say ("  " + $_) }

if ($DryRun) {
  Say "（-DryRun：到此为止，没有推送。）" "Yellow"
  exit 0
}

# ── 4. 推送 ─────────────────────────────────────────────────────
Write-Host ""
Say "开始推送 —— 会弹出浏览器让你授权 GitHub（一次就好）。" "White"
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Say "推送失败。常见原因：" "Red"
  Say "  · 仓库还没建（先去 GitHub 网页建一个）" "Red"
  Say "  · 弹窗没授权完 / 网络问题（可以挂代理再试）" "Red"
  Say "  · 或者改用 Token：把地址写成 https://<用户名>:<Token>@github.com/<用户名>/<仓库>.git" "Red"
  exit 1
}

Write-Host ""
Say "✓ 发布完成。" "Green"
Say ("  " + ($RepoUrl -replace "\.git$", "")) "Green"
Say ""
Say "接下来建议：" "White"
Say "  1. 仓库设置里把它设成 Private（如果还不是）—— 上游没有 LICENSE，公开前最好确认授权" "White"
Say "  2. 别人 clone 后只要 bun install + 填 .env + bun run doctor 就能跑" "White"
