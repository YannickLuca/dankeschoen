// Wortliste für das Passwort: gängige, freundliche deutsche Wörter ohne Umlaute und ß,
// 3–8 Buchstaben, damit sie sich auch am Handy gut tippen lassen.
// Die Liste darf öffentlich sein – die Sicherheit kommt allein aus der zufälligen Auswahl.

const ROH = `
adler affe alpaka amsel antilope auster biber bison delfin dachs dohle drossel elch elster ente esel
eule falke fasan fink fisch forelle frosch fuchs gans gazelle gecko giraffe gorilla hamster hase hecht
hering hirsch huhn hummel hummer hund igel iltis jaguar kamel katze kauz koala kranich krabbe kuh lachs
lama lerche leopard libelle lamm luchs maus meise molch mungo nashorn ochse otter panda panther papagei
pelikan pfau pferd pinguin pony puma rabe reh reiher rind robbe schaf schwan seehund specht spatz storch
tapir taube tiger uhu wal wachtel wiesel wolf zebra ziege zander kolibri karpfen krake flamingo falter
marder biene ameise raupe grille zikade hermelin wisent gnu emu lemur okapi orca hai rochen qualle
garnele sardine makrele dorsch scholle barsch wels aal pirol gimpel zeisig star kuckuck eisvogel kakadu
ara tukan pute hahn henne ferkel fohlen kalb welpe kater hengst stute elefant nilpferd echse leguan unke

ahorn akazie aloe anis aster azalee bambus birke buche efeu eiche enzian erle esche farn feige flieder
gerste ginster hafer hasel heide holunder hopfen iris jasmin kaktus kamille kiefer kirsche klee kresse
krokus lavendel lilie linde lorbeer lotus lupine malve minze mohn moos myrte nelke olive palme pappel
pinie quitte rose salbei schilf tanne thymian tulpe ulme weide weizen zeder zitrone mandel dattel dill
fenchel kerbel lauch mais melisse mimose roggen dahlie fuchsie geranie kamelie primel veilchen wicke
zinnie orchidee magnolie narzisse oleander rosmarin akelei arnika baldrian estragon majoran oregano
mistel eibe fichte robinie platane kastanie walnuss mispel schlehe rotdorn

brot butter honig kaffee kakao kuchen keks milch nudel pasta pizza risotto salat suppe torte waffel
zucker zimt vanille sahne quark joghurt tee saft limonade wasser wein sekt gelato espresso biskuit
brezel gipfeli zopf raclette fondue polenta lasagne ravioli tiramisu oliven kapern pesto gnocchi
focaccia grissini salami schinken reis linse bohne erbse karotte tomate gurke paprika zwiebel pilz
spargel spinat kohl mango banane ananas melone kiwi beere erdbeere himbeere traube pflaume aprikose
orange limette kokos nuss praline nougat bonbon karamell muffin krapfen strudel kompott sirup senf
essig pfeffer salz curry ingwer safran chili sorbet parfait crepe omelett toast fladen rahm cervelat
marzipan konfekt makrone zwieback cantucci amaretti biscotti ciabatta penne rucola burrata ricotta
parmesan pecorino prosecco chianti barolo grappa latte mokka most punsch bowle schnaps avocado zucchini
rettich sellerie mangold kohlrabi rande kefe peperoni birne apfel rosine papaya maracuja

anker besen becher bett bild brief buch decke dose eimer fenster gabel garten glas glocke gitarre
hammer hut kamm kanne kerze kissen kiste koffer korb krug lampe leiter messer mantel nadel ofen pinsel
puppe rahmen regal ring schal schere schirm schuh schrank sessel sofa spiegel stuhl tasse tasche
teller tisch topf uhr vase wanne wecker wiege zange faden knopf kette perle brosche krone schleife
feder tinte papier karte mappe heft kreide globus kompass laterne fackel teppich vorhang kachel ziegel
balken treppe kamin hocker bank kommode truhe schale pfanne kessel sieb waage riegel klinke haken
nagel schraube bohrer feile hobel spaten schaufel harke rechen sense sichel beil leine seil netz
kordel schnur band borte spitze stoff seide samt leinen wolle filz leder kork bast rattan lampion
girlande konfetti ballon geschenk paket stempel siegel wappen fahne flagge banner wimpel kalender
notiz tagebuch album foto kamera linse poster atlas roman lexikon zeitung magazin brille fernglas
lupe teleskop flasche korken kelch pokal tablett kelle quirl handtuch seife schwamm spange schmuck
armreif ohrring medaille orden taler franken rappen dukat

abend ast bach berg blitz boden brise bucht dorf erde feld fels fluss flut frost gipfel hagel hain
hang himmel insel kap klippe lagune licht luft meer mond moor morgen nebel oase ozean pfad quelle
regen riff sand see schnee sonne stern strand sturm tal tau ufer vulkan wald welle wiese wind wolke
zweig lawine firn alpen alm alp weiher teich tropfen funke glut flamme nacht dunst schatten horizont
mittag sommer herbst winter blatt knospe wurzel samen ernte rinde harz kiesel muschel koralle
kristall quarz granit marmor silber gold kupfer bronze zinn achat jade opal rubin saphir topas smaragd
diamant perlmutt lehm schiefer basalt lava magma geysir brunnen kanal delta fjord atoll steppe
savanne tundra taiga canyon krater grotte felsen grat pass joch sattel senke mulde ebene acker
weinberg hecke zaun weg steg furt tropen monsun passat bise zephyr orkan taifun gewitter donner
schauer graupel reif raureif abendrot komet meteor planet galaxie orbit saturn merkur venus mars
jupiter neptun pluto sirius wega kosmos

akkord arie ballade ballett bass bratsche cello chor dur duett fagott geige gong harfe horn jazz
kanon klavier konzert lied melodie moll motiv noten oboe oper orgel pauke polka posaune rhythmus
samba sonate takt tango trommel trompete tuba walzer zither banjo mambo rumba salsa swing blues
aquarell atelier fresko farbe leinwand mosaik pastell palette skizze statue poesie gedicht reim vers
fabel sage legende theater kulisse applaus zirkus clown gaukler akrobat jongleur magier maske tanz
reigen menuett bolero flamenco quartett trio solo finale sinfonie kantate motette refrain strophe
tonart dirigent sopran tenor bariton saxofon ukulele laute leier lyra cembalo spinett xylofon
triangel tamburin kunst galerie museum skulptur relief grafik druck tusche kohle ocker umbra indigo
karmin purpur kobalt sepia magenta beige creme

bluse hemd hose jacke kleid krawatte rock sandale schleier socke stiefel weste kappe pulli sakko
smoking anzug frack tracht kittel poncho tunika toga kimono kaftan cape umhang mieder korsett
schleppe zylinder barett turban haube kragen fliege pyjama bikini overall anorak parka blazer cardigan

arzt bauer dichter fischer hirte koch lehrer maler matrose pilot schmied tischler weber winzer bote
ritter prinz kaiser graf zauberer metzger imker senn senner sennerin hirtin kellner wirt konditor
florist juwelier sattler schuster zimmerer maurer gipser glaser polier lotse forscher erfinder student
meister geselle musiker poet autor redner richter anwalt notar kanzler konsul herold knappe page pilger
wanderer nomade kurier

allee arena bahnhof burg dom fabrik gasse hafen halle hotel kapelle kirche kloster laden markt palast
park platz rathaus schloss schule stadt strasse tempel turm villa kiosk scheune stall terrasse balkon
veranda garage keller pavillon pergola laube piazza loggia arkade portal tor pforte bogen kuppel
fassade giebel erker zinne bastion festung saal foyer kantine mensa cafe bistro osteria pizzeria bar
taverne gasthaus herberge pension chalet berghaus speicher silo lager hangar depot werft mole pier kai
schleuse viadukt tunnel passage quai basar

basel bern genf zug chur luzern lugano locarno ascona thun aarau baden biel olten davos arosa sion
montreux lausanne zermatt gstaad wengen flims laax brissago morcote gandria sils soglio tessin wallis
jura uri glarus thurgau aargau freiburg brienz spiez verbier saas fiesch brig visp leuk martigny vevey
nyon morges yverdon wien rom paris london madrid lissabon athen prag oslo dublin berlin hamburg mailand
turin venedig florenz neapel genua verona como stresa varese italien spanien schweiz kanada mexiko peru
chile japan china indien kenia island irland norwegen schweden finnland polen ungarn portugal marokko
kuba bolivien ecuador panama uruguay korea vietnam nepal bhutan laos malta zypern kreta sizilien
korsika elba capri ischia rhodos ibiza mallorca madeira azoren kanaren tirol bayern sachsen toskana
umbrien ligurien piemont venetien provence bretagne elsass burgund

ball dame domino drache golf joker kegel kreisel lotto murmel puzzle quiz rodel schach segel ski
tennis turnier yoga zirkel rakete bumerang jojo kajak kanu paddel regatta boccia boule minigolf
pingpong handball hockey curling biathlon slalom abfahrt langlauf wandern klettern bergtour velotour
skitour tauchen surfen segeln rudern reiten tanzen jassen jass mikado halma tangram bingo roulette
tombola los rekord sieger trainer stadion

auto bahn boot bus fahrrad flugzeug gondel kutsche roller schiff taxi traktor tram velo wagen floss
segler zeppelin jacht dampfer fregatte galeere kogge bob seilbahn zahnrad waggon draisine tandem
dreirad mofa vespa cabrio karren gleiter

advent april august datum dezember fest feier ferien freitag januar juli juni mai montag oktober
ostern samstag sonntag stunde tag woche jahr minute sekunde hochzeit party picknick februar november
mittwoch dienstag neujahr fasnacht chilbi kirmes gala soiree empfang apero brunch bankett festmahl
rede ringe jawort gast festsaal

bunt edel fein flink froh heiter hell klar klug lieb leise lustig mild munter mutig neu nett prima
rasch ruhig sanft sauber schlau sonnig stark still treu warm weise wild zart frisch golden keck locker
sicher tapfer wach wacker witzig zahm rund flach hoch tief weit nah fern leicht glatt weich kalt lau
rasant flott klein kurz lang eifrig ehrlich emsig fleissig gesund herzig hurtig kostbar lebhaft
lauschig lieblich luftig magisch mollig niedlich nobel pfiffig reizend rosig saftig samtig schick
schnell selig sorglos spontan toll traut verliebt elegant festlich frech fesch gediegen heimelig innig
knackig perfekt stilvoll zierlich

anmut eifer ehre freude frieden geduld glanz gnade gunst harmonie hoffnung humor idee jubel laune liebe
lob lust magie mut ruhe segen sinn spass stolz treue trost wunder wonne zauber zeit zukunft traum
wunsch charme demut fleiss ansporn aufbruch ausblick balance beifall einfall fantasie fortuna freiheit
gedanke geist gewinn heimat herz hingabe klang kraft lachen leben mythos neugier reise schwung spiel
tugend vision weisheit wille witz chance echo gruss juwel magnet nektar phoenix pyramide radar roboter
sirene spirale wirbel zentrum atom

ampel angel arche atem bad bart bau baum becken beet besuch beutel blech blei blick block blume boje
bord brett bude busch dach dampf daumen deich docht draht dreieck duft ecke elfe engel erbe falte
fass fee fell feuer figur film flocke flosse flug flur form fracht frage freund frucht futter garn
geste gilde gitter gleis gnom gras griff grund gruppe gurt halm hand haus hebel held helm herd herde
heu hirse hof huf kabel kahn kante kern kino knoten kokon korn kranz kreis kugel kurve kuss lack land
lasso laub lauf leuchte linie liste locke lot mahl malz marke mast matte mauer mehl meile messe metall
mixer mode moment motor muster nabe name nest nische note obst ort paar pause pegel pfahl pfeife pfeil
pflug pfote piste plan post preis pult punkt rad rand rasen rast rat raum rebe reihe rest riese rolle
ross ruder saat saite salbe satz schatz schaum schein schild sitz sohle sporn spur stab stamm stange
stein stiel stift stimme stock strauch strom tafel teig tuch urlaub vogel wabe wall wand watte welt
werk winkel wippe wort zahl zelt ziel zimmer
`;

export const WOERTER = [...new Set(ROH.split(/\s+/).filter((w) => /^[a-z]{3,8}$/.test(w)))];
