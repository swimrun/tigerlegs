---
title: Technisch schrijven voor ontwikkelaars
author: HAN docenten
subtitle: v0.3
date: '2026-05-21'
updated: '2026-10-14'
coverImage: img/software-guidebook-boek-werkplek.png
coverAlt: Decoratieve illustratie van een Software Guidebook op een werkplek
---

## Versiegeschiedenis

| Versie | Datum | Wijzigingen |
|--------|-------|-------------|
| v0.1 | 2026-05-21 | Eerste versie: technisch schrijven, SGB, ADR, APA |
| v0.2 | 2026-08-18 | H6 APA als apart hoofdstuk; Jevons paradox; voetnoot-voorbeeld; quiz toegevoegd |
| v0.2.2 | 2026-09-11 | OpenCSV/JaCoCo-voorbeeld toegevoegd: reviewfeedback opsplitsen naar MR-scope, onderhoudbaarheid, naamgeving en optionele moderne syntax |
| v0.2.3 | 2026-10-01 | Decoratieve afbeelding alleen op het voorblad; verwijzingen naar lessen en weken weggehaald |
| v0.3 | 2026-10-02 | §3.2 Actief schrijven: vermijd de lijdende vorm; leeswijzers volgens het Pyramid Principle (§3.3), ook toegepast in deze reader; tabellen en figuren genummerd, met een C4-diagram als figuurvoorbeeld; SGB-hoofdstukken Principles, Code en Data verduidelijkt |
| v0.4 | 2026-10-14 | Alle koppen hebben een doorlopend sectienummer, zodat het dubbele nummer in de PDF (zoals `0.2 1. Inleiding`) verdwijnt; verder is de inhoud ongewijzigd |
| v0.5 | 2026-10-22 | §3.3.2: hoofdstukken met cijfers en bijlagen met letters volgens APA (Merkus, 2022); bijlagen na de bronnenlijst onder een kop *Bijlagen* zonder nummer |
| v0.6 | 2026-10-22 | §3.6: acroniemen en vaktermen bij eerste gebruik uitleggen (volledige term cursief, acroniem tussen haakjes), Engelse vaktermen gebruiken en een tabel met begrippen als bijlage achteraan |

## 1. Inleiding

Als software engineer maak je twee dingen: software en de documentatie die daarbij hoort. Dat klinkt vanzelfsprekend, maar in de praktijk is documentatie vaak het ondergeschoven kindje. Code schrijven voelt productief; documentatie schrijven voelt als administratie. Toch is goede technische documentatie essentieel — zeker nu AI steeds meer code genereert.

Hoofdstuk 2 legt uit waarom documentatie ertoe doet, juist nu AI steeds meer code schrijft; lees het als je twijfelt of documenteren de moeite waard is. Hoofdstuk 3 is de kern: richtlijnen voor helder en lezersgericht schrijven, van actief schrijven tot figuren en tabellen. Gebruik het als naslag bij elke tekst die je schrijft. Hoofdstuk 4 beschrijft het Software Guidebook (SGB) en welke hoofdstukken je daarvan in deze cursus invult. Hoofdstuk 5 laat zien hoe je documentatie bijhoudt terwijl je code schrijft, en hoofdstuk 6 geeft korte praktische tips. Hoofdstuk 7 gaat over bronvermelding met APA; lees het voordat je bronnen in je SGB of ADR's opneemt.

## 2. Waarom technische documentatie ertoe doet

Dit hoofdstuk beschrijft eerst welke rol documentatie in het werkveld speelt (2.1). Daarna laat het zien waarom die rol groeit nu AI code genereert (2.2), en waarom AI als schrijfhulp het werk niet vanzelf minder maakt (2.3).

### 2.1 Documentatie in het werkveld

In veel bedrijven is documentatie verouderd, onvolledig of afwezig. Ontwikkelaars vertrouwen op mondelinge overdracht, Slack-berichten of "de code spreekt voor zich". Dat werkt zolang het team klein is en niemand vertrekt. Zodra een nieuw teamlid instroomt of een systeem na twee jaar onderhoud nodig heeft, ontstaat het probleem: niemand weet meer *waarom* bepaalde keuzes zijn gemaakt.

Docent Theo Theunissen van HAN University deed jaren onderzoek naar moderne software documentatie methoden (en het gebrek daaraan) en heeft een veel bredere kijk op wat software documentatie is, dan velen anderen die toch vooral nog aan Word documenten denken met een 'Functioneel Ontwerp' en een 'Technisch Ontwerp'.

Bijvoorbeeld de commit messages in het versiebeheer systeem (typisch Git) zijn ook een vorm van documentatie. Theunissen stelt dat commitberichten vaak wel vastleggen *wat* is veranderd, maar niet *waarom* broncode is gewijzigd. Maar WAT er veranderd is, is in principe ook af te leiden uit de code wijzigingen zelf, steeds vaker ook met behulp van AI. Voeg daarom ook zeker het waarom — de rationale - toe, zodat je deze zo dicht mogelijk bij de broncode zelf vastlegt. Bijvoorbeeld in pull requests of commits (Theunissen, 2023).

### 2.2 Documentatie in het AI-tijdperk

