# Leśne puzzle

Gra o zwierzętach polskich lasów: ułóż obrazek, a zwierzę ożyje. Czysty HTML, CSS i JavaScript, bez instalowania zależności i bez kroku budowania.

Gra działa pod adresem: https://raftum92.github.io/lesne-puzzle-QR-webXR-/app/

## Kody QR: z monitora na telefon

Tryb „W pokoju” (WebXR) kładzie układankę na prawdziwej podłodze lub stole, widzianej przez kamerę telefonu. Komputer tego nie pokaże, więc kod QR przenosi grę na telefon:

1. Na komputerze gracz wybiera poziom i zwierzę, na przykład lisa. Otwiera się okno z dwiema możliwościami: „Ułóż na ekranie” albo kod QR „Ułóż w telefonie”.
2. Gracz skanuje kod aparatem telefonu. Kod zawiera adres gry z wybranym zwierzęciem i poziomem, na przykład `app/?zwierze=lis&poziom=latwy`.
3. Telefon pokazuje nazwę zwierzęcia i przycisk „Ułóż w pokoju” albo „Ułóż z kamerą”. Przeglądarka pozwala otworzyć sesję AR dopiero po dotknięciu, dlatego ten jeden przycisk musi zostać.
4. Dalej gra toczy się jak zwykle w wybranym trybie, a przełącznik w menu telefonu zostaje na tym trybie.

Okno z kodem pojawia się tylko na urządzeniach z myszą, bez AR. Komputer i telefon nie łączą się ze sobą: kod to zwykły adres, a postęp zapisuje się osobno na każdym urządzeniu. Kod QR powstaje w przeglądarce, bez wysyłania czegokolwiek do zewnętrznych usług.

Z podglądu bez HTTPS, na przykład z `localhost`, kod prowadzi na opublikowaną grę (`PUBLIC_URL` w `app/js/telefon.js`), bo telefon nie otworzy cudzego `localhost`, a WebXR wymaga HTTPS.

## Tryb „W pokoju” i tryb „Z kamerą”

Tryb „W pokoju” (WebXR) działa tylko na telefonach z Androidem, Chrome i ARCore. Nie każdy Android ma ARCore: na przykład Moto G13 go nie ma, a pełna lista jest na https://developers.google.com/ar/devices. iPhone'y w ogóle nie obsługują WebXR.

Pozostałe telefony i tablety z kamerą dostają tryb „Z kamerą” (`CameraSession` w `app/js/ar/sesja.js`). Obraz z tylnej kamery leży pod przezroczystą sceną 3D, plansza ma stałe miejsce na ekranie, a elementy leżą pod nią w siatce, gdy ekran jest pionowy. Gdy obraz wstaje, widok sam przechodzi przed ramę, a zwierzę wyskakuje z niej tak samo jak w trybie „W pokoju”. Plansza nie leży na prawdziwej podłodze i nie da się jej obejść, bo bez ARCore przeglądarka nie widzi powierzchni. Kamera gaśnie od razu po wyjściu z gry.

Chrome potrafi zgłosić AR także na telefonie bez ARCore i odmówić dopiero przy starcie sesji. Wtedy gra od razu, bez pytania, przechodzi na tryb „Z kamerą”, a przełącznik w menu zmienia nazwę do końca wizyty na stronie. Przy następnym otwarciu strony gra znów najpierw próbuje trybu „W pokoju”, bo powodem mógł być na przykład brak zainstalowanego ARCore.

Komputer z kamerką nie dostaje tego trybu, tylko okno z kodem QR. Telefon bez kamery, bez zgody na nią albo bez HTTPS gra na ekranie.

## Serwer: GitHub Pages

Gra jest hostowana przez GitHub Pages z gałęzi `main`, katalog główny. Każdy commit na `main` publikuje się sam w ciągu około minuty. Pages daje HTTPS z prawdziwym certyfikatem i obsługuje nagłówek Range, czego wymagają WebXR i odtwarzanie filmów. `index.html` w katalogu głównym przekierowuje do `app/`, a `.nojekyll` wyłącza przetwarzanie plików przez Jekyll.

