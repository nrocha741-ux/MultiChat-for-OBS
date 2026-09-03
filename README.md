# MultiChat for OBS

**Todos os seus chats. Um só lugar.**

MultiChat for OBS is a local unified live-chat dock for OBS Studio that brings public messages from **Twitch, YouTube, Kick and TikTok** into a single interface.

The project was designed to be simple for streamers: select the platforms, enter the public channel names and connect.

No Twitch, Kick or TikTok account login is required for the current read-only integrations.

---

## ✨ Features

- 🟣 **Twitch** public chat
- 🔴 **YouTube Live** chat
- 🟢 **Kick** public chat
- ⚪ **TikTok LIVE** chat
- 🎬 Native use as an **OBS Custom Browser Dock**
- 🔐 Read-only architecture
- 👤 Avatars when available
- 🏷️ Chat badges and roles
- 😄 Emote/emoji handling
- 🔎 Individual platform filters
- 💾 Channel configuration saved locally
- 🕘 Recent in-memory message history for connected clients
- 🧹 Clear-chat control
- 🧪 Demonstration mode for testing
- 📦 Portable Windows launcher
- ⚙️ Automatic dependency preparation
- 🟢 Local server status monitoring
- 🔄 Automatic recovery/watchdog mechanisms

---

## 🖥️ How it works

MultiChat runs a small local Node.js server on your computer.

The interface is available at:

```text
http://127.0.0.1:8787/dock
```

This address can be opened in a normal browser or added directly to OBS Studio as a **Custom Browser Dock**.

The chat processing happens locally on the streamer's computer.

---

## 🚀 Windows — Portable version

The recommended way to use MultiChat for OBS is through the portable release.

### 1. Download

Go to the **Releases** section of this repository and download the latest stable release.

### 2. Extract

Extract the downloaded package to a folder of your choice.

### 3. Start MultiChat

Run:

```text
MultiChat_START.cmd
```

The launcher will automatically:

1. Check whether the local MultiChat server can start.
2. Prepare the portable Node.js runtime when necessary.
3. Download the required runtime from the official Node.js distribution when it is not already available.
4. Extract the portable runtime.
5. Prepare the required npm dependencies.
6. Start the local MultiChat server.
7. Wait until the server responds correctly.
8. Open the MultiChat interface in your default browser.

When everything is ready, the console displays:

```text
MULTICHAT CONECTADO
```

Keep the launcher window open while using MultiChat.

Closing the launcher also terminates the Node.js instance started by MultiChat.

---

## 🎬 Adding MultiChat to OBS Studio

Start MultiChat first.

Then, in OBS Studio, open:

**Panels → Custom Browser Docks**

Add a new dock using:

```text
http://127.0.0.1:8787/dock
```

Give it a name such as:

```text
MultiChat
```

The MultiChat interface can then remain docked directly inside OBS Studio.

---

## 💬 Connecting platforms

The interface contains independent controls for:

| Platform | Channel format |
|---|---|
| Twitch | `channelname` |
| YouTube | `@handle` |
| Kick | `channelname` |
| TikTok | `@username` |

Check only the platforms you want to use and press:

**Connect chats**

Messages from the selected chats are normalized and displayed in the same feed.

You can also filter the interface by:

**All · Twitch · YouTube · Kick · TikTok**

---

## 🔐 Authentication and privacy

MultiChat was designed around public, read-only chat access whenever technically possible.

### Twitch

Public read-only chat is accessed without requiring the streamer to sign in to Twitch.

### YouTube

YouTube Live integration uses the YouTube Data API.

A YouTube API key may therefore be required for YouTube functionality.

**Never publish your API key or commit a `.env` file containing credentials to a public repository.**

### Kick

Public chat is read without asking the streamer for their Kick username/password or account authorization.

### TikTok

Public LIVE chat is read without requiring the streamer to log in to TikTok.

---

## ⚠️ Platform compatibility

MultiChat communicates with services operated by third parties.

Platform behavior can change independently of this project.

In particular, some integrations rely on public or compatibility mechanisms that may change if the respective platform modifies its website, chat protocol or access rules.

TikTok support uses an unofficial/reverse-engineered LIVE chat mechanism and should therefore be considered more susceptible to upstream platform changes.

Kick browser compatibility may likewise require maintenance if Kick changes its public chat infrastructure.