Robert C. Martin schreef in 2008 in *Clean Code* (dus lang vóór de opkomst van LLM's) al:

> "One might argue that a book about code is somehow behind the times—that code is no longer the issue. That soon all code will be generated instead of written. That programmers simply won't be needed because business people will generate programs from specifications. [...] Nonsense! We will never be rid of code, because code represents the details of the requirements." (Martin, 2008, p. 2)

Martin bedoelde: hoe hoog het abstractieniveau ook wordt, uiteindelijk moet iemand (of iets) precies specificeren wat het systeem moet doen. Die specificatie *is* de code; ook al wordt dit wellicht nog iets anders dan een programmeertaal als Java (en is het soms al; zoals bv. Gherkin scenario's die je in een later vak zult leren).

Nu in 202x AI-tools zals GitHub Copilot en ChatGPT steeds meer code genereren, verschuift de rol van de ontwikkelaar. Je schrijft minder regels code zelf, maar je moet wél precies kunnen specificeren *wat* het systeem moet doen en *waarom*. Die specificatie — in de vorm van requirements, architectuurbeslissingen en ontwerpkeuzes — wordt belangrijker naarmate de AI meer implementatiedetails overneemt.

Concreet betekent dit:

- Een goed geschreven analysedocument levert betere AI-gegenereerde code op dan een vaag verzoek.
- Een helder ontwerpdocument voorkomt dat AI-tools keuzes maken die niet passen bij je architectuur.
- Documentatie die uitlegt *waarom* een keuze is gemaakt, helpt toekomstige ontwikkelaars (en AI-tools) om die keuze te respecteren of bewust te herzien.

### 2.3 AI als schrijfhulp en Jevons' paradox

Het is toegestaan om AI te gebruiken voor het schrijven van documentatie — net als voor code. We kunnen niet verbieden of detecteren of je dit doet. Maar het gebruik van AI als schrijfhulp verschuift de verantwoordelijkheid, het elimineert hem niet: de nieuwe AI-periode verhoogt vooral de kwaliteitseisen aan documentatie.

Dit fenomeen staat bekend als *Jevons' paradox*: een efficiëntieverbetering leidt niet tot minder inspanning, maar tot hogere verwachtingen. Het klassieke voorbeeld is de stofzuiger: bij introductie was het idee dat dit huishoudelijk werk zou verminderen. In de praktijk gingen de hygiënenormen omhoog — een stofvrij huis was nu opeens een haalbare verwachting, waardoor het werk niet afnam, maar soms zelfs toenam.

Hetzelfde geldt voor AI en documentatie:

- Spelfouten zijn niet meer acceptabel — AI kan ze er moeiteloos uithalen.
- Een slecht gestructureerd document is niet meer te verdedigen met "geen tijd" — AI kan een eerste structuur genereren. Als je de tekst uitbreidt kan AI de structuur weer meer passend maken.
- Ontbrekende bronvermelding is niet meer te excuseren — AI kan bronnen opzoeken en formatteren.[^1]

[^1]: Hoewel LLM's bronvermelding niet erg goed doen, momenteel. Vermoedelijk omdat ze getraind zijn op een *body of work* waarin de schrijvers ook niet zo goed waren in goede bronvermelding. Een LLM geeft terug waarop deze getraind is, niet op wat écht goed is. Totdat je de LLM  zelf expliciet aangeeft dit te doen, en daarbij ook de kwaliteitscriteria en ook voorbeelden van wel goed brongebruik en -referenties. Ook moet je concrete voorbeelden geven in gegenereerd materiaal van waar het niet goed gaat, met verbeteringen die de LLM dan wel meer algemeen kan doorvoeren. Je kan het niet bij één prompt houden. Oftewel: "Een prompt is geen prompt."

De norm verschuift: wat eerder "goed genoeg" was, is nu slordig. De verwachting is dat je documentatie kwalitatief beter is *omdat* je betere tooling hebt. Je bent nog steeds eindverantwoordelijk voor de inhoud, correctheid en volledigheid — AI ontslaat je daar niet van.

## 3. Goed technisch schrijven

De richtlijnen in deze sectie zijn gebaseerd op de online Google Technical Writing course (https://developers.google.com/tech-writing) en aangevuld met specifieke aandachtspunten voor softwareontwikkelaars. Sectie 3.1 en 3.2 gaan over de lezer en over actief schrijven. Sectie 3.3 tot en met 3.6 behandelen structuur, lijsten, onderbouwing en terminologie. Sectie 3.7 gaat over figuren en tabellen, en sectie 3.8 over code die zichzelf documenteert.

### 3.1 Lezersgericht schrijven

Maak bij elke sectie duidelijk *waarom* de lezer dit moet lezen. Geef context: wat is de vraag, wat is het bewijs, wat volgt eruit?

Niet goed:

> "Schaalbaarheid is belangrijk."

Beter:

> "Deze architectuur ondersteunt 10x groei zonder herontwerp, wat relevant is wanneer het aantal gebruikers sneller stijgt dan de infrastructuur kan volgen."

#### 3.1.1 Voorbeeld: lezersgericht schrijven in merge request-feedback

Dit geldt ook voor reviewfeedback in een merge request (zie ook de reader *Samenwerken en integreren in brownfield-projecten*, sectie 3.2). Behandel je meerdere, verschillende punten, splits die dan in aparte alinea's of bullets in plaats van alles in één lopende zin te proppen — dat maakt voor de lezer duidelijk welk punt bij welke observatie hoort.

Stel: je reviewt de CSV-exportfeature uit TicketFaster.

Niet goed (twee onderwerpen in één zin, geen scheiding):

> "Dit ziet er niet netjes uit en die dependency had ook los gekund."

Beter (per onderwerp gescheiden, met reden):

> - **Scope van de MR**: de dependency en de code die hem gebruikt horen in dezelfde merge request, want de code compileert niet zonder de dependency.
> - **Onderhoudbaarheid**: als je in de mapping naar `TicketExportRow` op meerdere plekken losse `.toString()`-aanroepen op vergelijkbare velden ziet, is een kleine hulpmethode een suggestie — zo hoeft een toekomstige veldwijziging maar op één plek.
> - **Naamgeving**: een variabele als `list1` vertelt de lezer niet wat erin zit; een naam als `exportRows` maakt in één oogopslag duidelijk wat de collectie bevat.
> - **Moderne syntax (optioneel)**: bij een lokale variabele waarvan het type al duidelijk is uit de toewijzing kun je `var` overwegen. Dit is een stijlkeuze, geen vereiste — benoem dit als suggestie ("dit zou ook kunnen"), niet als eis.

De tweede versie maakt meteen duidelijk dat het eerste punt over MR-scope gaat en de andere over codekwaliteit — verschillende soorten feedback die niet door elkaar horen te lopen.

### 3.2 Actief schrijven: vermijd de lijdende vorm

Schrijf in de bedrijvende (actieve) vorm: het onderwerp van de zin voert de handeling uit. In de lijdende (passieve) vorm staat de handeling voorop en verdwijnt de uitvoerder vaak uit de zin. De lezer moet dan zelf raden wie iets doet. De Google Technical Writing course zegt het zo:

> "Passive voice obfuscates your ideas, turning sentences on their head. Passive voice reports action indirectly. Some passive voice sentences omit an actor altogether, which forces the reader to guess the actor's identity." (Google, 2025)

Bovendien is de actieve vorm meestal korter. Bekijk ook de korte video *Active Voice vs. Passive Voice* uit deze course: https://www.youtube.com/watch?v=nG6DhoFt938.

Voor requirements is dit extra belangrijk. Een requirement in de lijdende vorm kan grammaticaal kloppen en toch onduidelijk zijn, omdat niemand weet wie het gedrag moet leveren. IBM formuleert de regel voor requirements zo: "Effective requirements clearly state who or what performs an action. Rewrite the requirement to clearly identify and focus on the actor." (IBM, z.d.). Voor ontwikkelaars voelt dat vertrouwd: ook in je ontwerp beleg je elke verantwoordelijkheid bij een klasse of component.

Tabel 1 geeft voorbeelden uit verschillende soorten teksten die je in deze cursus schrijft.

*Tabel 1*: Lijdende en actieve vorm in FUSTEN-teksten.

| Soort tekst | Lijdende vorm | Actieve vorm |
|-------------|---------------|--------------|
| Requirement | Er wordt een foutmelding getoond als het bedrag negatief is. | De frontend toont een foutmelding als het bedrag negatief is. |
| Ontwerp | De expense wordt gevalideerd en opgeslagen. | `ExpenseService` valideert de expense en `ExpenseRepository` slaat hem op. |
| ADR | Er is gekozen voor Spring JDBC. | Het team kiest voor Spring JDBC, omdat je dan de SQL zelf ziet. |
| Inleiding | In hoofdstuk 4 wordt de architectuur beschreven. | Hoofdstuk 4 beschrijft de architectuur. |

Het laatste voorbeeld gebruikt de IS-AV-constructie (*inanimate subject, active verb*): een onbezield onderwerp, zoals een hoofdstuk of paragraaf, met een actief werkwoord. Die constructie is handig in structurerende zinnen, zoals in een inleiding of leeswijzer, waar je geen ik- of wij-vorm wilt gebruiken (Vleeshouwers, 2024). Scribbr geeft als voorbeeld: "Deze paragraaf laat de belangrijkste aandachtspunten zien." (Vleeshouwers, 2024).

De lijdende vorm is niet verboden. Gebruik hem bewust als de uitvoerder onbekend of minder belangrijk is dan de handeling; ook IBM (z.d.) noemt die uitzondering. "De database wordt elke nacht geback-upt" is prima als het niet uitmaakt welk proces dat doet.

**Tip:** zoek in je tekst op *word*, *wordt*, *worden* en *werd*. Kom je ze vaak (bijvoorbeeld meer dan tien keer) tegen, herschrijf die zinnen dan actief. ~~Meestal wordt je tekst daar ook korter van~~. Daarmee maak je je tekst meestal ook korter.

### 3.3 Structuur en kopjes

Gebruik informatieve kopjes die de inhoud samenvatten. Vermijd vragen in kopjes — stel die in de lopende tekst. Nummer secties zodat je er makkelijk naar kunt verwijzen.

Gebruik sectienummering maximaal tot niveau H4, dus `x.y.z`. Dieper nummeren wijst op te complexe structuur. Linus Torvalds formuleert dit principe voor code, maar het geldt evenzeer voor schrijven: "if you need more than 3 levels of indentation, you're screwed anyway, and should fix your program" (Torvalds, z.d.). Een document met meer dan drie niveaus schrijf je beter platter of splits je op.

#### 3.3.1 Leeswijzers: laat de lezer kiezen

Begin een document met een leeswijzer in de inleiding. Noem per hoofdstuk in één of twee zinnen wat de lezer er vindt en wanneer het voor hem of haar relevant is. Een inhoudsopgave somt alleen titels op; een leeswijzer helpt de lezer kiezen. Begin daarnaast elk hoofdstuk met een korte inleiding die de secties erna aankondigt. Zo kan de lezer de secties lezen die voor hem of haar relevant zijn en de rest overslaan. Dat kost de schrijver meer werk en de lezer minder.

Dit is een toepassing van het *Pyramid Principle* van Minto (2009): zet de kern bovenaan en laat daaronder de onderdelen volgen die die kern uitwerken, waarbij elk niveau samenvat wat eronder staat. De leeswijzer in de inleiding is de top van de piramide voor het hele document; de inleiding van een hoofdstuk is de top voor dat hoofdstuk.

Niet goed (enkel de inhoudsopgave herhalen, maar nu in zinnen):

> "Hoofdstuk 2 gaat over de architectuur. Hoofdstuk 3 gaat over de data."

Beter (wat vindt de lezer, en wanneer heeft hij of zij het nodig):

> "Hoofdstuk 2 laat zien waarom de frontend alleen via de backend-API met de database praat; lees het voordat je een nieuwe feature toevoegt. Hoofdstuk 3 beschrijft welke data de applicatie opslaat en hoe je het datamodel uitbreidt."

In een Software Guidebook werkt dit hetzelfde: de inleiding zegt welk hoofdstuk welke vraag beantwoordt, en elk hoofdstuk begint met de belangrijkste keuze of conclusie. Deze reader past het zelf ook toe.

#### 3.3.2 Hoofdstukken met cijfers, bijlagen met letters

Nummer hoofdstukken en secties met cijfers (1, 1.1, 1.1.1) en bijlagen met letters. Dat is de conventie in APA. Merkus (2022) schrijft: "Als je meer dan één bijlage toevoegt, dan noem je de bijlagen "Bijlage A", "Bijlage B", enzovoorts." Het heet dus *Bijlage A* en niet *Bijlage 1*. Bij één bijlage noem je deze simpelweg "Bijlage" (Merkus, 2022).

Zet de bijlagen na de bronnenlijst (Merkus, 2022: "Je plaatst de bijlagen na je literatuurlijst."), onder een eigen kop *Bijlagen* zonder hoofdstuknummer. Daaronder krijgt elke bijlage een kop met letter en titel, zoals *Bijlage A: Titel*. Zo blijven de cijfers voor de hoofdstukken doorlopend, en kan een verwijzing als "zie Bijlage A" niet verward worden met "zie hoofdstuk 1". De bronnenlijst en de versiegeschiedenis krijgen ook geen nummer.

Merkus (2022) merkt op: "De meeste hogescholen en universiteiten hanteren de APA-richtlijnen alleen voor de bronvermelding en niet voor de opmaak." Controleer dus welke opmaak je opleiding of opdrachtgever vraagt. In technische documentatie sluit je aan bij de APA-conventie voor bijlagen, tenzij een opdracht of huisstijl iets anders voorschrijft.

### 3.4 Lijsten inleiden

Elke opsomming krijgt eerst een korte inleidende zin die uitlegt waarom de lijst relevant is. Vermijd kale lijstjes zonder context.

### 3.5 Onderbouwing en brongebruik

De belangrijkste regel voor technisch schrijven: onderbouw je beweringen. Elke claim die niet vanzelfsprekend is, koppel je aan een bron of markeer je expliciet als aanname.

Richtlijnen voor brongebruik:

- **Citeer liever dan parafraseer.** Een letterlijk citaat is verifieerbaar; een parafrase kan onbedoeld de betekenis verschuiven. Dit is extra relevant nu LLM's makkelijk parafraseren — een direct citaat bewijst dat je de bron daadwerkelijk hebt gelezen (van der Wal, 2025).
- **Kies betrouwbare bronnen.** Geef voorkeur aan erkende experts, officiële documentatie en bronnen met duidelijke auteur en datum.
- **Scheid feit, interpretatie en besluit.** Een feit is verifieerbaar. Een interpretatie is jouw uitleg ervan. Een besluit is je keuze op basis van beide.
- **Volg APA 7 voor bronvermelding.** Gebruik (Auteur, Jaar) in de tekst en een alfabetisch gesorteerde bronlijst achteraan.

### 3.6 Terminologie

Gebruik consistente termen in het hele document. Kies één term en houd je daaraan. Definieer vakjargon bij eerste gebruik.

Leg acroniemen en vaktermen uit op de plek waar ze voor het eerst voorkomen. Schrijf de volledige term uit, zet hem cursief en zet het acroniem tussen haakjes erachter, bijvoorbeeld: *Data Access Object* (DAO). Herhaal die uitleg de eerste paar keer dat de term terugkomt, vooral als er een of meer hoofdstukken tussen zitten. Lezers springen vaak naar een hoofdstuk en lezen dat niet vanaf het begin. Gebruik voor technische termen de gangbare Engelse benaming, zoals *large language model*, en geen geforceerde Nederlandse vertaling.

Zet een tabel met begrippen en afkortingen als bijlage achteraan het document, en niet als eerste hoofdstuk, zoals in SRS- en SDD-documenten vaak gebeurt. De tabel is bedoeld om iets snel op te zoeken; de uitleg bij eerste gebruik blijft nodig.

### 3.7 Afbeeldingen en diagrammen

Gebruik afbeeldingen en diagrammen om je document toegankelijker te maken. Google Technical Writing beschrijft het effect:

> "when it comes to reading technical material, the vast majority of adults are still little kids—still yearning for pictures rather than text." (Google, z.d.-b)

Onderzoek bevestigt dat afbeeldingen het leesplezier verhogen, maar dat alleen *instructieve* afbeeldingen (die iets verduidelijken) ook het begrip verbeteren. Decoratieve afbeeldingen maken een document aantrekkelijker maar helpen niet bij het leren en begrijpen (Sung & Mayer, 2012). Het achterliggende principe staat in de onderwijspsychologie bekend als het "multimedia effect": "a large number of studies have obtained desirable effects on learning outcomes from presenting both text and pictures (i.e., multimedia) compared with presenting text only" (Schweppe et al., 2015, p. 24).

Richtlijnen voor het gebruik van afbeeldingen in technische documenten:

- **Nummer elke instructieve afbeelding** met een figuurnummer: *Figuur 1*, *Figuur 2*, etc. Het nummeren maakt het mogelijk om vanuit de tekst naar de afbeelding te verwijzen. Puur decoratieve afbeeldingen (bijv. een sfeerfoto) hoef je niet te nummeren.
- **Geef elke instructieve afbeelding een onderschrift** dat kort beschrijft wat de lezer ziet. Houd het bij één regel. Wil je meer zeggen, maak het onderschrift dan een korte samenvatting en zet de langere uitleg in de lopende tekst, met het figuurnummer erbij ("Figuur 2 laat zien dat …"). Een onderschrift helpt ook voor toegankelijkheid: screenreaders gebruiken het onderschrift en de alt-tekst om de afbeelding te beschrijven aan gebruikers die niet kunnen zien. Voor decoratieve afbeeldingen geldt het omgekeerde: "voor afbeeldingen die alleen maar decoratief zijn wordt aangeraden om de alternatieve beschrijvingen leeg te laten (`alt=""`)" (Brakel, 2021). Een lege alt-tekst vertelt de screenreader dat de afbeelding geen inhoudelijke informatie draagt en dat hij die kan overslaan.
- **Verwijs vanuit de tekst naar het figuurnummer** ("zie Figuur 3") zodat de lezer weet waar de afbeelding bij hoort en wanneer die relevant is. Zonder verwijzing moet de lezer zelf raden of de afbeelding bij de vorige of de volgende alinea hoort. Door expliciet te verwijzen betrek je de afbeelding bij je betoog. Stap 3 en 4 kun je vaak combineren in één zin, bijvoorbeeld: "Zoals Figuur 2 toont is het belangrijk om..." of "Het in Figuur 3 getoonde C4 Containerdiagram bevat geen methodeaanroep-details, maar de `ThrowDiceService` bevat vier methoden zoals behandeld in sectie 7.3 over Code."
- **Licht de afbeelding toe in de lopende tekst.** Een diagram zonder toelichting is net als een tabel zonder inleidende zin: de lezer moet zelf raden wat relevant is. De toelichting beschrijft wat je in de afbeelding wilt benadrukken en wat de afbeelding alleen niet communiceert.

![Infographic met de vier richtlijnen voor afbeeldingen in technische documentatie](img/richtlijnen-afbeeldingen-in-technische-documentatie.png)

#### 3.7.1 TOELICHTen = uitLICHTen + TOEvoegen

Dit principe geldt niet alleen voor afbeeldingen, maar voor alle elementen die je in je tekst opneemt: tabellen, opsommingen, codeblokken, diagrammen. Een goede toelichting doet twee dingen:

1. **uitLICHTen** — selecteer welk onderdeel van het element aandacht verdient. Niet alles is even belangrijk; wijs de lezer op het relevante deel, en ga NIET alles langslopen (maar... 'LICHT er iets uit)
2. **TOEvoegen** — voeg informatie toe die het element/diagram alleen niet communiceert. Waarom is dit relevant? Wat is de implicatie?

Voor tabellen geldt aanvullend: als een tabelcel meer dan twee zinnen bevat, overweeg of die informatie beter als gewone paragraaf kan (Google, z.d.-a). Leid elke tabel en elke lijst in met een zin die aangeeft wat de lezer kan verwachten (Google, z.d.-a).

#### 3.7.2 Voorbeeld

Een diagram met als bijschrift alleen "Architectuurdiagram", zonder verwijzing of toelichting in de tekst, laat de lezer raden wat het toont en waarom het er staat. Figuur 2 laat zien hoe het beter kan.

![C4-containerdiagram van de filmfestival-applicatie](img/c4-container-filmfestival.png)

Figuur 2 laat zien dat de frontend geen directe toegang heeft tot de database. Alle dataverzoeken lopen via de backend-API. De backend benadert de database en een externe poster-API. Deze scheiding is een bewuste keuze om de database af te schermen van de buitenwereld.

Dit voorbeeld is op vier punten beter:

1. **Informatief bijschrift**: "Architectuurdiagram" zegt niet welk soort diagram het is of over welk systeem het gaat. "C4-containerdiagram van de filmfestival-applicatie" zegt dat wel.
2. **Kort bijschrift**: het bijschrift past op één regel. De uitleg staat in de lopende tekst.
3. **Figuurnummer**: de tekst verwijst naar "Figuur 2", ook als de afbeelding door de opmaak op een andere plek of pagina terechtkomt.
4. **Toelichting**: de alinea licht één ding uit (de frontend praat niet rechtstreeks met de database) en voegt toe wat het diagram zelf niet vertelt (dat dit een bewuste keuze is, en waarom). Dat is TOELICHTen.

### 3.8 Zelfverklarende code als documentatie

Code is zelf ook documentatie. Althans goede code. Goede naamgeving maakt commentaar vaak overbodig:

```java
// Niet goed
int x = getP(); // haal prijs op

// Beter
int productPrijs = getProductPrijs();
```

Commentaar in code legt uit *waarom* iets zo is, niet *wat* er staat — dat zie je al in de code zelf.

## 4. Het Software Guidebook

<img src="img/simon-brown-software-guidebook.png" alt="Simon Brown presenteert over software-architectuurdocumentatie" align="right" width="300" style="margin-left: 1em; margin-bottom: 0.5em;" />

Simon Brown introduceerde het **Software Guidebook** (SGB) als alternatief voor de traditionele — vaak verouderde — softwaredocumentatie. Het idee: bundel alle relevante informatie over een systeem in één levend document dat meegroeit met de code (Brown, 2022).

Sectie 4.1 beschrijft welke hoofdstukken een SGB kan bevatten, en sectie 4.2 waar architectuur, ontwerp en codeconventies daarin terechtkomen. Sectie 4.3 koppelt het SGB aan de documenten uit jaar 1. Sectie 4.4 en 4.5 laten zien wat je in deze cursus invult en wat later komt.

### 4.1 Wat staat in een Software Guidebook?

Een Software Guidebook (SGB) kan de hoofdstukken uit Tabel 2 bevatten. Brown beschrijft dit als een template: niet elk project hoeft elk hoofdstuk in te vullen. Secties als Context, Functional Overview en Software Architecture zijn bij vrijwel elk systeem relevant; secties als Operation & Support of Infrastructure Architecture vul je alleen in als het systeem in productie draait op eigen infrastructuur. Het SGB van de filmfestival-casus bevat bijvoorbeeld geen hoofdstuk over Operation & Support, omdat de applicatie (nog) niet in productie draait voor echte gebruikers.

*Tabel 2*: Hoofdstukken van een Software Guidebook.

| #  | Hoofdstuk                | Beschrijving                                                                      |
| -- | ------------------------ | --------------------------------------------------------------------------------- |
| 1  | Context                  | Wat doet het systeem en voor wie? Wat zijn de externe afhankelijkheden?            |
| 2  | Functional Overview      | Welke functionaliteit biedt het systeem?                                          |
| 3  | Quality Attributes       | Welke kwaliteitseisen gelden (performance, beschikbaarheid, beveiliging)?         |
| 4  | Constraints              | Welke technische en organisatorische beperkingen zijn er?                         |
| 5  | Principles               | Welke ontwerpprincipes hanteren we?                                               |
| 6  | Software Architecture    | Hoe ziet de structuur eruit op hoog niveau (C4-diagrammen)?                       |
| 7  | Code                     | Hoe heb je de code georganiseerd? Welke patronen en conventies gebruik je?       |
| 8  | Data                     | Hoe en waar slaat je applicatie data op, en hoe wisselt die data uit met andere systemen?                               |
| 9  | Infrastructure Architecture | Welke servers, netwerken en clouddiensten gebruik je?                     |
| 10 | Deployment               | Hoe rol je het systeem uit en hoe beheer je het? De `README.md` in de root van je repo hoort altijd een "how to run"-sectie te bevatten die een nieuwe ontwikkelaar in staat stelt om de applicatie te starten (Microsoft, z.d.). Het SGB kan hier beter naar verwijzen in plaats van dit te dupliceren. |
| 11 | Operation & Support      | Hoe monitor en onderhoud je het systeem?                                  |
| 12 | Development Environment  | Welke tools, IDE's en lokale setup zijn nodig om te ontwikkelen?                  |
| 13 | Decision Log             | Overzicht van genomen architectuurbeslissingen. Verwijst naar de individuele ADR's (bijv. `docs/adr/001-*.md`) voor de details. |

### 4.2 Architectuur, ontwerp en codeconventies

Fowler haalt Ralph Johnson aan met een korte definitie: "Architecture is about the important stuff. Whatever that is" (Fowler, 2019). Dat klinkt vaag, maar het is juist bruikbaar: een team moet zelf bepalen welke ontwerpkeuzes belangrijk genoeg zijn om expliciet te sturen, documenteren en bewaken.

In deze cursus gebruiken we daarbij deze vuistregel: architectuur gaat over belangrijke ontwerpbeslissingen die moeilijk of duur zijn om later te veranderen. Een programmeertaal, databaseplatform, communicatiestijl tussen frontend en backend, authenticatie-aanpak of package-structuur kan daardoor architectuur zijn. Zulke keuzes raken veel bestanden, teamgewoonten, deployment, tests en soms zelfs data die al in productie staat.

Niet elke afspraak die overal zichtbaar is, is automatisch architectuur. Naamgeving, formattering en mappings tussen lagen zijn vaak code- of dataconventies. De keuze voor technologie of globale structuur leg je vast in H6 (Software Architecture) of in een ADR in de Decision Log. De concrete uitwerking in packages, klassen, naamconventies en mappings beschrijf je in H7 (Code).

Een voorbeeld: als je Java en PostgreSQL gebruikt, kan `customer_id` in de database corresponderen met `customerId` in Java. De keuze voor Java en PostgreSQL kan architecturaal zijn. De concrete casing-mapping hoort meestal in H7 (Code), omdat die uitlegt hoe ontwikkelaars de gekozen technologieën consequent toepassen.

AI-tools kunnen sommige technische migraties goedkoper maken: een applicatie herschrijven naar een andere taal of framework is minder ondenkbaar dan vroeger. Dat betekent niet dat architectuur verdwijnt; het verschuift waar de moeilijkheid zit. Domeinregels, databetekenis, integratieafspraken, teamkennis en afhankelijkheden met andere applicaties blijven vaak lastig te veranderen. Daarom sturen we in grotere projecten op package-by-feature: de code moet het domein en de use cases zichtbaar maken, niet alleen het gebruikte framework.

Dat sluit aan bij Martins idee van "screaming architecture": "so should the architecture of a software application scream about the use cases of the application" (Martin, 2011). Met andere woorden: de structuur van je applicatie moet laten zien welk domein en welke use cases centraal staan. Bij een filmfestivalapplicatie wil je dus woorden als `screening`, `ticket`, `edition` of `venue` terugzien, niet alleen technische mappen zoals `controllers`, `services` en `repositories`.

### 4.3 Mapping naar jaar-1-documenten en gangbare terminologie

In jaar 1 heb je losse documenten geschreven: een opdrachtbeschrijving, een analysedocument en een ontwerpdocument. Het Software Guidebook bundelt deze in een samenhangende structuur. In het werkveld en in hogere jaren van je opleiding kom je dezelfde documenten tegen onder andere namen. Tabel 3 laat zien hoe alles samenhangt.

De extra kolom "Andere gangbare namen" toont termen die je tegenkomt in het werkveld, in andere vakken, of in methodieken als IEEE, SDM en DSDM. De namen verschillen, maar het onderliggende onderscheid is steeds hetzelfde: *wat* moet het systeem doen (analyse/specificatie) versus *hoe* is het systeem opgebouwd (ontwerp). Overigens is dat onderscheid relatief: de ene laag zijn "hoe" is de volgende laag zijn "wat" — dat is inherent aan decompositie van complexe systemen.

*Tabel 3*: Jaar-1-documenten, SGB-hoofdstukken en andere gangbare namen.

| Jaar 1 document                                   | SGB-hoofdstuk                          | Andere gangbare namen                                                                                                  | Kernvraag    |
| ------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| Opdrachtbeschrijving / interview opdrachtgever    | 1. Context                             | Projectcharter, Terms of Reference                                                                                     | Waarom?      |
| Analysedocument (functionele eisen, use cases)    | 2. Functional Overview                 | Software Requirements Specification (SRS, IEEE 830), Functioneel Ontwerp (FO, SDM/DSDM), Requirements Document         | Wat?         |
| Ontwerpdocument (technische keuzes, klassendiagram) | 6. Software Architecture / 7. Design Decisions | Software Design Document (SDD, IEEE 1016), Technisch Ontwerp (TO, SDM/DSDM), Architecture Document                    | Hoe?         |

Het verschil met jaar 1: daar waren dit losse documenten die je apart inleverde. In het SGB staan ze samen, zodat de samenhang zichtbaar is. Als je architectuur verandert, zie je direct of dat gevolgen heeft voor de functionele beschrijving of de kwaliteitseisen.

### 4.4 Wat vullen we in deze cursus in?

Tabel 4 laat zien aan welke SGB-hoofdstukken je in deze cursus werkt.

*Tabel 4*: SGB-hoofdstukken per week in deze cursus.

| Week | SGB-hoofdstuk | Activiteit |
|------|---------------|------------|
| 5 | 1. Context | Beschrijf de context van je systeem |
| 5 | 2. Functional Overview | Beschrijf de belangrijkste functionaliteit |
| 6–7 | 13. Decision Log | Schrijf ADR's (Architecture Decision Records) voor je ontwerpkeuzes |
| 8 | 3. Quality Attributes | Benoem relevante kwaliteitseisen |
| 8 | 6. Software Architecture | Maak een C4-containerdiagram |

### 4.5 Wat komt later?

De hoofdstukken in Tabel 5 vullen we in deze cursus nog niet in, maar ze worden relevant in latere fases van je opleiding en carrière.

*Tabel 5*: SGB-hoofdstukken voor latere fases.

| SGB-hoofdstuk               | Wanneer relevant                       | Waarom later                                                                                                           |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 4. Constraints              | 3e jaar (projecten met echte opdrachtgevers) | In deze cursus zijn de beperkingen vooraf gegeven (taal, framework, casus, evt. deadlines). Bij projecten met externe opdrachtgevers moet je constraints zelf inventariseren en documenteren. |
| 5. Principles               | 3e jaar / stage                        | Principes zoals SOLID pas je in deze cursus al toe, maar zelf de ontwerpprincipes voor een systeem kiezen en afwegen vraagt meer ontwerpervaring. De patterns die je gebruikt, beschrijf je in hoofdstuk 7. Code; daar kun je ook noemen welk principe een pattern ondersteunt. |
| 7. Code                     | Deels in deze cursus (ADR's over code-organisatie) | Hier beschrijf je de code-organisatie en de patterns die je toepast, zoals de lagen controller-service-repository. Een uitgebreidere beschrijving past bij grotere projecten. |
| 8. Data                     | 2e jaar                                | De filmfestival-app heeft al een database, maar deze cursus legt de focus niet op datapersistentie. Je werkte in jaar 1 ook al met een database; datamodellering en -beheer komen in het 2e jaar terug. |
| 9. Infrastructure Architecture | 3e jaar / stage                     | Pas relevant als je systemen op echte infrastructuur (cloud, on-premise) uitrolt.                                      |
| 10. Deployment              | 3e jaar / stage                        | Deployment-documentatie is relevant zodra je systemen in productie brengt.                                             |
| 11. Operation & Support     | Stage / afstuderen / werkveld          | Monitoring, logging en onderhoudsprocedures horen bij systemen die daadwerkelijk draaien voor gebruikers.              |
| 12. Development Environment | Deels in deze cursus (README's)        | Een volledige beschrijving past bij projecten met complexe lokale setup.                                               |

Het doel is dat je aan het eind van je opleiding een volledig SGB kunt schrijven. In deze cursus leg je de basis.

## 5. Continuous Documentation

Dit hoofdstuk begint bij het probleem van documentatie achteraf (5.1) en zet daar de oplossing tegenover: documentatie en code tegelijk bijwerken (5.2). Sectie 5.3 laat zien hoe dat in de praktijk gaat, en sectie 5.4 waarom het werkt.

### 5.1 Het probleem met "documentatie achteraf"

De traditionele aanpak — eerst code schrijven, daarna documenteren — leidt bijna altijd tot verouderde documentatie. De code verandert, maar niemand past het document aan. Na een paar sprints klopt de documentatie niet meer met de werkelijkheid.

### 5.2 De oplossing: documentatie en code tegelijk

Continuous Documentation betekent dat je documentatie en code tegelijkertijd bijwerkt, in dezelfde commit of merge request. Concreet:

- Als je een architectuurbeslissing neemt, schrijf je direct een ADR.
- Als je een API wijzigt, pas je het Functional Overview aan in dezelfde MR.
- Als je een nieuw component toevoegt, update je het architectuurdiagram in dezelfde commit.

Theunissen beschrijft deze werkwijze als essentieel voor het behoud van documentatiekwaliteit: documentatie die je niet synchroon met de code bijhoudt, veroudert onvermijdelijk (Theunissen, 2023).

### 5.3 Hoe werkt dat in de praktijk?

In deze cursus passen we Continuous Documentation als volgt toe:

1. **Eén MR, één verhaal.** Als je merge request een nieuwe feature bevat, bevat dezelfde MR ook de bijbehorende documentatie-update.
2. **Review omvat documentatie.** Bij een code review controleer je ook of de documentatie klopt met de code.
3. **Het SGB is een levend document.** Je Software Guidebook groeit mee met je project — het is nooit "af" en nooit "verouderd" zolang je het bijhoudt.

### 5.4 Waarom dit werkt

De drempel om documentatie bij te werken is het laagst op het moment dat je de code schrijft. Op dat moment weet je precies *wat* je hebt veranderd en *waarom*. Een week later ben je dat vergeten. Continuous Documentation maakt gebruik van dat momentum.

## 6. Praktische tips

Dit hoofdstuk geeft drie korte tips: schrijf voor je toekomstige zelf (6.1), leg ontwerpkeuzes vast in ADR's (6.2) en houd het kort (6.3).

### 6.1 Schrijf voor je toekomstige zelf

Stel je voor dat je over zes maanden je eigen code terugleest. Wat zou je dan willen weten? Schrijf dat op. Niet de implementatiedetails (die staan in de code), maar de *context* en de *rationale*.

### 6.2 Gebruik ADR's voor ontwerpkeuzes

Een Architecture Decision Record (ADR) legt één beslissing vast in een kort, gestructureerd formaat:

- **Context** — Wat is de situatie? Welk probleem los je op?
- **Beslissing** — Wat heb je gekozen?
- **Gevolgen** — Wat zijn de voor- en nadelen van deze keuze?

ADR's zijn waardevol omdat ze de *waarom* vastleggen. Code laat zien *wat* je hebt gebouwd; een ADR legt uit *waarom* je het zo hebt gebouwd en niet anders.

### 6.3 Houd het kort

Goede documentatie is kort en to the point. Eén pagina die de kern raakt is waardevoller dan tien pagina's die niemand leest. Schrijf alleen op wat de lezer nodig heeft om het systeem te begrijpen of eraan te werken.

## 7. Bronvermelding en APA in technische documentatie

Dit hoofdstuk beschrijft hoe je bronnen correct vermeldt in technische documentatie. Sectie 7.1 legt uit wat een SGB *niet* is — geen lesmateriaal voor beginners, maar verwijzingen naar wat je hebt gebruikt en waarom. Sectie 7.2 verduidelijkt het verschil tussen een bronnenlijst en een bibliografie. Sectie 7.3 beschrijft de APA-stijl die we op de HAN hanteren. Sectie 7.4 behandelt het refereren naar online community-bronnen (StackOverflow, Medium, Reddit). Sectie 7.5 beschrijft veelgemaakte fouten bij APA-referenties.

### 7.1 Wat een SGB niet is

Technische documentatie bij code zoals een Software Guidebook, of FO/TO of SRS/SDD) is geen cursus voor beginners. Je gaat geen basisprincipes van React of Spring Boot uitleggen, en geen tutorial schrijven over conditionals of while loops. Dat veronderstel je bekend bij de lezer.

Wat je wél doet:

- Beschrijven *hoe* je bestaande frameworks en technieken hebt ingezet
- Welke keuzes je (als team) tijdens het software bnouwen hebt gemaakt en waarom (ADR's)
- Welke principes leidend waren en hun onderlinge prioriteiten
- De lezer in staat stellen zich te verdiepen: vermeld welke kennis je veronderstelt en geef pointers naar relevante bronnen (bijv. de Angular Styleguide, react.dev, een specifiek hoofdstuk uit een boek)

Een SGB is geen "spreekbeurt over Spring Boot" maar wel "hier is hoe deze applicatie in elkaar zit, welke technologieën zijn gebruikt, en waar je meer kunt lezen."

### 7.2 Bronnenlijst vs. bibliografie

Een bronnenlijst bevat alleen bronnen waarnaar je vanuit de tekst verwijst. Verwijs je in de tekst niet naar een bron, dan hoort hij niet in de bronnenlijst — dat is een bibliografie (aanbevolen leeslijst). Zo'n lijst kan nuttig zijn, maar staat apart, niet als "Bronnen" achteraan.

Microsoft Word noemt de automatisch gegenereerde sectie standaard "Bibliografie". Dat is technisch correct voor Word's functie (het genereert een lijst van alles wat je hebt ingevoerd), maar voor een SGB of technisch document moet je zelf filteren: alleen bronnen die je daadwerkelijk in de tekst aanhaalt horen in de bronnenlijst.

De balans: beschrijf het *specifieke* van jouw systeem, verwijs voor het *generieke* naar bestaande bronnen. Als de aanname is dat de lezer alles al weet, leest niemand je documentatie. Maar als je documentatie alleen maar basiskennis herkauwt die overal online staat, schrijf je nutteloze documentatie.

### 7.3 APA in technische documentatie

Op de HAN gebruiken we APA-stijl: auteur en jaartal in ronde haken in de tekst, volledige referentie in de bronnenlijst achteraan. In de bronnenlijst vermeld je de volledige datum, titel, en bij online bronnen een URL. Bij boeken: paginanummer en uitgever.

### 7.4 Referenties naar online community-bronnen

Online community-bronnen (StackOverflow, Medium, Reddit, Dev.to) zijn een legitieme vorm van *community research* (ICT Research Methods, z.d.). Het structureel uitsluiten van een platform is een vorm van vooringenomenheid — beoordeel een bron op inhoud, niet op het platform waarop het staat.

Wat wel geldt: het platform is NIET de auteur. De auteur is degene die het antwoord of de post heeft geschreven. Dit geldt voor StackOverflow, maar evengoed voor een blogpost op Medium of een thread op Reddit. Dus zet NIET het platform als auterusnaam (veel gemaakte fout).

#### 7.4.1 Anti-pattern 1: platform als auteur

Fout: `StackOverflow. (2021). *Is it common to...?*`

Goed: `bitfox. (2021). Antwoord op *Is it common to...?* [StackOverflow].`

Het platform (StackOverflow, Medium.com, Dev.to) is het *medium*, NIET de auteur. Gebruik de gebruikersnaam van de beantwoorder. Als alleen een voornaam of alias/avatar bekend is, gebruik die als achternaam in de verwijzing (Swaen, 2024).

Een mogelijke tegenwerping is: "Maar niemand weet wie `bitfox` is; dat is alleen een alias en dus geen autoritatieve bron." Dat kan kloppen. Dan is de oplossing niet om `StackOverflow` als auteur op te geven, maar om deze bron weg te laten of een betere bron met een betere quote te zoeken. Soms kun je de auteur achter een alias wel controleren via het profiel. Jon Skeet is bijvoorbeeld een bekende C#-ontwikkelaar en auteur maar ook fervent StackOverflow poster 2018 dat hij als eerste gebruiker boven de miljoen reputatiepunten kwam (Larsen & Silge, 2018). Dat maakt zijn antwoorden beter herleidbaar dan een onbekende alias. Voor `bitfox` geldt dat niet, die is en blijft anoniem, maar zijn/haar antwoord in wel de geselecteerde StackOverflow-answer.

#### 7.4.2 Anti-pattern 2: titel als verwijzing in de tekst

Fout: "...wordt afgeraden (*Is it common to dedicate a git branch for a separate project?*, 2021)."

Goed: "...wordt afgeraden (bitfox, 2021)."

Gebruik altijd de auteur(snaam) in de verwijzing in de tekst, niet de titel van het stuk.

#### 7.4.3 Format voor een StackOverflow-antwoord

```text
Auteur. (jaar). Antwoord op *Vraagtitel* [StackOverflow].
  URL
```

Voorbeeld:

```text
bitfox. (2021). Antwoord op *Is it common to dedicate a git branch
  for a separate project?* [StackOverflow]. Geraadpleegd van
  https://stackoverflow.com/questions/67517650/ 
```

### 7.5 Veelgemaakte fouten bij APA-bronvermelding

#### 7.5.1 Voetnoten voor bronvermelding

APA gebruikt geen voetnoten voor bronverwijzingen.[^2] Je mag voetnoten gebruiken voor aanvullende toelichting, maar bronverwijzingen staan inline in de tekst als (Auteur, jaar), niet als voetnoot onderaan de pagina.

[^2]: Dit is een voorbeeld van een voetnoot. Een voetnoot bevat optionele toelichting — geen essentiële informatie. Maak van een voetnoot niet enkel een URL zoals `https://spring.io`, want dat is geen APA. Je kunt binnen een voetnoot wel een bron aanhalen: "De veelgebruikte APA-stijl schrijft voor dat je geen voetnoten gebruikt om bronnen te vermelden" (Swaen, 2013).

#### 7.5.2 Gebruik geen IEEE referenties (maar APA)

In wetenschappelijke papers zie je ook de IEEE-standaard met blokhaken en nummers: [1], [2], [3]. Dat is an sich geen fout — het is een ander systeem, maar op de HAN dit gebruiken is in principe wel fout. Op de HAN kiezen we voor APA, en APA heeft als objectief voordeel dat auteur en jaar direct zichtbaar maakt in de tekst, zonder dat de lezer naar een genummerde lijst moet scrollen. Je weet of het recent is of niet, en herkent evt. een vertrouwde auteur, of leert deze kennen. Nadeel van APA kan bv. zijn dat je bronnen alfabetisch ordent, waardoor referenties lijst in andere volgorde staat dan de referenties ze in de tekst voorkomen, wat bij IEEE niet zo is.

Mocht je goede redenen hebben om i.p.v. APA andere standaard zoals IEEE te willen stem dit dan af met je begeleiders. In overleg is veel mogelijk.

#### 7.5.3 De (ronde) haakjes-regel

Een verwijzing tussen haakjes is grammaticaal een optioneel deel van de zin. De zin moet zowel mét als zónder het stuk tussen haakjes kloppen.

Fout: "(Minto, 2009) zegt dat je documenten gestructureerd moet schrijven." (Zonder haakjes: "zegt dat je..." — geen onderwerp.)

Goed: "Minto (2009) zegt dat je documenten gestructureerd moet schrijven." (Zonder haakjes: "Minto zegt dat je..." — klopt.)

Goed: "Documenten moeten gestructureerd zijn (Minto, 2009)." (Zonder haakjes: "Documenten moeten gestructureerd zijn." — klopt.)

#### 7.5.4 Tools ontslaan je niet van verantwoordelijkheid

Microsoft Word noemt de sectie standaard "Bibliografie" — maar dat feit maakt het nog niet correct voor jouw document. Hetzelfde geldt voor APA tools zoals die van de website Scribbr.nl of de ingebouwde bronvermelding in Word: als je de verkeerde informatie invoert, genereert de tool een nette maar foutieve referentie. Je bent zelf eindverantwoordelijk voor de correctheid, net als bij het gebruik van AI als schrijfhulp.

## Bronnen

- Brakel, V. van. (2021, 17 februari). *Tips voor het schrijven van alternatieve beschrijvingen van afbeeldingen*. Digitaal Toegankelijk. Geraadpleegd in juni 2026, van https://digitaaltoegankelijk.nl/nieuws/tips-voor-het-schrijven-van-alternatieve-beschrijvingen-van-afbeeldingen/
- Brown, S. (2022). *Software Architecture for Developers*. Leanpub. https://leanpub.com/software-architecture-for-developers
- Brown, S. (z.d.). *The C4 model for visualising software architecture*. https://c4model.com/
- Fowler, M. (2019). *Software architecture guide*. https://martinfowler.com/architecture/
- Google. (2025, 28 maart). *Technical Writing One: Active voice vs. passive voice*. https://developers.google.com/tech-writing/one/active-voice
- Google. (z.d.-a). *Technical Writing One: Lists and tables*. https://developers.google.com/tech-writing/one/lists-and-tables
- Google. (z.d.-b). *Technical Writing Two: Illustrations*. https://developers.google.com/tech-writing/two/illustrations
- IBM. (z.d.). *Passive voice*. IBM Engineering Requirements Quality Assistant documentation. Geraadpleegd op 2 oktober 2026, van https://www.ibm.com/docs/en/erqa?topic=scores-passive-voice
- ICT Research Methods. (z.d.). *Community Research*. Geraadpleegd in juni 2026, van https://ictresearchmethods.nl/library/community-research/
- Larsen, N., & Silge, J. (2018, 15 januari). *Thanks a Million, Jon Skeet!* Stack Overflow Blog. https://stackoverflow.blog/2018/01/15/thanks-million-jon-skeet/
- Martin, R. C. (2008). *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall. Hoofdstuk 1 ook beschikbaar via https://www.informit.com/articles/article.aspx?p=1235624
- Martin, R. C. (2011, 30 september). *Screaming architecture*. The Clean Code Blog. https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
- Merkus, J. (2022, 18 november). *Bijlagen*. Scribbr. https://www.scribbr.nl/apa-stijl/bijlagen/
- Microsoft. (z.d.). *Create a README for your Git repo*. Azure DevOps Documentation. Geraadpleegd in juni 2026, van https://learn.microsoft.com/en-us/azure/devops/repos/git/create-a-readme
- Minto, B. (2009). *The pyramid principle: Logic in writing and thinking* (3e ed.). Pearson Education.
- Schweppe, J., Eitel, A., & Rummer, R. (2015). The multimedia effect and its stability over time. *Learning and Instruction*, *38*, 24–33. https://doi.org/10.1016/j.learninstruc.2015.03.001
- Sung, E., & Mayer, R. E. (2012). When graphics improve liking but not learning from online lessons. *Computers in Human Behavior*, *28*(5), 1618–1625. https://doi.org/10.1016/j.chb.2012.03.026
- Swaen, B. (2013, 13 februari). *Voetnoten in een scriptie*. Scribbr. https://www.scribbr.nl/scriptie-tips/voetnoten-in-een-scriptie/
- Swaen, B. (2024, 22 augustus). *Uitzonderingen verwijzingen in de tekst volgens de APA-regels*. Scribbr. https://www.scribbr.nl/apa-stijl/uitzonderingen-verwijzingen-de-tekst-volgens-de-apa-regels/
- Theunissen, T. (2023). *Software documentation: How to capture design decisions*. HAN University of Applied Sciences. [Specifiek artikel/hoofdstuk te verifiëren — de claim betreft het vastleggen van rationale in commits en pull requests.]
- Vleeshouwers, L. (2024, 24 juni). *De lijdende of passieve vorm: wordt deze goedgekeurd of juist niet?* Scribbr. https://www.scribbr.nl/taalregels-schrijftips/de-lijdende-vorm/
- Wal, B. van der. (2025, 22 december). *Bronvermelding in ICT*. Persoonlijke blog. https://bartvanderwal.nl/bronvermelding-in-ict/
