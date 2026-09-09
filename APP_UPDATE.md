# Ažuriranje toka javnih nabavki

## SENA-inspirisani tok odlučivanja — 8. septembar 2026.

- Dodan je ekran **Moja tržišta**. Svaki korisnik može sačuvati svoj CPV skup, ključne riječi, kupce, minimalnu i maksimalnu vrijednost te pravilo „samo otvoreni tenderi“. Dnevni red odmah prikazuje podudarne EJN tendere i razlog podudaranja.
- Novo preuzeto obavještenje provjerava i sačuvana tržišta. Za svako relevantno tržište nastaje zasebna obavijest, bez dupliranja pri narednoj sinhronizaciji.
- Novi tender šalje obavještenje samo kada sadrži konkretne pojmove iz profila firme, CPV kodova, kapaciteta ili ličnih oznaka korisnika. Obavijest prikazuje pojmove koji su se podudarili.
- Podsjetnici za rok rade na 7, 3 i 1 dan prije predaje, samo za tendere koje korisnik prati ili vodi. Isti podsjetnik se ne duplicira.
- Kartica **Prethodni dobitnici** sada sadrži dosje kupca i konkurencije: obuhvat službenih EJN zapisa, vodećeg dobitnika, historijski raspon i medijan ugovorenih vrijednosti te oznaku pouzdanosti. Broj ponuda i direktni sporazumi ostaju jasno označeni kao nedostupni dok se ne potvrde iz izvora.
- Prebacivanje tendera u Kanbanu u **Pobjeda** ili **Gubitak** evidentira datum ishoda; zapis može čuvati i naš iznos ponude i internu bilješku putem API-ja.

Provjera: 20/20 testova, backend i frontend TypeScript provjera i oba produkcijska builda prolaze. Lokalni API je ponovo pokrenut i autentificirani poziv `GET /api/markets` vraća ispravan prazan početni skup; ekran **Moja tržišta** je provjeren u pregledniku. Za tender VODOVOD A.D. BANJA LUKA dosje kupca koristi 1.250 preuzetih EJN zapisa i vraća visoku pouzdanost prema pokrivenosti imena dobitnika i vrijednosti.

## Ispravka redoslijeda „Najnovije“ — 8. septembar 2026.

- Glavni redoslijed liste sada koristi datum objave tendera. Ranije je koristio datum uvoza, pa su tenderi iz 2023. koji su naknadno uvezeni radi historije završavali na vrhu.
- Opcija je preimenovana u **Najnovije objavljeno**. Tehnički redoslijed po uvozu ostaje zasebno kao **Zadnje uvezeno u sistem**.
- Redoslijed je stabilan i kod jednakih datuma. API provjera sada vraća objave od 7. i 4. septembra 2026. na vrhu liste osiguranja.

## Provjerljivo čitanje i profil firme — 8. septembar 2026.

- PDF dokumenti se čuvaju po stranicama, sa metodom čitanja i upozorenjima. Skenirane stranice koriste lokalni OCR za bosanski, srpski latinicu i ćirilicu; dokumenti se zbog OCR-a ne šalju van aplikacije.
- Izdvojeni navodi i stavke radne kontrolne liste prikazuju broj stranice. Na tenderu `ab2d6de3-ae0f-4465-801f-1c11bed6623c` svih pet postojećih stavki povezano je sa stranicom 3 ili 4.
- Dokument dobija SHA-256 otisak, logički ključ i verziju. Promijenjena datoteka se čuva kao nova verzija, prethodna ostaje dostupna i promjena se evidentira; ista datoteka se ne duplicira.
- Kartica **Dokumenti** prikazuje metodu čitanja, broj stranica, OCR upozorenja i verziju te omogućava ponovno čitanje.
- Dodan je ekran **Profil firme** sa kapacitetima, CPV kodovima, ključnim riječima i bibliotekom licenci, potvrda i referenci. Samo odobren i važeći dokaz ulazi u podudaranje.
- Kartica **Podudarnost firme** povezuje uslove tendera sa mogućim dokazima i prikazuje zajedničke pojmove. Rezultat ostaje prijedlog za provjeru tima.

