// Treści o zwierzętach: obrazki, filmy, fakty i zasięg na mapie Polski.
// Źródła faktów są w assets/ZRODLA.md, w częściach „Fakty o …”.
//
// image: pierwsza klatka filmu, a nie oryginalne zdjęcie. Kadr filmu jest lekko przesunięty i ostrzejszy,
//        a ułożony obrazek ma przejść w ruch bez żadnego skoku.
// focus: gdzie na obrazku jest zwierzę (object-position), żeby przycięte miniatury go nie ucinały.
// shift: o ile przesunąć ostatnią klatkę w prawo pod ekranem z informacją (ułamek szerokości),
//        żeby zwierzę nie chowało się za tekstem po lewej stronie.
// range: kropki i plamy na mapie we współrzędnych [długość, szerokość geograficzna].

const PHOTO = "Zdjęcie: Pexels.";
const MAP = "Mapa: Natural Earth.";

export const ANIMALS = {
  lis: {
    name: "Lis",
    species: "Lis rudy",
    latin: "Vulpes vulpes",
    focus: "70% 35%",
    shift: 0.03,
    lead: "Rudy spryciarz z puszystą kitą. Żyje w całej Polsce: w lasach, na polach, a nawet w miastach.",
    facts: [
      { icon: "ucho", title: "Słuch jak radar", text: "Usłyszy pisk myszy nawet ze stu metrów, choćby była ukryta pod grubą warstwą śniegu." },
      { icon: "skok", title: "Skok na mysz", text: "Podskakuje wysoko i spada na zdobycz przednimi łapami. Naukowcy zauważyli, że częściej trafia, gdy skacze na północny wschód." },
      { icon: "ogon", title: "Kita do wszystkiego", text: "Ogon ma prawie połowę długości ciała. Pomaga lisowi skręcać w biegu, a zimą służy mu za kołdrę." },
      { icon: "nora", title: "Lokator borsuka", text: "Często mieszka w norze borsuka, a nierzadko dzieli ją zgodnie z gospodarzem." },
    ],
    range: {
      country: true,
      legend: [{ swatch: "country", text: "Żyje w całej Polsce: w lasach, na polach i w miastach" }],
    },
    credits: `${PHOTO} Głos lisa: <a href="https://pixabay.com/sound-effects/nature-fox-calling-243999/" target="_blank" rel="noopener">nagranie l3hrja</a> z Pixabay. ${MAP}`,
  },

  jelen: {
    name: "Jeleń",
    species: "Jeleń szlachetny",
    latin: "Cervus elaphus",
    focus: "62% 50%",
    shift: 0.06,
    lead: "Dostojny mieszkaniec polskich lasów. Jesienią w lesie słychać jego głośne, basowe ryki.",
    facts: [
      { icon: "poroze", title: "Poroże co roku nowe", text: "Pod koniec każdej zimy byki zrzucają poroże, a potem wyrasta im nowe." },
      { icon: "dzwiek", title: "Rykowisko", text: "Od drugiej połowy września do połowy października byki ryczą, żeby pokazać swoją siłę i zwabić łanie." },
      { icon: "stado", title: "Wielkie chmary", text: "Łanie z młodymi żyją w stadach zwanych chmarami, a byki trzymają się osobno. W Dolinie Baryczy chmara liczy czasem ponad sto jeleni." },
      { icon: "waga", title: "Siłacz", text: "Dorosły byk waży zwykle do 160 kg, a jelenie z Karpat nawet ponad 200 kg." },
    ],
    range: {
      country: true,
      legend: [{ swatch: "country", text: "Żyje w lasach w całej Polsce" }],
    },
    credits: `${PHOTO} Parsknięcie jelenia: <a href="https://pixabay.com/sound-effects/deer-snort-472365/" target="_blank" rel="noopener">nagranie DRAGON-STUDIO</a> z Pixabay. ${MAP}`,
  },

  sarna: {
    name: "Sarna",
    species: "Sarna europejska",
    latin: "Capreolus capreolus",
    focus: "44% 50%",
    shift: 0.12,
    lead: "Najmniejsza z naszych jeleniowatych. Często pasie się na skraju lasu i na łąkach.",
    facts: [
      { icon: "dzwiek", title: "Szczeka jak pies", text: "Gdy czuje się zagrożona albo niepewna, wydaje głośne, szczekliwe dźwięki." },
      { icon: "lustro", title: "Lustro", text: "Uciekając, pokazuje białą plamę wokół ogona, zwaną lustrem. To ostrzeżenie dla innych saren." },
      { icon: "kalendarz", title: "Ciąża z przerwą", text: "Gody są latem, ale zarodek przez około 150 dni nie rośnie. Dlatego koźlęta rodzą się dopiero w maju lub czerwcu." },
      { icon: "dlon", title: "Nie dotykaj koźlęcia", text: "Młode nie mają zapachu i leżą ukryte w trawie, a mama przychodzi tylko je nakarmić. Znalezionego koźlęcia nie wolno zabierać." },
    ],
    range: {
      country: true,
      legend: [{ swatch: "country", text: "Żyje w całej Polsce: w lasach i na polach" }],
    },
    credits: `${PHOTO} ${MAP}`,
  },

  rys: {
    name: "Ryś",
    species: "Ryś euroazjatycki",
    latin: "Lynx lynx",
    focus: "58% 55%",
    shift: 0.05,
    lead: "Największy dziki kot Europy. Jest tak skryty, że w lesie łatwiej znaleźć jego tropy niż jego samego.",
    facts: [
      { icon: "uszy", title: "Pędzelki na uszach", text: "Czarne pędzelki, bokobrody i krótki ogon z czarnym końcem. Po tym go poznasz." },
      { icon: "lapa", title: "Łowca zmierzchu", text: "Podkrada się bezszelestnie i atakuje z bliska. Najczęściej poluje na sarny." },
      { icon: "teren", title: "Ogromny rewir", text: "Terytorium samca to średnio około 250 km², prawie połowa Warszawy." },
      { icon: "ochrona", title: "Rzadki i chroniony", text: "W Polsce żyje tylko kilkaset rysi. Od 1995 roku są pod ścisłą ochroną." },
    ],
    range: {
      glow: [
        [19.4, 49.6], [20.2, 49.5], [20.9, 49.45], [21.6, 49.45], [22.3, 49.3], [22.65, 49.15], // Karpaty
        [23.85, 52.7], [23.45, 53.2], [23.15, 53.85], [22.55, 54.32], [22.1, 54.1], // puszcze na północnym wschodzie
      ],
      sites: [
        [20.55, 52.33], // Puszcza Kampinoska
        [21.55, 53.6], // Puszcza Piska
        [16.1, 53.35], // Pomorze Zachodnie
      ],
      labels: [
        { text: "Karpaty", at: [21.0, 50.1], anchor: "middle" },
        { text: "Podlasie i Mazury", at: [22.0, 52.75], anchor: "end" },
      ],
      legend: [
        { swatch: "glow", text: "Główne ostoje: Karpaty i puszcze na północnym wschodzie" },
        { swatch: "site", text: "Tu rysie wracają do natury: m.in. Puszcza Kampinoska, Puszcza Piska i Pomorze Zachodnie" },
      ],
    },
    credits: `${PHOTO} Głos rysia: <a href="https://freesound.org/people/YleArkisto/sounds/243496/" target="_blank" rel="noopener">„Ilves murisee ja mouruaa / One or two lynxes growling”</a>, YleArkisto, Freesound, licencja <a href="https://creativecommons.org/licenses/by/4.0/deed.pl" target="_blank" rel="noopener">CC BY 4.0</a>; wycięty fragment zmiksowany z obrazem. ${MAP}`,
  },

  sowa: {
    name: "Puszczyk",
    species: "Puszczyk zwyczajny",
    latin: "Strix aluco",
    focus: "45% 45%",
    shift: 0.12,
    lead: "Najliczniejsza sowa w Polsce: gniazduje u nas nawet 75 tysięcy par. Dzień przesypia, a nocą wyrusza na łowy.",
    facts: [
      { icon: "pioro", title: "Bezszelestny lot", text: "Specjalna budowa piór sprawia, że leci prawie bezgłośnie." },
      { icon: "ucho", title: "Słuch w ciemności", text: "Otwory uszne ma ułożone niesymetrycznie, więc dokładnie namierza każdy szelest." },
      { icon: "obrot", title: "Głowa dookoła", text: "Potrafi obrócić głowę aż o 270 stopni w każdą stronę, i to bez odcinania dopływu krwi do mózgu." },
      { icon: "ochrona", title: "Pod ścisłą ochroną", text: "Gniazduje najczęściej w dziuplach starych drzew. W Polsce jest pod ścisłą ochroną." },
    ],
    range: {
      country: true,
      legend: [{ swatch: "country", text: "Żyje w całej Polsce: w lasach i parkach ze starymi drzewami" }],
    },
    credits: `${PHOTO} ${MAP}`,
  },

  wiewiorka: {
    name: "Wiewiórka",
    species: "Wiewiórka pospolita",
    latin: "Sciurus vulgaris",
    focus: "48% 50%",
    shift: 0.12,
    lead: "Zwinna akrobatka koron drzew. Spotkasz ją w lasach, parkach i ogrodach w całej Polsce.",
    facts: [
      { icon: "orzech", title: "Leśny ogrodnik", text: "Jesienią chowa jedzenie w wielu kryjówkach. Części z nich nie odnajduje, a z zapomnianych nasion mogą wyrosnąć drzewa." },
      { icon: "ogon", title: "Ogon jak ster", text: "Puszysty ogon pomaga jej utrzymać równowagę na gałęziach i przy skokach z drzewa na drzewo." },
      { icon: "kolor", title: "Ruda albo prawie czarna", text: "Futro bywa rude albo ciemnobrązowe. Ciemniejsze wiewiórki częściej spotkasz w górach." },
      { icon: "ochrona", title: "Zimą nie śpi", text: "Nie zapada w sen zimowy, tylko rzadziej wychodzi z gniazda. W Polsce jest pod częściową ochroną." },
    ],
    range: {
      country: true,
      legend: [{ swatch: "country", text: "Żyje w całej Polsce: w lasach, parkach i ogrodach" }],
    },
    credits: `${PHOTO} ${MAP}`,
  },

  zubr: {
    name: "Żubr",
    species: "Żubr europejski",
    latin: "Bison bonasus",
    focus: "45% 55%",
    shift: 0.08,
    lead: "Największy dziki ssak Europy. Duży byk waży ponad 900 kilogramów.",
    facts: [
      { icon: "ochrona", title: "Uratowany w ostatniej chwili", text: "W 1919 roku zginął ostatni wolny żubr w Puszczy Białowieskiej. Gatunek odtworzono z żubrów z ogrodów zoologicznych." },
      { icon: "rodzina", title: "Dwunastu przodków", text: "Wszystkie żyjące dziś żubry pochodzą od zaledwie 12 zwierząt." },
      { icon: "las", title: "Powrót do puszczy", text: "W 1952 roku pierwsze żubry wróciły na wolność w Puszczy Białowieskiej." },
      { icon: "stado", title: "Już ponad 3 tysiące", text: "Pod koniec 2024 roku w Polsce żyło 3060 żubrów, większość na wolności. Wszystkie są pod ścisłą ochroną." },
    ],
    range: {
      glow: [
        [23.8, 52.75], // Puszcza Białowieska
        [22.4, 49.2], [22.6, 49.35], // Bieszczady
        [23.35, 53.25], // Puszcza Knyszyńska
        [16.2, 53.35], [15.8, 53.6], // Pomorze Zachodnie
        [22.05, 54.12], // Puszcza Borecka
      ],
      labels: [
        { text: "Puszcza Białowieska", at: [23.3, 52.45], anchor: "end" },
        { text: "Bieszczady", at: [22.2, 49.85], anchor: "middle" },
      ],
      legend: [
        { swatch: "glow", text: "Największe wolne stada: Puszcza Białowieska, Bieszczady, Puszcza Knyszyńska, Pomorze Zachodnie i Puszcza Borecka" },
      ],
    },
    credits: `${PHOTO} ${MAP}`,
  },

  zimorodek: {
    name: "Zimorodek",
    species: "Zimorodek zwyczajny",
    latin: "Alcedo atthis",
    focus: "45% 50%",
    shift: 0.12,
    lead: "Latający klejnot znad rzek. Waży tylko około 40 gramów, a ryby łowi, nurkując głową w dół.",
    facts: [
      { icon: "swiatlo", title: "Kolor ze światła", text: "Błękit jego piór to nie barwnik. To światło załamuje się i rozszczepia w budowie pióra." },
      { icon: "stoper", title: "Dwie sekundy", text: "Czatuje na gałęzi nad wodą. Skok, nurkowanie i powrót z rybą trwają najwyżej dwie sekundy." },
      { icon: "pociag", title: "Wzór dla pociągu", text: "Japoński inżynier wzorował się na jego dziobie, projektując przód superszybkiego pociągu Shinkansen. Pociąg stał się cichszy i zużywa mniej prądu." },
      { icon: "nora", title: "Metrowa nora", text: "Gniazdo kopie w stromym brzegu rzeki: metrowy korytarz para ryje co najmniej dwa tygodnie. Jest pod ścisłą ochroną." },
    ],
    range: {
      rivers: true,
      legend: [{ swatch: "river", text: "Żyje nad czystymi rzekami, potokami i stawami w całej Polsce" }],
    },
    credits: `${PHOTO} Mapa: Natural Earth, rzeki schematycznie.`,
  },

  dzik: {
    name: "Dzik",
    species: "Dzik euroazjatycki",
    latin: "Sus scrofa",
    focus: "64% 62%",
    shift: 0.06,
    lead: "Silny, sprytny i wszystkożerny. Żyje w całej Polsce, a coraz częściej zagląda też do miast.",
    facts: [
      { icon: "nos", title: "Nos jak wykrywacz", text: "Ma świetny węch. Ryjem przekopuje ziemię, szukając korzeni, żołędzi, dżdżownic i owadów." },
      { icon: "stado", title: "Rodzinna wataha", text: "Dziki żyją w rodzinnych grupach zwanych watahami i przez lata trzymają się tej samej okolicy." },
      { icon: "kropla", title: "Błotne kąpiele", text: "Uwielbia taplać się w błocie, które chłodzi go w upały. Takie miejsce nazywa się babrzyskiem." },
      { icon: "uwaga", title: "Pasiaste maluchy", text: "Warchlaki rodzą się w jasne paski. Locha mocno ich broni, więc gdy ją spotkasz, spokojnie się oddal." },
    ],
    range: {
      country: true,
      legend: [{ swatch: "country", text: "Żyje w całej Polsce: w lasach, na polach, coraz częściej także w miastach" }],
    },
    credits: `${PHOTO} ${MAP}`,
  },
};

// Kolejność w menu i przy „Następne zwierzę”.
export const ORDER = ["lis", "jelen", "sarna", "rys", "sowa", "wiewiorka", "zubr", "zimorodek", "dzik"];

// Sekunda filmu ze skokiem, w której telefon wibruje: zwierzę przekracza wtedy ramę.
const VIBRATE_AT = { lis: 1.3, jelen: 2.1, sarna: 1.7, rys: 2, sowa: 1.2, wiewiorka: 1.7, zubr: 1.8, zimorodek: 3.3, dzik: 1.7 };

for (const id of ORDER) {
  Object.assign(ANIMALS[id], {
    id,
    image: `media/${id}-klatka.jpg`,
    thumb: `media/${id}-mini.jpg`,
    video: `../assets/filmy/${id}.mp4`,
    arVideo: `../assets/filmy-720p/${id}.mp4`,
    // Skok z ramy w trybie „W przestrzeni”, po zwykłym filmie.
    jump: { video: `../assets/filmy-skok/${id}.mp4`, vibrateAt: VIBRATE_AT[id] },
  });
}

export function nextAnimal(id) {
  return ORDER[(ORDER.indexOf(id) + 1) % ORDER.length];
}
