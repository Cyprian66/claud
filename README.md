# Cube Timer

Prosty timer do speedcubingu w jednym pliku HTML. Bez zależności, bez budowania.
Wystarczy otworzyć `index.html` w przeglądarce (na komputerze lub telefonie).

## Konkurencje

Wszystkie oficjalne konkurencje WCA poza Fewest Moves, plus FTO:

| Konkurencja | Scramble | Format | Inspekcja |
|-------------|----------|--------|-----------|
| 2x2x2 | 9–11 ruchów R/U/F | ao5 | tak |
| 3x3x3, 3x3x3 jedną ręką | 20 ruchów | ao5 | tak |
| 4x4x4 | 40 ruchów z ruchami szerokimi (Rw) | ao5 | tak |
| 5x5x5 | 60 ruchów z ruchami szerokimi | ao5 | tak |
| 6x6x6, 7x7x7 | 80 / 100 ruchów, w tym 3Rw | mo3 | tak |
| 3x3x3 bez patrzenia | 20 ruchów + losowa orientacja (Rw/Fw/Uw) | mo3 | nie |
| 4x4x4 / 5x5x5 bez patrzenia | jak 4x4 / 5x5 + rotacje x/y/z | mo3 | nie |
| Clock | notacja WCA: 9 ruchów, y2, 5 ruchów, końcowe piny | ao5 | tak |
| Megaminx | 7 linii R++/D-- zakończonych U/U' | ao5 | tak |
| Pyraminx | 10 ruchów + tipsy | ao5 | tak |
| Skewb | 11 ruchów | ao5 | tak |
| Square-1 | 12–14 par (a,b) / z symulacją legalności cięcia | ao5 | tak |
| FTO (Face-Turning Octahedron) | 30 ruchów na 8 ścianach (U, D, F, B, L, R, BL, BR) | ao5 | tak |

Każda konkurencja ma osobną sesję zapisywaną w `localStorage`.

## Funkcje

- **Start/stop spacją** w stylu StackMat: przytrzymaj spację, aż timer zrobi się zielony, puść, aby wystartować. Dowolny klawisz zatrzymuje.
- **Obsługa dotyku**: na telefonie działa tak samo, przez dotknięcie i przytrzymanie ekranu.
- **Inspekcja 15 s** (opcjonalna, wyłączona w konkurencjach bez patrzenia) z automatyczną karą +2 / DNF według zasad WCA.
- **Kary**: OK / +2 / DNF, edytowalne po kliknięciu w czas na liście.
- **Statystyki**: najlepszy czas, średnia, ao5, ao12, ao100 oraz najlepsze ao5 i ao12 (format ao) albo mo3 i najlepsze mo3 (format mo3). Średnie liczone według zasad WCA: 5% odcinane z każdej strony, DNF w średniej tylko gdy jest ich więcej niż odcinanych.
- **Eksport CSV** i czyszczenie sesji.
- Opcja **ukrycia czasu** podczas układania.

## Skróty

| Klawisz | Działanie |
|---------|-----------|
| `Spacja` (przytrzymaj) | start timera / start po inspekcji |
| dowolny klawisz | stop |
| `N` | nowy scramble |
| `Esc` | anuluj inspekcję / zamknij okno |