Provjera: backend i frontend TypeScript provjera i produkcijski build prolaze; 20/20 testova prolazi. Posebnim image-only PDF primjerom potvrđeno je lokalno OCR čitanje. UI je provjeren na karticama Dokumenti, Odluka i zadaci, Podudarnost firme i Profil firme. API je aktivan na portu 5000.

## Spremnost ponude i historija dobitnika — 8. septembar 2026.

- Kontrolna lista sada odvaja **izvor zahtjeva** od **dokaznog priloga**. Za dokaz se bira stvarno učitana datoteka tendera i, kada je primjenjivo, datum do kojeg dokument važi.
- Pregled **Spremnost za predaju** prijavljuje odluku koja nije „Idemo“, nedodijeljenu odgovornu osobu, praznu ili nepotpunu kontrolnu listu, izmijenjen izvor, nepovezan dokaz, dokaz koji ističe prije predaje i prošao rok tendera.
- Završnu internu provjeru može evidentirati prijavljeni član tima tek kada nema evidentiranih blokada i kada potvrdi da je pregledao punu TD, priloge, izmjene i pojašnjenja. Provjera čuva tačnu verziju podataka; izmjena dokumenta, zadatka, odluke ili roka automatski je označava kao raniju provjeru koju treba ponoviti. Evidentiranje ne šalje ponudu na EJN.
- Nova kartica **Prethodni dobitnici** povlači službene zbirke EJN `Awards` i `LotContracts`. Imena dobitnika razrješavaju se preko lota, označene dobitne grupe ponuđača te registrovanih i neregistrovanih članova grupe.
- Historija se vezuje službenim `ContractingAuthorityId`. Rezultat aktuelnog postupka vezuje se `ProcedureId`; prethodne slične nabavke moraju biti dodijeljene prije objave aktuelnog tendera i imati objašnjenje podudarnosti naslova. Ostali ugovori istog naručioca prikazuju se odvojeno.
- Svaki prikazani rezultat ima poveznicu na EJN zapis dodjele/ugovora i EJN vezu prema grupi ponuđača. Ako ime nije razriješeno, prikazuje se kao nepotvrđeno; ne izmišlja se dobitnik.
- Preuzimanje historije čuva ranije rezultate, radi inkrementalno u ograničenim stranicama, daje prednost tematski relevantnim dodjelama i nastavlja starije ugovore narednim pokretanjem. Tri naručioca obrađuju se po zakazanom ciklusu svakih 10 minuta dok server radi, a korisnik može ručno nastaviti historiju određenog tendera.
- Na provjerenom tenderu VODOVOD A.D. BANJA LUKA preuzeto je 1.250 zapisa dodjela/ugovora i pronađeno osam prethodnih sličnih dodjela kolektivnog osiguranja sa stvarnim dobitnicima i iznosima iz EJN-a.

Nove strukture baze: `tender_final_reviews`, `ejn_contract_history`, `ejn_history_sync` te dodatna polja dokaza u `tender_requirements`. Migracija je aditivna i idempotentna. Rezervna kopija prije prve migracije historije: `.local/db-backup-history-20260908`.

Novi autentificirani API pozivi: `GET /api/workspace/:id/readiness`, `POST /api/workspace/:id/readiness/review`, `GET /api/workspace/:id/history`, `POST /api/workspace/:id/history/sync`.

## Dosje ponude i radni pregled — 8. septembar 2026.

- Na početnoj stranici **Moj radni dan** prikazuje zadatke prijavljenog korisnika, prošle interne rokove, njegove odluke i najnovijih 30 izmjena na praćenim ili dodijeljenim tenderima tokom sedam dana.
- Na tenderu otvorite **Odluka i zadaci**. Odluka može biti **Čeka odluku**, **Idemo** ili **Ne idemo**, uz razlog, odgovornu osobu i interni rok. Za odluku o učešću ili odustajanju razlog je obavezan.
- **Izdvoji iz dokumenata** dodaje do 100 prepoznatih navoda za ručnu provjeru. Ponovni unos istog izvornog navoda ne pravi duplikate. Mogu se dodati i interni zadaci bez citata.
- Svaka stavka ima odgovornu osobu, interni rok, status i bilješku o dokazu. Status **Provjereno** zahtijeva osobu i dokaz provjere; ovo je potvrda člana tima, a ne automatska potvrda da je ponuda potpuna.
- Citati se provjeravaju prema tekstu dokumenta tog tendera. Ako citat više nije prisutan, stavka se označava za ponovnu provjeru i ne računa u provjerene stavke.
- Odluke i izmjene stavki ostaju u historiji sa autorom i vremenom. Istovremeno spremanje zastarjele verzije vraća konflikt umjesto prepisivanja novijih podataka. Korisnik može učitati posljednje podatke pa ponoviti unos.
- Zadaci tendera sa odlukom **Ne idemo** ostaju u dosjeu, ali se ne prikazuju u aktivnom radnom danu.
- Dosje je zajednički svim prijavljenim članovima postojeće aplikacije; radni dan prikazuje lična zaduženja. Ovo nije razdvajanje više kompanija.

