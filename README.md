# Langram

A Telegram-style messenger for your local network. Works on any shared Wi-Fi/LAN — **no internet, no server, no accounts**.

## Get the Windows app (no building on your PC)

1. Create a free account on github.com and click **New repository** (name it `langram`, Private is fine).
2. Click **uploading an existing file**, drag in **everything from this folder** (including the hidden `.github` folder — if you can't see it, enable "Show hidden files" in Explorer, or upload the ZIP's content with GitHub Desktop), and click **Commit changes**.
   - The file `.github/workflows/build.yml` is what tells GitHub to build the app.
3. Open the **Actions** tab. A run called *Build Langram (Windows)* starts automatically (≈4–6 minutes). You can also start it with **Run workflow**.
4. When it turns green, open the run and download **Langram-Windows** under *Artifacts*. Unzip it:
   - `Langram-Setup-1.0.0.exe` — installer
   - `Langram-Portable-1.0.0.exe` — no install, just run (good for USB sticks)
5. Run it on every PC. If Windows Firewall asks, tick **Private networks → Allow**.

Tip: to publish a download link, push a tag like `v1.0.1` — the workflow also creates a GitHub Release with the .exe files.

## Features
Chats with everyone on the Wi-Fi · offline queue (messages & files wait and send automatically) · replies (double-click) · reactions · edit / delete for everyone · forward · Saved Messages · voice messages · audio player bar with previous/next preview · files, images, videos · offline GIF maker (precise trim + mute) · sticker maker (crop any image) · emoji panel with frequently used · profile photo, name, username, bio · dark/light + accent colors · designed chat backgrounds or your own image · tray, notifications, start with Windows.

## Run from source (optional)
`npm install` then `npm start`. Test with two copies on one PC is not supported (single-instance); use two PCs or a VM.