---

## 🔴 YouTube Live detection

When a configured YouTube channel is not currently live, MultiChat can remain waiting for a broadcast.

It periodically checks for an available LIVE chat and automatically connects when one is detected.

The polling interval is intentionally conservative to reduce unnecessary YouTube Data API quota consumption.

---

## 🟢 Portable Node.js runtime

Users of the portable Windows release do **not** need to manually install Node.js beforehand.

When required, the launcher prepares its own portable Node.js runtime.

The runtime is stored locally and reused on subsequent starts.

This means the first execution can take longer because MultiChat may need to download the runtime and install the required dependencies.

---

## 🛑 Stopping MultiChat

Normally, simply close the MultiChat launcher window.

The Node.js process started by that launcher will be terminated automatically.

A manual stop command is also included:

```text
MultiChat_STOP.cmd
```

For troubleshooting, use:

```text
MultiChat_DEBUG.cmd
```

---

## 🧩 Architecture

MultiChat for OBS uses:

- Node.js
- Express
- Socket.IO
- Browser-based OBS interface
- Platform-specific chat adapters
- Unified message normalization
- Local Socket.IO distribution
- Portable Windows launcher
- Runtime watchdog/recovery mechanisms

Simplified flow:

```text
Twitch ─────┐
YouTube ────┤
Kick ───────┼──> MultiChat local server ──> Unified chat ──> Browser / OBS
TikTok ─────┘
```

More technical information is available in:

```text
docs/ARCHITECTURE.md
```

---

## 📁 Repository structure

```text
MultiChat-for-OBS/
│
├── app/
│   ├── public/
│   ├── server/
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── TROUBLESHOOTING.md
│
├── launcher/
│
├── MultiChat_START.cmd
├── MultiChat_STOP.cmd
├── MultiChat_DEBUG.cmd
│
├── CHANGELOG.md
├── VERSION-HISTORY.md
├── SECURITY.md
├── CONTRIBUTING.md
└── VERSION.txt
```

Runtime directories such as `node_modules` and the portable Node.js runtime are generated locally and should not be committed to the repository.

---

## 🛠️ Development

Developers who already have a compatible Node.js environment can run the application from the `app` directory.

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:8787/dock
```

Environment-specific configuration should remain local and must not contain secrets committed to the public repository.

---

## 📖 Documentation

Additional project information:

- `CHANGELOG.md` — important changes
- `VERSION-HISTORY.md` — development/version history
- `docs/ARCHITECTURE.md` — internal architecture
- `docs/TROUBLESHOOTING.md` — troubleshooting
- `SECURITY.md` — security information
- `CONTRIBUTING.md` — contribution information

---

## 🏁 Version 1.0.0

**MultiChat for OBS v1.0.0 Stable** represents the first public stable release of the project.

The development cycle included implementation and real-world testing of all four supported chat platforms:

- Twitch
- YouTube
- Kick
- TikTok

The application was also validated as an OBS Studio Custom Browser Dock.

---

## 🧪 Tested workflow

The v1.0.0 development cycle included real public-chat testing with different live channels and simultaneous platform connections.

Testing covered:

- simultaneous multi-platform chat
- connection and reconnection
- OBS Custom Browser Dock usage
- browser usage
- channel switching
- message normalization
- usernames and display names
- avatars
- badges/roles
- emoji and emote handling
- portable Node.js runtime
- automatic dependency preparation
- local server startup
- automatic Node.js process termination

---

## 🔒 Security

Do not publish:

- `.env`
- API keys
- access tokens
- passwords
- private credentials

If you discover a security issue, see:

`SECURITY.md`

---

## 🤝 Contributing

Suggestions, bug reports and improvements are welcome.

See:

`CONTRIBUTING.md`

before submitting changes.

---

## 📜 Version history

MultiChat evolved through several development and stabilization stages before reaching v1.0.0.

The complete development history is documented in:

`VERSION-HISTORY.md`

and:

`CHANGELOG.md`

---

## 👨‍💻 Project

**MultiChat for OBS**

Created and maintained by **zKingHit**.

GitHub: **zKingHitAPI**

Designed for streamers who want to follow multiple public live chats from one place directly inside OBS Studio.

---

### MultiChat for OBS

**Twitch · YouTube · Kick · TikTok**

**Todos os seus chats. Um só lugar.**
