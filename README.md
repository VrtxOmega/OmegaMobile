<div align="center">
  <img src="https://raw.githubusercontent.com/VrtxOmega/Gravity-Omega/master/omega_icon.png" width="100" alt="VERITAS" />
  <h1>GRAVITY OMEGA MOBILE</h1>
  <p><strong>Android Client for the Gravity Omega AI Platform</strong></p>
  <p><em>Examina omnia, venerare nihil, pro te cogita.</em></p>
</div>

![Status](https://img.shields.io/badge/Status-ACTIVE-success?style=for-the-badge&labelColor=000000&color=d4af37)
![Platform](https://img.shields.io/badge/Platform-Android-brightgreen?style=for-the-badge&labelColor=000000)
![Stack](https://img.shields.io/badge/Stack-React%20Native-informational?style=for-the-badge&labelColor=000000)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&labelColor=000000)

---

The mobile extension of [Gravity Omega](https://github.com/VrtxOmega/Gravity-Omega) — a React Native Android client that connects to your desktop AI platform via WebSocket bridge. Issue commands, receive intelligence, and monitor your sovereign stack from anywhere.

> *Question everything, worship nothing, think for yourself.*

## Architecture

`
+---------------------------+          +---------------------------+
|  OMEGA MOBILE (Android)   |  <-WS->  |  GRAVITY OMEGA (Desktop)  |
|  React Native             |          |  Electron + Python        |
|  Chat UI + Push Notifs    |          |  LLM Backend + Executor   |
+---------------------------+          +---------------------------+
        |                                        |
        +--- localtunnel NAT traversal ----------+
`

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Mobile App** | React Native | Chat interface, push notifications, voice input |
| **Transport** | WebSocket | Real-time bidirectional communication |
| **NAT Traversal** | localtunnel | Internet passthrough for remote access |
| **Desktop Bridge** | Python (mobile_bridge.py) | Message routing, command execution |

## Features

- **Remote AI Chat** - Full conversational access to your desktop Omega instance
- **Push Notifications** - Real-time alerts from Sovereign Sentinel monitoring
- **Voice Input** - Speech-to-text for hands-free interaction
- **Code Execution** - Trigger desktop code execution from your phone
- **System Status** - Monitor service health across your sovereign stack
- **Offline Queue** - Messages queued when disconnected, delivered on reconnect

## Quick Start

### Requirements
- Android device or emulator
- React Native development environment
- Desktop Gravity Omega instance running

### Install

`ash
npm install

# Deploy to connected Android device
npm run android
`

### Connect to Desktop

Ensure your desktop `mobile_bridge.py` daemon is running and localtunnel is active. The app auto-discovers the bridge endpoint on startup.

## License

MIT

---

<div align="center">
  <sub>Built by <a href="https://github.com/VrtxOmega">RJ Lopez</a> | VERITAS Framework</sub>
</div>