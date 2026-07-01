# 🏛️ Virtual Campus Open Day (MVP)

An immersive, cross-platform 3D exploration application designed to bring the campus experience directly to prospective students. 

This project utilizes real-world photogrammetry and 3D building scans, heavily optimized for performance, to create a navigable virtual environment. Built in **Unreal Engine 5**, the application features a dynamic "Dual-Pawn" system that seamlessly supports both fully immersive standalone VR headsets and standard flat-screen devices (PC/Mobile) without requiring different builds.

## ✨ Key Features
* **True-to-Scale 3D Environments:** High-fidelity architectural scans processed through Blender for severe decimation and retopology to ensure smooth performance.
* **Hybrid Cross-Platform Support:** * **VR Mode:** Native teleportation locomotion and hand-tracking support for standalone headsets (e.g., Meta Quest).
* **Flat-Screen Mode:** Standard WASD/Mouse first-person controls and mobile virtual joysticks for users without VR hardware.
* **Optimized for Mobile Render Pipelines:** Forward shading and pre-baked lighting to maintain high framerates on mobile VR chips (Snapdragon XR2) and standard smartphones.

## 🛠️ Tech Stack & Tools
* **Game Engine:** Unreal Engine 5 (Mobile/Tablet Target Hardware)
* **3D Pipeline:** Photogrammetry generation & LiDAR -> Blender (Centering, Scaling, Decimation) -> `.fbx` export
* **Version Control:** Git & GitHub (with Git Large File Storage)
* **Methodology:** Agile (XP) aiming for a 6-month MVP delivery.

## 🤝 XP Collaboration & Version Control Rules

This project utilizes Extreme Programming (XP) and Trunk-Based Development. 

* **Single Source of Truth:** We push directly to `main` (or use < 24-hour temporary branches). Ensure your local `main` is pulled and up-to-date before starting any work.
* **Pair Programming Default:** Major architectural tasks, complex Blueprint logic, and difficult retopology workflows should be tackled in pairs to maintain code quality and prevent binary asset collisions.
* **Continuous Integration:** At the end of every development day, the `main` branch must compile successfully into a testable build. Do not push broken references or uncompiled Blueprints.
* **Test-Driven Development:** Utilize Unreal's Automation Framework for core mechanics. If you add a new interactive element, add a functional test for it.

---

## 🚀 Getting Started for Developers

**⚠️ IMPORTANT: You MUST have Git LFS installed before cloning this repository. If you clone without LFS, the massive binary `.uasset` and `.umap` files will corrupt.**

### 1. Initial Setup
1. Download and install [Git LFS](https://git-lfs.com/).
2. Open your git bash terminal and initialize LFS on your machine:
   ```bash
   git lfs install

## 📊 Project Progress

Automatically updated every Monday from our ClickUp board.
Reference images: **[Campus Reference Images](https://belgiumcampusacza.sharepoint.com/:f:/s/PRJ3812026-STE-BCOM-Group3/IgBQnndqW5BwQLvyJaraki-zAdYiY74ln2q9eea4nOrb1PQ?e=GDixEC)**

<!-- PROGRESS-REPORT:START -->
### Weekly Progress Report — 02 Jul 2026

_Reporting window: 25 Jun – 02 Jul 2026 · generated automatically from ClickUp_

| Metric | Count |
|---|---|
| Total tickets on board | 0 |
| ✅ Done (all time) | 0 |
| 🔄 In progress | 0 |
| 📋 To do | 0 |
| 🎉 Completed this week | 0 |
| 🆕 Created this week | 0 |

> No tickets on the ClickUp board yet. Once the team starts
> logging tasks, this report will fill in automatically.

<!-- PROGRESS-REPORT:END -->