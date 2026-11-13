// Clickjacking-Schutz für Seiten ohne eigenes boot(): als ERSTEN Import einbinden
// (import './frame-guard-auto.js';). Steckt die Seite in einer fremden Seite (iframe), ersetzt
// guardFrame() den Inhalt durch einen Hinweis – Formulare und Knöpfe sind dann weg.
import { guardFrame } from './frame-guard.js';

guardFrame();
