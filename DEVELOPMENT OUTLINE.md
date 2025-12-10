# Development Outline

## System Architecture and Data

### Role 
Build "Seamless Mod Swiper," a high-fidelity, desktop-only application (strictly forbidding Electron) that functions as a Tinder-style mod discovery tool.

### Platform 
Desktop application (No Electron).

### Tech Stack 
Must make liberal use of Three.js shaders for premium visual effects.

### API 
Nexus Mods GraphQL only (v2).

### Auth 
Stateless API key. User inputs key on every launch. Never store key.

### Persistence 
Store only User Progress to ensure the same mod NEVER appears twice.

### Output 
Export approved list to clean .txt (Mod Name + Link). No installation/downloading functionality.

## Data Pipeline

### Fetching 
Batch load 50+ mods/request to ensure smooth swiping.

### Visual Feedback: Trigger a cool intro animation whenever a new stack of mod cards is loaded.

### Order 
Completely random (ignore popularity, downloads, or endorsements, trending). If it helps, Nexus has a RANDOM endpoint available.

### Card Data 
Display Title, Author, Thumbnail, Description Snippet, and Full Description (On Hover).

### Game Selection 
Include a dropdown for Cyberpunk 2077, Red Dead Redemption 2, Fallout New Vegas, Baldur's Gate 3, and The Witcher 3. This selection determines which mods are fetched and strictly controls the UI theme.

## UI/UX Requirements

### Landing Page 
Must feature a "modern industrial retro" aesthetic with unique fonts and animations (avoid generic LLM designs).

### Elements 
Title "Seamless Mod Swiper", nice-looking input for "Enter Nexus API", and a "Go!" button.

### Interaction 
Swipe Left (Reject), Swipe Right (Approve).

### Inputs 
Mouse drag, UI Buttons, Keyboard shortcuts (A = left, D = right).

### Visuals 
Display mods as large central cards. Show a small preview of the "next card" for orientation.

### Settings Menu (Gear Icon)
Reset Progress button (must have confirmation dialog).

## Theming Strategy

### Core Directive 
The UI must dynamically and non-negotiably replicate the in-game UI (aesthetic, animations, sound effects, visual styling) of the selected game to the absolute most accurate degree possible.

### Development Scope 
Focus entirely on perfecting the Cyberpunk 2077 theme first. Other games can use placeholder aesthetics until explicitly prompted later.

### Performance
Ensure smooth swiping, fast loading, and responsive design (no lag on batch fetch).
