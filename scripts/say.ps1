<#
  把一句话合成成 WAV 文件（不是放出来）。

  给机器人当嘴用：大脑想说中文 -> 这个脚本出 WAV -> 语音模组的协议发出去。
  格式固定成 48kHz / 单声道 / 16-bit —— 正好是 Simple Voice Chat 要的，
  这样就不用 ffmpeg 转码（实测转 5.9 秒音频要 7.5 秒，太慢）。

  必须是 UTF-8 带 BOM，否则 PowerShell 5.1 会把中文读成乱码。
#>
param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$Wav,
  [string]$Voice = "Microsoft Huihui Desktop",
  [int]$Rate = 0
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
  if ($installed -contains $Voice) {
    $synth.SelectVoice($Voice)
  } else {
    Write-Host ("[say] 没有音色 '$Voice'，用系统默认。可用：" + ($installed -join ", "))
  }
  $synth.Rate = $Rate

  # 48kHz / 单声道 / 16bit —— 语音模组要的格式
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    48000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)
  $synth.SetOutputToWaveFile($Wav, $fmt)

  # 文本从文件读：省得跟命令行引号打架（中文、引号、感叹号都能安全传）
  $text = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8)
  $synth.Speak($text)
} finally {
  $synth.Dispose()
}

if (-not (Test-Path $Wav) -or (Get-Item $Wav).Length -le 44) {
  throw "合成失败：没生成有效的 WAV"
}
