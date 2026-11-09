# Leśne puzzle

Gra o zwierzętach polskich lasów: ułóż obrazek, a zwierzę ożyje. Czysty HTML, CSS i JavaScript, bez instalowania zależności i bez kroku budowania.

Gra działa pod adresem: https://pomoceedukacyjne.pl/puzzle/app/. Wersja z gałęzi `main` jest też na GitHub Pages: https://raftum92.github.io/lesne-puzzle-QR-webXR-/app/

## Kody QR: z monitora na telefon

Gra jest pomyślana jako stanowisko w Centrum Nauki Experyment: zwiedzający układają obrazki głównie na monitorze, a telefon jest dodatkiem. Tryb „W przestrzeni” (WebXR) zawiesza pionową układankę w prawdziwym pokoju, widzianym przez kamerę telefonu. Monitor tego nie pokaże, więc kod QR przenosi jedno zwierzę na telefon:

1. Na monitorze zwiedzający wybiera poziom i zwierzę, na przykład lisa. Otwiera się okno z dużym obrazkiem i przyciskiem „Ułóż na ekranie” (domyślny, działa też Enter). Obok jest mniejszy kod QR „Dodatkowo: ułóż w telefonie” z informacją, że najlepiej działa na Androidzie w Chrome, na telefonie z ARCore, a na innych telefonach, także na iPhonie, układa się na tle obrazu z kamery.
2. Zwiedzający skanuje kod aparatem telefonu. Kod zawiera adres gry z wybranym zwierzęciem i poziomem, na przykład `app/?zwierze=lis&poziom=latwy`.
3. Telefon pokazuje nazwę zwierzęcia i przycisk „Ułóż w przestrzeni” albo „Ułóż z kamerą”. Przeglądarka pozwala otworzyć sesję AR dopiero po dotknięciu, dlatego ten jeden przycisk musi zostać.
4. Telefon ma tylko to jedno zwierzę: nie ma menu ani przycisku „Następne zwierzę”, a wyjście z gry wraca do ekranu tego zwierzęcia, także po odświeżeniu strony. Kolejne zwierzę wybiera się przy monitorze.

Okno z kodem pojawia się na monitorze, także dotykowym, a nie na telefonie ani tablecie (`isHandheld` w `app/js/telefon.js` rozpoznaje je po przeglądarce, nie po ekranie dotykowym). Monitor i telefon nie łączą się ze sobą: kod to zwykły adres, a postęp zapisuje się osobno na każdym urządzeniu. Kod QR powstaje w przeglądarce, bez wysyłania czegokolwiek do zewnętrznych usług.

Z podglądu bez HTTPS, na przykład z `localhost`, kod prowadzi na opublikowaną grę (`PUBLIC_URL` w `app/js/telefon.js`), bo telefon nie otworzy cudzego `localhost`, a WebXR wymaga HTTPS.

## Tryb „W przestrzeni” i tryb „Z kamerą”

Tryb „W przestrzeni” (WebXR) działa tylko na telefonach z Androidem, Chrome i ARCore. Plansza wisi w nim przodem do gracza, jak na sztaludze albo pulpicie, a elementy leżą pod nią w siatce. Leżącą planszę widać z telefonu pod zbyt ostrym kątem. Gra nie szuka podłogi, bo na słabszych telefonach ARCore długo jej nie znajduje albo gubi ją co chwilę: obrys planszy wisi tam, gdzie celuje telefon, i idzie za nim, a dotknięcie ekranu zostawia planszę w tym miejscu, przypiętą kotwicą ARCore (`aimSpot` w `app/js/ar/uklad.js`). Telefon w pionie widzi w poziomie tylko około 33°, więc elementy nie leżą po bokach planszy, bo wtedy wisiałaby kilka metrów dalej. Mała plansza (50 cm) wisi około 1 m od gracza, a duża (80 cm) około 1,5 m, tak żeby razem z elementami mieściła się w kadrze. Odległość wynika z kąta widzenia aparatu, więc na innych telefonach może być trochę inna. Gdy gracz chodzi, kuca albo wstaje, a także gdy ARCore przesunie kotwicę, plansza płynnie obraca się przodem do telefonu: w bok i, gdy wisi niżej niż telefon, do tyłu jak pulpit. Z boku albo z góry widać by ją pod zbyt ostrym kątem. Po ułożeniu obraz nie wstaje, tylko wysuwa się z planszy i rośnie. Three.js rysuje tu przez XRWebGLLayer, nie przez XRProjectionLayer: Chrome 143 na Androidzie ma pole `renderState.layers` także bez funkcji „layers”, ale obrazu z tej warstwy nie widać (`setSessionWithoutLayers` w `app/js/ar/sesja.js`). Nie każdy Android ma ARCore: na przykład Moto G13 go nie ma, a pełna lista jest na https://developers.google.com/ar/devices. iPhone'y w ogóle nie obsługują WebXR.

