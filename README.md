# Cube Timer

Timer do speedcubingu w jednym pliku HTML. Bez zależności, bez budowania.
Wystarczy otworzyć `index.html` w przeglądarce, na komputerze lub telefonie.

## Układ (wersja na komputer)

Układ w stylu csTimera, ciemny motyw:

- **Lewy panel**: wybór sesji (z przyciskami: nowa, zmiana nazwy, usuń), wybór konkurencji, skrócone statystyki i lista czasów. Na dole przyciski Statystyki (wykres czasów i ao12 plus pełne zestawienie), CSV i Wyczyść.
- **Góra**: scramble z przyciskami poprzedni / następny (klawisze `P` / `N`) i ikoną ustawień.
- **Środek**: duży zegar, po ułożeniu przyciski OK / +2 / DNF / Usuń.
- **Dół po prawej**: panel z obrazkiem scramble (kliknięcie powiększa) i panel ao5 / ao12 / ao100 / mean. Oba można ukryć w ustawieniach.

Zmiana konkurencji nie zmienia sesji: sesja zapamiętuje wybraną konkurencję, a czasy zostają na miejscu. Wszystkie okna dialogowe są własne, więc działają także w piaskownicy (np. w opublikowanym artefakcie), gdzie systemowe `prompt`/`confirm` są blokowane.

Wersja na telefon jest planowana osobno.

## Sesje

Każda sesja ma własną nazwę, konkurencję i listę czasów. Można mieć kilka sesji dla tej samej konkurencji (np. „3x3 rano”, „3x3 OH”). Dane zapisują się w `localStorage`.

## Konkurencje

Wszystkie oficjalne konkurencje WCA poza Fewest Moves i Multi-Blind, plus FTO:

| Konkurencja | Scramble | Obrazek | Format | Inspekcja |
|-------------|----------|---------|--------|-----------|
| 2x2x2 | 9–11 ruchów R/U/F | siatka kostki | ao5 | tak |
| 3x3x3, 3x3x3 jedną ręką | 20 ruchów | siatka kostki | ao5 | tak |
| 4x4x4, 5x5x5 | 40 / 60 ruchów z ruchami szerokimi (Rw) | siatka kostki | ao5 | tak |
| 6x6x6, 7x7x7 | 80 / 100 ruchów, w tym 3Rw | siatka kostki | mo3 | tak |
| 3x3x3 bez patrzenia | 20 ruchów + orientacja (Rw/Fw/Uw) | siatka kostki | mo3 | nie |
| 4x4x4 / 5x5x5 bez patrzenia | jak 4x4 / 5x5 + rotacje x/y/z | siatka kostki | mo3 | nie |
| Clock | notacja WCA: 9 ruchów, y2, 5 ruchów, końcowe piny | obie strony zegara z pinami | ao5 | tak |
| Megaminx | 7 linii R++/D-- zakończonych U/U' | dwie „rozety” (U i D) | ao5 | tak |
| Pyraminx | 10 ruchów + tipsy | siatka czworościanu | ao5 | tak |
| Skewb | 11 ruchów (notacja FCN) | siatka kostki | ao5 | tak |
| Square-1 | 12–14 par (a,b) z symulacją legalności cięcia | warstwa górna i dolna, warstwa środkowa | ao5 | tak |
| FTO (Face-Turning Octahedron) | 30 ruchów na 8 ścianach | dwie siatki trójkątne (U i D) | ao5 | tak |

Obrazki scramble są liczone geometrycznie: każda naklejka to wielokąt na bryle foremnej, ruch obraca wybrane naklejki wokół osi, a siatka powstaje przez rozłożenie ścian wzdłuż wspólnych krawędzi. Obrazki można wyłączyć w ustawieniach.

## Funkcje timera

- **Start w stylu StackMat**: przytrzymaj spację (lub ekran na telefonie), aż timer zrobi się zielony, puść, aby wystartować. Dowolny klawisz lub dotknięcie zatrzymuje.
- **Inspekcja 15 s** (opcjonalna, wyłączona w konkurencjach bez patrzenia) z automatyczną karą +2 / DNF według zasad WCA.
- **Kary** OK / +2 / DNF i usuwanie ułożenia, także z listy czasów i wykresu.
- **Średnie WCA**: 5% odcinane z każdej strony, DNF w średniej tylko gdy jest ich więcej niż odcinanych.
- Czasy z dokładnością do setnych, opcja **ukrycia czasu** podczas układania.
- **Eksport CSV** i czyszczenie sesji.

## Skróty

| Klawisz | Działanie |
|---------|-----------|
| `Spacja` (przytrzymaj) | start timera / start po inspekcji |
| dowolny klawisz | stop |
| `N` | nowy scramble |
| `Esc` | anuluj inspekcję / zamknij okno |
