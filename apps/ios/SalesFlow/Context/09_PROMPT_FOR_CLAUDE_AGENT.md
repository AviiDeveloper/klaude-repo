# How to Use This Context Folder

## First Prompt for Xcode Claude Agent

Copy and paste this as your first message:

---

Read all files in the Context/ folder in this project. They contain:
- 01: Project overview and business model
- 02: Complete API reference with request/response shapes
- 03: Design system (Vercel-inspired dark theme with exact hex values)
- 04: Every screen specification with layout descriptions
- 05: Swift data models (Codable structs ready to use)
- 06: App architecture (MVVM, services, file structure)
- 07: Business logic (talking points engine, status transitions, objection scripts)
- 08: Build order (step-by-step, each step should compile)

Start with Step 1 from 08_BUILD_ORDER.md:
1. Create Theme/Colors.swift with all colour constants from 03_DESIGN_SYSTEM.md
2. Create Theme/Typography.swift with the font helpers
3. Create the Codable models from 05_DATA_MODELS.md
4. Create Services/APIClient.swift
5. Create Services/AuthService.swift with Keychain storage

Then immediately proceed to Step 2 (Auth flow) and Step 3 (Tab shell + Leads dashboard).

The app is dark mode ONLY. Use iOS 17+ APIs (@Observable, NavigationStack).
The API is running at http://localhost:4350 for development.
Use SF Pro (system font) — do NOT import custom fonts.
Follow the Vercel-inspired design system EXACTLY from 03_DESIGN_SYSTEM.md.

---

## Subsequent Prompts

After the initial build, use these for iteration:

- "The login screen doesn't match the design system. Make the background pure black, input fields should have #111 background with #333 borders, and the button should be white with black text."
- "Build Step 4 from the build order — the lead detail view with tabs."
- "Add the brief walkthrough from Step 10. Use a TabView with .tabViewStyle(.page) for swipeable cards."
- "The map pins need to be colour-coded by status. Use the colours from 03_DESIGN_SYSTEM.md."
- "Add the camera feature from Step 7. Use AVCaptureSession, not the system photo picker."
