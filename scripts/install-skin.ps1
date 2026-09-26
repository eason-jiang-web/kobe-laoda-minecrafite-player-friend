<#
  把一张皮肤装进 CustomSkinLoader 的本地皮肤目录 —— 这是离线登录的机器人
  能"有皮肤"的唯一办法（服务端查不到它的正版档案，只能你自己客户端画上去）。

  用法（脚本执行已放开，直接跑即可）：
      cd "<你放这个项目的目录>"
      .\scripts\install-skin.ps1
      .\scripts\install-skin.ps1 -MinecraftDir "D:\PCL\.minecraft" -Player Laoda -Skin "D:\我喜欢的皮肤.png"

  装完之后的完整步骤见 docs/SKIN_AND_MENU.md。
#>
param(
  [string]$MinecraftDir = (Join-Path $env:APPDATA ".minecraft"),
  [string]$Player = "Laoda",
  [string]$Skin = ""
)

$ErrorActionPreference = "Stop"

# A launcher can hand us an empty string instead of omitting the parameter.
if ([string]::IsNullOrWhiteSpace($MinecraftDir)) { $MinecraftDir = Join-Path $env:APPDATA ".minecraft" }
if ([string]::IsNullOrWhiteSpace($Player)) { $Player = "Laoda" }

if ($Skin -eq "") {
  $Skin = Join-Path (Split-Path -Parent $PSScriptRoot) "assets\skins\laoda.png"
}

if (-not (Test-Path $Skin)) {
  Write-Host "找不到皮肤文件：$Skin" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $MinecraftDir)) {
  Write-Host "找不到 .minecraft 目录：$MinecraftDir" -ForegroundColor Red
  Write-Host "PCL 开了版本隔离的话，.minecraft 可能在 PCL 自己的文件夹里；用 -MinecraftDir 指过去。" -ForegroundColor Yellow
  exit 1
}

$target = Join-Path $MinecraftDir ("CustomSkinLoader\LocalSkin\skins\" + $Player + ".png")
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
Copy-Item -Path $Skin -Destination $target -Force

Write-Host ""
Write-Host "皮肤已装好：" -ForegroundColor Green
Write-Host "  $target"
Write-Host ""
Write-Host "还差三步（只做一次）：" -ForegroundColor Yellow
Write-Host "  1. 给这个 Minecraft 装 Fabric（PCL 里 版本设置 → 安装 Fabric）"
Write-Host "  2. 把 CustomSkinLoader 的 jar 丢进 .minecraft\mods\"
Write-Host "     https://www.curseforge.com/minecraft/mc-mods/customskinloader"
Write-Host "  3. 用这个版本进游戏 —— 名字叫 $Player 的玩家就会显示这张皮肤"
Write-Host ""
Write-Host "只想自己看到就够了（局域网世界就属于这种情况）。想所有人都看到，见 docs/SKIN_AND_MENU.md。"
Write-Host ""
