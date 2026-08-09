# Kinetix: 3D Gesture Sculptor 🖐️✨

[![Netlify Status](https://api.netlify.com/api/v1/badges/0ed10c19-6d5e-4b03-9c6b-38281ffbc1a1/deploy-status)](https://app.netlify.com/projects/kinetix-demo/deploys)

**Kinetix** is a real-time Air-Drawing & 3D Gesture Canvas application. It leverages your webcam and advanced client-side AI hand-tracking to let you paint, draw, and sculpt glowing 3D objects in thin air using nothing but hand gestures.

Built with a sleek, cyberpunk-inspired dark-mode aesthetic, Kinetix bridges the gap between physical movement and digital art.

## ✨ Features

- **AI Hand Tracking:** Uses Google's MediaPipe Tasks Vision for lightning-fast, entirely client-side hand and knuckle tracking. No images are sent to any server.
- **2D Air-Drawing Mode:** Pinch your index finger and thumb together to draw glowing neon strokes directly onto the screen.
- **3D WebGL Sculpting Mode:** Switch to 3D mode and pinch to spawn dynamic, physics-enabled geometric shapes that float in a 3D environment.
- **Aggressive Bloom Physics:** Features an intensely glowing 3D lighting engine using React Three Postprocessing and emissive materials.
- **Gesture Controls:**
  - 🤏 **Pinch:** Draw / Spawn 3D Objects
  - 🖐️ **Open Palm:** Clear the entire canvas
  - 👌 **"OK" Sign:** Hold for 0.5 seconds to cycle through the neon color palette!
  - ✌️ **Peace Sign:** Pause drawing / Idle
- **Progressive Web App (PWA):** Installs seamlessly on your devices with offline caching via a custom Service Worker.

## 🛠️ Technology Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS & Aceternity UI
- **Animations:** Framer Motion
- **AI / Computer Vision:** `@mediapipe/tasks-vision`
- **3D Engine:** Three.js, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- **Testing:** Playwright

## 🚀 Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app. Ensure you grant webcam permissions when prompted!

## 🌐 Deployment

This project is configured for seamless deployment on Netlify. It automatically builds the Next.js production bundle and serves it on the edge.