To rozwiązanie na początek: strona jest publiczna, wszystkie pliki w repozytorium można pobrać, a GitHub ma limity (1 GB na stronę i miękki limit 100 GB ruchu miesięcznie). Przy większym ruchu albo zastosowaniu komercyjnym trzeba przenieść grę na własny serwer. Wystarczy statyczny hosting z HTTPS i Range; kod QR sam użyje nowego adresu.

## Uruchomienie u siebie

```bash
python3 narzedzia/serwer.py
```

Potem w przeglądarce: http://localhost:8000/app/. Testy (Node.js 18 lub nowszy):

```bash
node --test test/
```

Ekran po zeskanowaniu kodu sprawdzisz w symulatorze AR, bez telefonu: `http://localhost:8000/app/?ar=symulacja&zwierze=lis&poziom=latwy`. Lewy przycisk myszy działa jak palec, a strzałki krążą kamerą. Tryb z kamerą wymusza `?ar=kamera` (potrzebna kamerka w komputerze). Oba parametry działają tylko na `localhost` i `127.0.0.1`.

Na telefonie, przez kabel USB z włączonym debugowaniem:

```bash
adb reverse tcp:8000 tcp:8000
```

Potem w Chrome na telefonie: `http://localhost:8000/app/?debug=1`. Parametr `debug=1` pokazuje licznik klatek, a konsola jest dostępna przez `chrome://inspect`.

## Struktura

| Ścieżka | Zawartość |
|---------|-----------|
| `app/` | Aplikacja: ekran tytułowy, menu z 9 zwierzętami i 3 poziomami trudności, puzzle, ożywający obraz i informacja o zwierzęciu |
| `app/js/main.js` | Start aplikacji, przełączanie ekranów, historia przeglądarki, ekran po zeskanowaniu kodu |
| `app/js/telefon.js` | Adres w kodzie QR i odczytanie zwierzęcia i poziomu z adresu |
| `app/js/qr.js` | Generator kodów QR, bez bibliotek |
| `app/js/dialogi.js` | Okna dialogowe, w tym wybór ekranu albo telefonu |
| `app/js/menu.js`, `app/js/gra.js`, `app/js/puzzle.js` | Menu, ekran gry i plansza |
| `app/js/ar/` | Tryby „W pokoju” i „Z kamerą”: sesja WebXR albo obraz z kamery, plansza w 3D, obraz w ramie, skok zwierzęcia z ramy |
| `app/vendor/` | Three.js 0.170.0 i jego licencja; ładuje się tylko w trybach „W pokoju” i „Z kamerą” |
| `app/media/czcionki/` | Czcionki Fraunces i Inter (WOFF2, zmienna grubość, znaki łacińskie i polskie) z licencjami SIL OFL 1.1 |
| `assets/filmy/` | Filmy 1920×1080 do gry na ekranie |
| `assets/filmy-720p/` | Lżejsze filmy 1280×720 do trybu „W pokoju” |
| `assets/filmy-skok/` | Filmy, w których zwierzę wyskakuje z ramy w trybie „W pokoju” |
| `narzedzia/serwer.py` | Serwer do podglądu z obsługą nagłówka Range |
| `test/` | Testy logiki gry, kodów QR i trybu „W pokoju” |

Dokumentacja, narzędzia do filmów i materiały źródłowe, na które wskazują niektóre komentarze w kodzie, są w prywatnym repozytorium `lesne-puzzle-WebXR`. To repozytorium jest publiczne, więc zawiera tylko to, co jest potrzebne do działania gry i jej testów.

## Przed oficjalną publikacją

- Sprawdzić z prawnikiem zdanie o kamerze w „Informacjach prawnych” oraz to, czy wzmianka o AI spełnia art. 50 AI Act.
- W „Informacjach prawnych” jako właściciel praw figuruje „Leśne puzzle”. Wpisać tam wydawcę: imię i nazwisko albo nazwę firmy.
