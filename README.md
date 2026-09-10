# Cube Timer

Prosty timer do speedcubingu w jednym pliku HTML. Bez zależności, bez budowania.
Wystarczy otworzyć `index.html` w przeglądarce.

## Funkcje

- **Start/stop spacją** w stylu StackMat: przytrzymaj spację, aż timer zrobi się zielony, puść, aby wystartować. Dowolny klawisz zatrzymuje.
- **Obsługa dotyku**: na telefonie działa tak samo, przez dotknięcie i przytrzymanie ekranu.
- **Generator scramble** dla 3x3x3, 2x2x2 i 4x4x4 (klawisz `N` losuje nowy).
- **Inspekcja 15 s** (opcjonalna) z automatyczną karą +2 / DNF według zasad WCA.
- **Kary**: OK / +2 / DNF, edytowalne po kliknięciu w czas na liście.
- **Statystyki**: najlepszy czas, średnia, ao5, ao12, ao100 oraz najlepsze ao5 i ao12 w sesji.
- **Osobne sesje** dla każdego typu kostki, zapisywane w `localStorage`.
- **Eksport CSV** i czyszczenie sesji.
- Opcja **ukrycia czasu** podczas układania.

## Skróty

| Klawisz | Działanie |
|---------|-----------|
| `Spacja` (przytrzymaj) | start timera / start po inspekcji |
| dowolny klawisz | stop |
| `N` | nowy scramble |
| `Esc` | anuluj inspekcję / zamknij okno |
