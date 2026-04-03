<p align="center">
  <img src="https://raw.githubusercontent.com/RJLopezAI/EasyStreet/master/lib/theme/logo.png" width="300" alt="VERITAS Logo" />
</p>

# Gravity Omega Mobile Client

> *Examina omnia, venerare nihil, pro te cogita.*  
> (Question everything, worship nothing, think for yourself)

> [!NOTE]  
> This repo contains the **Sovereign Frontblock** for the agentic backend ecosystem, enabling complete, high-assurance remote orchestration from any Android terminal.

**Omega Mobile** is the React Native communication bridge to the [Gravity Omega](https://github.com/RJLopezAI/Gravity-Omega) Desktop Hub. It establishes a multi-layered, persistent WebSocket pipeline back to your primary intelligence daemon—enabling total agentic control from your mobile device regardless of your network context or proxy restrictions.

---

## ⚡ Architecture & Subsystems

This frontend works in complete synchronization with the `veritas-omega` architecture. By shifting from standard REST to a dedicated duplex WebSocket tunnel over Localtunnel, Omega Mobile implements structural capabilities designed for reliability in adversarial/interrupted network conditions.

### Biometric Vault Keying
Pairing is authenticated entirely offline using a proprietary JSON Web Token handoff embedded in a visual QR configuration. Scanning the QR transfers the initial cryptographic material, allowing immediate connection resolution via the tunnel infrastructure. Due to Android instability with deep biometric hardware calls on some devices, security is currently persisted via high-speed asynchronous local shielding. 

### Heartbeat Tunnel Persistence
Localtunnel, a robust but aggressive proxy layer, severs "idle" protocols after 15 seconds to free up bandwidth. This client implements a hyper-aggressive `INTERVAL=10s` active pinging heart rhythm the instant an authorized tunnel connects. Your WebSocket connection remains perpetually locked—allowing the application to background, window-in-window, or screen-lock without ever shedding the established socket.

### Cross-App Intelligence Control
Includes 4 primary modules driven by the backend `mobile_bridge.py` endpoints:
- **Terminal View** (Dashboard status, NAEF compliance reports)
- **Veritas Vault** (Live query database against your system-archived knowledge items)
- **Command Engine** (Bi-directional chat context for Ollama Llama/Qwen models)
- **Aegis Protect** (Direct system scan and execution tracking)

---

## 🛠 Operation & Deployment

### Dependencies
Required prior to build:
- **React Native CLI & Android SDK**
- **Gravity Omega Hub** running on the host target with `mobile_bridge.py` active
- `npx localtunnel` (Required for tunneling beyond the LAN)

### Build Pipeline (Android)
To compile a hardened `Release` variant:
```bash
git clone https://github.com/VRTXOmega/OmegaMobile.git
cd OmegaMobile

npm install

cd android
./gradlew assembleRelease
```
The compiled binary will be placed in `android/app/build/outputs/apk/release/app-release.apk`. Use standard `adb install -r` to side-load onto your Android terminal. 

### Connecting the Bridge
In `src/services/WebSocketService.js`, you'll notice a `connectionData` stub. Either:
1. Hardcode your personal tunnel string directly into the stub (e.g. `your-localtunnel-subdomain.loca.lt`) to enable one-click automatic binding, OR
2. Generate the QR from the `Gravity Omega` desktop Settings pane and scan it within the app for a localized, dynamic configuration transfer.

The WebSocket requires the explicit `Bypass-Tunnel-Reminder: true` injection in its handshake headers to bypass normal HTTP interstitial blockers deployed by proxies. The `WebSocketService` module handles this header injection silently.

***
**VERITAS Intelligence Directorate — Build 2026-Omega**
