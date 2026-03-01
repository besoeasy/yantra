<div align="center">

# Yantr

**Turn the machine you already own into a powerful, isolated homelab.**

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/besoeasy/yantr/pkgs/container/yantr)
[![Vue](https://img.shields.io/badge/Vue-3-42b883?style=for-the-badge&logo=vue.js&logoColor=white)](https://vuejs.org)
[![License](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](LICENSE)

</div>

---

## Why Yantr?

Most homelab platforms (like Umbrel, CasaOS, or Proxmox) demand total hardware control. They want to be the Operating System, requiring you to dedicate and wipe a machine just to run a few network apps.

**Yantr flips the model.**

It is a lightweight, self-hosted App Store that runs *alongside* your existing OS. Whether you are using a daily-driver MacBook, a gaming PC, or an existing Linux server, Yantr lets you spin up powerful software instantly without taking over your machine.

- **Zero OS Footprint:** Yantr never touches your host filesystem. Everything runs exclusively in isolated Docker containers and virtual volumes.
- **No Dependency Hell:** Run complex AI models, media servers, and databases simultaneously. Because everything is isolated, you will never face a Python, Node, or CUDA version conflict.
- **Install, Use, Destroy:** Spin up an app, use it, and delete it. No leftover registry keys, background services, or hidden configuration files scattered across your system.

<br/>

## Quick Start

Launch Yantr in seconds with a single command. Requires Docker.

```bash
docker run -d \
  --name yantr \
  -p 80:5252 -p 443:5252 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/lib/docker/volumes:/var/lib/docker/volumes \
  --restart unless-stopped \
  ghcr.io/besoeasy/yantr
```

Navigate to `http://localhost` in your browser. You are ready to go.

<br/>

## Core Features

- **One-Click Deploys:** 100+ pre-configured apps ready to launch instantly.
- **High-End UI:** A sleek, monochrome interface inspired by modern dev tools (Linear/Vercel). Fast, data-dense, and beautifully animated.
- **Temporary Installs:** Set an expiration timer. Yantr will automatically delete the app and securely prune its data when time is up.
- **Direct Volume Access:** Built-in WebDAV allows you to browse, manage, and sync your container data directly from the browser.
- **S3 Backups:** One-click backup and restore of Docker volumes to any S3-compatible cloud storage (like AWS or local MinIO).
- **No Lock-In:** Yantr translates everything to standard Docker Compose under the hood. You maintain complete control.

<br/>

---

<div align="center">
  <br/>
  <a href="https://github.com/besoeasy/yantr/issues">Report an Issue</a> • <a href="apps/apps.md">Submit an App</a>
  <br/>
</div>
