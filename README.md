# 🌤️ SkyCast – Weather App

An interactive, API-driven weather web app built with HTML, CSS and JavaScript.

## Features
- Search any city and view current weather and a 7-day forecast (Open-Meteo API, no key needed)
- Filter forecast days (rain likely / warm / cool) and click a day for details
- °C / °F toggle
- Favorite cities, unit choice and last city saved with `localStorage`
- Loading, error and empty states

## Project structure
```
skycast-weather/
├── .github/workflows/deploy.yml   # auto-deploy to GitHub Pages
├── .vscode/                       # VS Code settings & recommended extensions
├── css/style.css
├── js/app.js
├── index.html
├── .gitignore
└── README.md
```

## Run locally (VS Code)
1. Open the folder in VS Code and install the recommended extensions.
2. Right-click `index.html` → **Open with Live Server**.

## Deploy to GitHub Pages
1. Create a new empty repository on GitHub (e.g. `skycast-weather`).
2. In the VS Code terminal:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/skycast-weather.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The workflow runs on every push. Your site will be live at  
   `https://<your-username>.github.io/skycast-weather/`

## Credits
Weather data by [Open-Meteo](https://open-meteo.com/).