Nove tabele `tender_workspaces`, `tender_requirements` i `tender_work_events` kreiraju se dodatnom idempotentnom migracijom pri pokretanju u PGlite i PostgreSQL bazi. Potrebna su prava kreiranja tabela. Postojeći podaci se ne brišu. Lokalna rezervna kopija prije ove nadogradnje: `.local/db-backup-workspace-20260908`.

API (svi pozivi zahtijevaju postojeću prijavu): `GET /api/workspace/day`, `GET /api/workspace/:id`, `PUT /api/workspace/:id/decision`, `POST /api/workspace/:id/requirements/import`, `POST /api/workspace/:id/requirements`, `PUT /api/workspace/:id/requirements/:taskId`. Izmjene zahtijevaju trenutni `version` zapisa; početna odluka ima verziju 0. Neispravan unos vraća 400, konflikt 409.

Provjera: iz `artifacts/api-server` pokrenuti `node --import tsx --test tests/workspace-rules.test.ts tests/workspace-api.test.ts tests/tender-workflow.test.ts`. Integracijski test koristi zasebnu privremenu bazu i ne mijenja radne tendere.

Fokus ove verzije je osiguranje u BiH. Aplikacija radi lokalno na http://localhost:5173, API na portu 5000.

## Kako tim koristi aplikaciju

1. Na stranici **Tenderi** odabrati **Preuzmi nove tendere**. Prikazuju se stvarni brojevi novih i ažuriranih zapisa, greške i napomena ako postoje dodatne stranice za preuzimanje.
2. Otvoriti relevantan tender i karticu **Dokumenti**. Javno obavještenje, puna dokumentacija i poveznica na portal nisu ista stvar.
3. Preuzeti dokumentaciju s EJN-a ili dodati PDF, DOCX ili TXT datoteke (do 10 datoteka, do 20 MB po datoteci).
4. Odabrati **Obradi dokumentaciju**. Pregled prikazuje izvorne navode, naziv dokumenta, dostupnost teksta i ograničenja obrade. Podržano je izdvajanje navoda iz latinice i ćirilice.
5. Koristiti **Priprema ponude**, bilješke i postojeći Kanban za zaduženja i napredak. Generisani Word dokumenti su nacrti za dopunu i internu provjeru.

## Šta je popravljeno

- Uvoz koristi stvarni javni EJN OData izvor `AnnouncementProcedureNotices` i lotove. Jedna zajednička blokada sprečava istovremeno ručno i zakazano preuzimanje.
- Uvoz vraća stvarne rezultate i propagira greške. Paginacija ima ograničenje i nastavak narednom sinhronizacijom. Starije obavještenje ne prepisuje novije podatke istog postupka.
- Postupci se prepoznaju po `ProcedureId`, uz očuvanje već postojećih zapisa i korisničkog rada. Ranije postojeći duplikati nisu automatski spajani ili brisani.
- Nepoznat rok ostaje nepoznat. Kod više lotova prikazuje se najraniji rok, a kasniji otvoreni lot sprečava pogrešno zatvaranje cijelog postupka. Izmjene roka, statusa i vrijednosti se evidentiraju.
- Nabavke robe i radova koje koriste riječ „osiguranje” nisu police osiguranja; postojeći takvi EJN zapisi ostaju sačuvani u kategoriji Drugo.
- EJN portal ID se pronalazi tačnim brojem obavještenja; ne koristi se OData ID kao da je isti ID na portalu.
- Preuzimanje odbacuje HTML greške i neispravne datoteke, čuva datoteke lokalno i koristi aktuelni `PDFParse` interfejs. Ponovljeno preuzimanje istog dokumenta ažurira postojeći zapis.
- Ispravljen je endpoint dugmeta za dokumentaciju, praćenje posla, prikaz grešaka, ručni upload i preuzimanje lokalne datoteke.
- Bez AI ključa radi lokalno izdvajanje citata. Izmišljeni uslovi, ocjene, procenat pobjede i automatski rok za žalbu su uklonjeni iz izmijenjenog toka. Stare analize bez metapodataka o izvoru se ne prikazuju kao provjerena analiza.
- Word nacrti ne sadrže izmišljen JIB, potpisnika, odobrenje uprave ili unaprijed određen popust.

