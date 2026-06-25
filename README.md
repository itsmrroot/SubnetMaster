# SubnetMaster 🌐

> Interaktiver Subnetting-Trainer für Schüler und Auszubildende im IT-Bereich.
> Übe mit zufälligen Aufgaben, verstehe jeden Fehler Schritt für Schritt — in 6 Sprachen.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Languages](https://img.shields.io/badge/languages-6-orange)
![No Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

### 🔗 [https://itsmrroot.github.io/SubnetMaster/](https://itsmrroot.github.io/SubnetMaster/)

---

## 📸 Überblick

SubnetMaster ist eine vollständig im Browser laufende Web-App mit **drei Seiten**:

| Seite | Datei | Beschreibung |
|-------|-------|-------------|
| 🏋️ **Trainer** | `index.html` | Zufällige Subnetting-Aufgaben mit sofortiger Korrektur |
| 📚 **Lexikon** | `lernen.html` | Subnetting von Null an lernen — mit Diagrammen & interaktivem Rechner |
| 📋 **Anleitung** | `anleitung.html` | Schritt-für-Schritt Lösungsweg mit vollständigem Beispiel |

---

## ✨ Features

- 🎲 **Zufällige Aufgaben** — unbegrenzt, immer andere Zahlen
- 📖 **Schritt-für-Schritt Erklärungen** — bei jedem Fehler wird der Lösungsweg gezeigt
- 📊 **Live-Statistik** — Aufgaben gelöst, Trefferquote, aktuelle Serie
- 🌍 **6 Sprachen** — Deutsch, Englisch, Arabisch (RTL), Türkisch, Französisch, Spanisch
- 🌙 **Dark / Light Mode** — mit localStorage-Speicherung
- ⌨️ **Enter-Navigation** — springt automatisch zur nächsten Frage
- 🧮 **Interaktiver Rechner** — im Lexikon, berechnet alles live
- 💻 **Kein Backend, kein Framework** — läuft als reine HTML/CSS/JS-Datei

---

## 🗂️ Projektstruktur

```
subnetmaster/
│
├── index.html          # Trainer — Hauptseite mit Aufgaben
├── lernen.html         # Lexikon — Theorie mit Diagrammen
├── anleitung.html      # Anleitung — Schritt-für-Schritt Guide
│
├── css/
│   └── style.css       # Gemeinsames Styling (Dark/Light, alle Seiten)
│
└── js/
    ├── lang.js         # Alle Übersetzungen (6 Sprachen)
    └── app.js          # Trainer-Logik, Subnetting-Mathematik
```

---

## 🚀 Starten

### Lokal (ohne Server)

Einfach `index.html` im Browser öffnen:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

> ⚠️ Für lokales Öffnen benötigt man keinen Webserver — alle Dateien werden relativ geladen.

### Mit lokalem Server (empfohlen für Entwicklung)

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# dann im Browser öffnen:
# http://localhost:8080
```

---

## 🌍 GitHub Pages (kostenlos hosten)

1. Repository auf [github.com](https://github.com) erstellen
2. Alle Dateien hochladen (Ordnerstruktur beibehalten!)
3. **Settings → Pages → Branch: `main` → Save**
4. Nach ~2 Minuten erreichbar unter:

```
https://DEIN-USERNAME.github.io/subnetmaster
```

---

## 📦 GitHub Upload — Schritt für Schritt

```bash
# 1. Repository klonen oder neu initialisieren
git init
git remote add origin https://github.com/DEIN-USERNAME/subnetmaster.git

# 2. Alle Dateien hinzufügen
git add .

# 3. Commit
git commit -m "feat: initial release SubnetMaster v1.1.0"

# 4. Pushen
git push -u origin main
```

> 📁 Wichtig: Die Ordner `css/` und `js/` müssen exakt so hochgeladen werden — die HTML-Dateien referenzieren sie relativ.

---

## 📝 Die 10 Subnetting-Fragen

| # | Frage | Formel |
|---|-------|--------|
| a | IP-Klasse | 1.Byte: 1–126=A, 128–191=B, 192–223=C |
| b | Benötigte Subnetze | SR + VW + Reserve → nächste 2er-Potenz |
| c | Entliehene Bits | 2^x = Subnetze → x |
| d | Erforderliche Hostadressen | PCs im größten Raum |
| e | Hostbits | 8 − entliehene Bits |
| f | Präfixlänge | /24 + entliehene Bits |
| g | Subnetzmaske | 4. Byte: Einsen addieren (z.B. 128+64+32+16=240) |
| h | Adressen je Subnetz | 2^(Hostbits) |
| i | Nutzbare Hostadressen | 2^(Hostbits) − 2 |
| j | Theoretisch mögliche Netze | 2^(entliehene Bits) |

---

## 🌐 Unterstützte Sprachen

| Code | Sprache | Richtung |
|------|---------|----------|
| `de` | 🇩🇪 Deutsch | LTR |
| `en` | 🇬🇧 English | LTR |
| `ar` | 🇸🇦 العربية | **RTL** |
| `tr` | 🇹🇷 Türkçe | LTR |
| `fr` | 🇫🇷 Français | LTR |
| `es` | 🇪🇸 Español | LTR |

Die gewählte Sprache wird in `localStorage` gespeichert und beim nächsten Besuch wiederhergestellt.

---

## 🛠️ Technischer Aufbau

### Subnetting-Logik (`js/app.js`)

```js
// Kernfunktionen
nextPow2(n)    // nächste 2er-Potenz ≥ n
howBits(n)     // log₂(n) → Anzahl Bits
maskByte(sb)   // Subnetzmaske 4. Byte berechnen
toBin8(sb)     // Binärdarstellung des 4. Bytes
```

### Aufgaben-Generierung

Aufgaben werden aus **vorvalidierten Paaren** gezogen — so ist garantiert, dass die Anzahl der PCs immer in das berechnete Subnetz passt. Verhindert potenzielle Endlosrekursion bei ungültigen Kombinationen.

```
25 valide (SR, PC)-Kombinationen
3 ungültige Kombinationen automatisch ausgeschlossen
✅ 1000 Aufgaben generiert — zero Fehler (getestet)
```

### Sprach-System (`js/lang.js`)

```js
setLang('ar')   // setzt lang-Attribut + dir="rtl" auf body
getLang()       // gibt das aktive Sprachobjekt zurück
currentLang     // global, aus localStorage
```

### Theme-System

Theme wird **sofort** beim Laden von `app.js` angewendet (vor `DOMContentLoaded`) um Flash of Unstyled Content (FOUC) zu verhindern:

```js
(function() {
  const saved = localStorage.getItem('sm-theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
})();
```

---

## 🐛 Bekannte behobene Bugs (v1.1.0)

| Bug | Beschreibung | Fix |
|-----|-------------|-----|
| Infinite Recursion | SR=8 + PC>14 führte zu Endlosrekursion | Vorvalidierte Paarliste |
| FOUC | Theme-Flash beim Laden | IIFE vor DOMContentLoaded |
| RTL fehlt | Arabisch ohne `dir="rtl"` | `setLang()` setzt `body dir` |
| Doppelter Theme-Init | `applyTheme()` lief zweimal | Duplikat entfernt |

---

## 📄 Lizenz

MIT License — frei verwendbar für Unterricht, Schule und private Projekte.

---

## 👨‍💻 Entwickelt für

Klasse **1aAPC** · Schularbeit AMA · 17.06.2026

---

*Made with ❤️ and Claude AI*