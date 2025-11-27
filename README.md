# 🎄 Arix Signature Interactive Christmas Tree

> **Digital Haute Couture** meets **High-Performance 3D Web**.
> An experiment in digital luxury, physical materiality, and high-fidelity interaction.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?style=flat&logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-R3F-black.svg?style=flat&logo=three.js)

## 📖 Introduction

**Arix Signature** is a high-fidelity 3D interactive web experience.

Abandoning traditional static modeling, this project utilizes **Procedural Generation** to construct the artifact. The core vision is to evoke an atmosphere of "exaggerated yet restrained" luxury—utilizing deep emerald greens and high-metalness gold PBR materials, combined with cinematic **Bloom** post-processing. The result is a conceptual Christmas tree that appears to be aggregated from thousands of floating jewels.

## ✨ Key Features

### 1. Dual Position System & State Machine

Every particle is assigned two sets of coordinate systems upon initialization, seamlessly transitioning via GLSL matrix interpolation:

- **State A (SCATTERED):** A spherical random distribution based on polar coordinates, simulating floating cosmic dust.
- **State B (TREE_SHAPE):** A cone arrangement based on the **Fibonacci Spiral** algorithm, ensuring perfect visual balance and organic flow.

### 2. High-Performance Instanced Rendering

- Leverages `THREE.InstancedMesh` to render 1500+ independent units in a single **Draw Call**.
- All animation logic (position interpolation, spin, breathing effects) is calculated directly via matrix operations within the `useFrame` loop, ensuring a silky smooth **60FPS** experience.

### 3. Cinematic Post-Processing

- **Unclamped HDR:** Disables standard ToneMapping limits, allowing high dynamic range values.
- **Selective Bloom:** Utilizes `mipmapBlur` to create an ethereal glow strictly on metallic specular highlights.

## 🛠️ Tech Stack

- **Core:** React 19, TypeScript
- **3D Engine:** Three.js, React Three Fiber (R3F)
- **Helpers:** @react-three/drei (Environment, OrbitControls)
- **VFX:** @react-three/postprocessing (EffectComposer, Bloom)
- **Build Tool:** Vite

## 🚀 Quick Start

### 1. Prerequisites

Ensure Node.js (v18+ recommended) is installed on your machine.

### 2. Install Dependencies

```bash
npm install
```

### 3. Start

```bash
npm run dev
```