Pozostałe telefony i tablety z kamerą dostają tryb „Z kamerą” (`CameraSession` w `app/js/ar/sesja.js`). Obraz z tylnej kamery leży pod przezroczystą sceną 3D, plansza ma stałe miejsce na ekranie, a elementy leżą pod nią w siatce, gdy ekran jest pionowy. Gdy obraz wstaje, widok sam przechodzi przed ramę, a zwierzę wyskakuje z niej tak samo jak w trybie „W przestrzeni”. Plansza leży tu płasko, nie stoi na prawdziwej podłodze i nie da się jej obejść, bo bez ARCore przeglądarka nie widzi powierzchni. Kamera gaśnie od razu po wyjściu z gry.

Chrome potrafi zgłosić AR także na telefonie bez ARCore i odmówić dopiero przy starcie sesji, różnymi błędami, zależnie od tego, co gracz zrobi z prośbą o instalację ARCore. Dlatego po każdym nieudanym starcie trybu „W przestrzeni” gra od razu, bez pytania, przechodzi na tryb „Z kamerą”, a przełącznik w menu zmienia nazwę do końca wizyty na stronie. Przy następnym otwarciu strony gra znów najpierw próbuje trybu „W przestrzeni”, bo powodem mógł być na przykład brak zainstalowanego ARCore.

Gdy nie ruszy też kamera, okno z błędem kończy się kodem, np. „Kod błędu: xr NotSupportedError, kamera NotReadableError”. Po nim widać, co poszło nie tak na telefonie, którego nie da się podłączyć do komputera.

Monitor z kamerką, także dotykowy, nie dostaje tego trybu, tylko okno z kodem QR. Telefon bez kamery, bez zgody na nią albo bez HTTPS gra na ekranie.

Sprawdzone na prawdziwych telefonach 7 listopada 2026: telefon z ARCore gra w trybie „W przestrzeni”, a Moto G13 (bez ARCore) w trybie „Z kamerą”, po zeskanowaniu kodu QR z monitora. Na iPhonie tryb „Z kamerą” nie był jeszcze sprawdzany.

## Serwer: pomoceedukacyjne.pl

Kody QR prowadzą na https://pomoceedukacyjne.pl/puzzle/app/ (`PUBLIC_URL` w `app/js/telefon.js`). Gra leży tam w folderze `httpdocs/puzzle/` na serwerze Plesk w artnet (`v46197.artnet.gda.pl`, 178.255.46.197), obok strony głównej domeny. DNS i https daje Cloudflare: domena główna i `www` idą przez jego proxy, a poczta i FTP prosto na serwer.

Nową wersję wgrywa się przez FTPS (FTP z TLS, port 21): pliki `index.html`, `app/` i `assets/` z repozytorium do `httpdocs/puzzle/`. Serwer ProFTPD zrywa część przesyłań przy TLS 1.3 (kod 426), więc `curl` dostaje `--tls-max 1.2`. Po wgraniu trzeba wyczyścić pamięć podręczną w Cloudflare (Caching → Purge Everything), bo inaczej telefony mogą dostać stare pliki.

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
| `app/js/ar/` | Tryby „W przestrzeni” i „Z kamerą”: sesja WebXR albo obraz z kamery, plansza w 3D, obraz w ramie, skok zwierzęcia z ramy |
| `app/vendor/` | Three.js 0.170.0 i jego licencja; ładuje się tylko w trybach „W przestrzeni” i „Z kamerą” |
| `app/media/czcionki/` | Czcionki Fraunces i Inter (WOFF2, zmienna grubość, znaki łacińskie i polskie) z licencjami SIL OFL 1.1 |
| `assets/filmy/` | Filmy 1920×1080 do gry na ekranie |
| `assets/filmy-720p/` | Lżejsze filmy 1280×720 do trybu „W przestrzeni” |
| `assets/filmy-skok/` | Filmy, w których zwierzę wyskakuje z ramy w trybie „W przestrzeni” |
| `narzedzia/serwer.py` | Serwer do podglądu z obsługą nagłówka Range |
| `test/` | Testy logiki gry, kodów QR i trybu „W przestrzeni” |

Dokumentacja, narzędzia do filmów i materiały źródłowe, na które wskazują niektóre komentarze w kodzie, są w prywatnym repozytorium `lesne-puzzle-WebXR`. To repozytorium jest publiczne, więc zawiera tylko to, co jest potrzebne do działania gry i jej testów.

## Przed oficjalną publikacją

- Sprawdzić z prawnikiem zdanie o kamerze w „Informacjach prawnych” oraz to, czy wzmianka o AI spełnia art. 50 AI Act.
- W „Informacjach prawnych” jako właściciel praw figuruje „Leśne puzzle”. Wpisać tam wydawcę: imię i nazwisko albo nazwę firmy.