## Integracije i ograničenja

- Javni katalog: https://open.ejn.gov.ba . Portal: https://www.ejn.gov.ba/Announcement/Search . Javno obavještenje se može preuzeti bez prijave. Pristup punoj tenderskoj dokumentaciji zavisi od prava i statusa na EJN portalu; u probnom radu dobiven je javni PDF, dok puna dokumentacija nije bila dostupna.
- Ako je potreban pristup dobavljača, konfiguracija koristi `EJN_USER`/`EJN_PASS` (ili `EJN_USERNAME`/`EJN_PASSWORD`). U slučaju neuspjeha moguće je ručno preuzimanje preko vlastitog EJN računa i dodavanje datoteka u aplikaciju.
- `GROQ_API_KEY` omogućava AI pregled/razgovor; `ANTHROPIC_API_KEY` omogućava opcionalno AI izdvajanje strukturiranih navoda. Bez ključeva lokalna obrada radi. Pozivi AI servisa nisu provjereni s važećim ključem.
- Skenirani dokumenti bez izdvojenog teksta zahtijevaju OCR ili ručni pregled. Citati pomažu pregledu, ali ne potvrđuju potpunost uslova ni ispunjenost zahtjeva ponuđača.
- Reference.ba i UN/UNDP nisu povezani i više ne prijavljuju simulirani uspješan uvoz.
- Automatska provjera radi svakih 15 minuta samo dok API server radi. Ova verzija nije produkcijsko postavljanje servera koji radi 24/7.
- Sinhronizacija ne šalje Slack poruke. Konačnu odluku, cijenu, izjave i predaju potvrđuje tim.

## Pokretanje i provjere

Iz `artifacts/api-server`: `node --env-file=.env --import tsx src/index.ts`.

Iz `artifacts/tender-app`: `pnpm dev`.

Iz korijena: `pnpm run typecheck`, `pnpm --filter @workspace/tender-app run build`, `pnpm --filter @workspace/api-server run build`.

Testovi: iz `artifacts/api-server` pokrenuti `node --import tsx --test tests/tender-workflow.test.ts`.

PGlite primjenjuje promjenu nepoznatog roka pri pokretanju. Za vanjski PostgreSQL primijeniti `lib/db/drizzle/0001_nullable_deadline.sql` prije korištenja novog uvoza. Rezervna kopija lokalne baze prije prvog restarta je u `.local/db-backup-20260907-144944`.

## Predloženi sljedeći koraci

1. **Zaduženja i provjera priloga:** odgovorna osoba, interni rok i status za svaki zahtjev, uz obavezni izvorni dokument i dokaz da je prilog pregledan.
2. **Praćenje izmjena:** upoređivanje novih verzija dokumenata i jasno označavanje promijenjenih rokova, lotova i obrazaca.
3. **Profil firme i biblioteka dokaza:** stvarni podaci ponuđača, licence, reference, police i datumi isteka; generisanje nacrta samo iz odobrenih podataka.
4. **OCR i čitanje tabela:** obrada skeniranih PDF-ova i specifikacija, uz oznaku pouzdanosti i provjeru izvornog prikaza.
5. **Stalni server i pouzdan red poslova:** trajno izvršavanje, nadzor neuspjelih preuzimanja, pravila pristupa i provjerene rezervne kopije prije produkcijskog korištenja.
