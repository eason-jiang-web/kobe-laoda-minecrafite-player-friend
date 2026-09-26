<#
  牢大 —— 一个快捷方式搞定所有事。

  默认（什么都不按）：等 8 秒自动"一键开玩" = 机器人 + 指令表，开两个窗口。
  想干别的就按数字键。也可以命令行指定：-Choose 4

  这个文件必须是 UTF-8 带 BOM，否则 PowerShell 5.1 会把中文读成乱码。
#>
param(
  [int]$Choose = 0,
  [int]$TimeoutSeconds = 8
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Start-Launcher([string]$file) {
  Start-Process -FilePath (Join-Path $root $file) -WorkingDirectory $root | Out-Null
}

function Start-Play {
  Write-Host "  正在开机器人窗口..." -ForegroundColor Green
  Start-Launcher "启动牢大.cmd"
  Start-Sleep -Seconds 3
  # 指令表单独一个窗口：不用在机器人日志里翻，忘了 /op、忘了端口、忘了 #back 就瞟一眼
  Write-Host "  正在开指令表窗口..." -ForegroundColor Cyan
  Start-Launcher "指令说明.cmd"
}

function Show-Menu {
  Write-Host ""
  Write-Host "  ============================================" -ForegroundColor DarkGray
  Write-Host "    牢大  ·  今天想干嘛？" -ForegroundColor Magenta
  Write-Host "  ============================================" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "    [1] " -NoNewline -ForegroundColor Yellow
  Write-Host "一键开玩    " -NoNewline; Write-Host "机器人 + 指令表（推荐）" -ForegroundColor DarkGray
  Write-Host "    [2] " -NoNewline -ForegroundColor Yellow
  Write-Host "只开机器人  " -NoNewline; Write-Host "不想开指令表的时候用" -ForegroundColor DarkGray
  Write-Host "    [3] " -NoNewline -ForegroundColor Yellow
  Write-Host "指令表      " -NoNewline; Write-Host "所有 #指令、/op、端口，单独一个窗口" -ForegroundColor DarkGray
  Write-Host "    [4] " -NoNewline -ForegroundColor Yellow
  Write-Host "安装皮肤    " -NoNewline; Write-Host "一次性，装完就不用再点" -ForegroundColor DarkGray
  Write-Host "    [5] " -NoNewline -ForegroundColor Yellow
  Write-Host "给权限      " -NoNewline; Write-Host "让他能瞬移（要先退到标题画面）" -ForegroundColor DarkGray
  Write-Host "    [0] " -NoNewline -ForegroundColor Yellow
  Write-Host "退出" -ForegroundColor DarkGray
  Write-Host ""
}

function Ask-Choice {
  Show-Menu
  if ([Console]::IsInputRedirected) {
    # Piped input (or a script): read one line, default to 1.
    $line = [Console]::In.ReadLine()
    if ($line -match '^[0-5]$') { return [int]$line }
    return 1
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ($true) {
    $left = [int][Math]::Ceiling(($deadline - (Get-Date)).TotalSeconds)
    if ($left -le 0) {
      Write-Host "    没选，自动开始一键开玩" -ForegroundColor DarkGray
      return 1
    }
    $line = [char]13 + "    按 1/2/3/4/5/0 选，或等 " + $left + " 秒自动开玩...   "
    Write-Host -NoNewline $line -ForegroundColor DarkGray
    try {
      if ([Console]::KeyAvailable) {
        $k = [Console]::ReadKey($true).KeyChar
        if ("012345".IndexOf([string]$k) -ge 0) {
          Write-Host ""
          return [int]::Parse($k)
        }
      }
    } catch { return 1 }
    Start-Sleep -Milliseconds 150
  }
}

if ($Choose -eq 0) { $Choose = Ask-Choice }

switch ($Choose) {
  1 { Start-Play }
  2 { Write-Host "  正在开机器人窗口..." -ForegroundColor Green; Start-Launcher "启动牢大.cmd" }
  3 { Write-Host "  正在开指令表窗口..." -ForegroundColor Cyan; Start-Launcher "指令说明.cmd" }
  4 { Write-Host "  正在装皮肤..." -ForegroundColor Green; Start-Launcher "安装皮肤.cmd" }
  5 { Start-Launcher "给牢大开权限.cmd" }
  0 { Write-Host "  好，那就不开。Mamba out。" -ForegroundColor DarkGray; exit 0 }
  default { Write-Host "  看不懂 $Choose，退出。" -ForegroundColor Red; exit 1 }
}

Write-Host ""
Write-Host "  搞定 —— 新开的窗口就是牢大，关掉窗口他就停。" -ForegroundColor Green
Write-Host "  这个窗口可以关了。" -ForegroundColor DarkGray
Write-Host ""
