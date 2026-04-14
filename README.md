# ShareRecipes

A full-stack recipe sharing platform built with Angular and Flask,
featuring smart ingredient-based search, role-based access control,
and a hands-free voice-assisted cooking mode.

## Features

- **Smart Search** — Algorithm that ranks recipes by ingredient
  availability and personal match percentage
- **Authentication** — Register, login, and personal profile management
- **Recipe Management** — Upload, edit, and share recipes with
  automatic image variant generation
- **Ratings & Comments** — Community-driven feedback system
- **Favorites** — Save and manage favorite recipes
- **Categories** — Browse and filter recipes by category
- **Public Profiles** — View other users' profiles and their recipes
- **Admin Dashboard** — Full content moderation and user management
- **RBAC** — Role-based access control with defined permission levels

### 🎙️ Hands-Free Voice Cooking Mode

A fully hands-free cooking experience powered by the Web Speech API.
The system listens for Hebrew voice commands and responds with
speech synthesis optimized for the kitchen (slower rate, full volume).

The mode runs across two screens:
- **Ingredients** — visual list read aloud automatically
- **Steps** — step-by-step navigation with voice commands

Each step is dynamically enriched using a RegEx algorithm that
detects ingredient names within the instructions and injects their
exact quantities in real time — so instead of hearing
*"add flour"*, you hear *"add 2 cups of flour"*.

Voice commands include: next step, previous step,
repeat step, ingredients, stop, and more.

## Tech Stack

**Frontend**
- Angular, TypeScript, HTML, CSS

**Backend**
- Python, Flask
- SQLAlchemy, SQLite
- Pillow (image processing)

## Getting Started

### Prerequisites
- Node.js
- Python 3.x

### Installation

**Backend**
```bash
cd backend
pip install -r requirements.txt
python server.py
```

**Frontend**
```bash
cd frontend
npm install
ng serve
```

Open `http://localhost:4200` in your browser.
