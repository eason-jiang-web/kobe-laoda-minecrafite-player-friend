<#
  把一段 WAV 里说的话识别成文字（Windows 自带的中文识别，不联网）。

  给机器人当耳朵用：语音模组收到你的声音 -> 存成 WAV -> 这个脚本出文字。
  结果**写进文件**（UTF-8），不靠 stdout —— 中文经过管道很容易变乱码。

  必须是 UTF-8 带 BOM。
#>
param(
  [Parameter(Mandatory = $true)][string]$Wav,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$Culture = "zh-CN"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

# 挑中文识别引擎（你这台机器上是 MS-2052-80-DESK / zh-CN）
$recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
$picked = $recognizers | Where-Object { $_.Culture.Name -eq $Culture } | Select-Object -First 1
if (-not $picked) {
  $picked = $recognizers | Where-Object { $_.Culture.Name -like "zh*" } | Select-Object -First 1
}
if (-not $picked) {
  $names = ($recognizers | ForEach-Object { $_.Culture.Name }) -join ", "
  [System.IO.File]::WriteAllText($OutFile, "", [System.Text.Encoding]::UTF8)
  Write-Host ("[hear] 没有中文识别引擎。装了的：" + $names)
  exit 0
}

$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($picked)
try {
  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $engine.SetInputToWaveFile($Wav)
  $result = $engine.Recognize()
  $text = if ($result) { $result.Text } else { "" }
  $conf = if ($result) { [Math]::Round($result.Confidence, 2) } else { 0 }

  [System.IO.File]::WriteAllText($OutFile, $text, [System.Text.Encoding]::UTF8)
  Write-Host ("[hear] 引擎=" + $picked.Name + " 置信度=" + $conf)
} finally {
  $engine.Dispose()
}
