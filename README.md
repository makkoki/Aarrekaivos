# Aarrekaivos

Aarrekaivos on Vite + TypeScript + Phaser -pohjainen 2D-selainpeli. Se on lapsille ja nuorille sopiva, BoulderDash-henkinen luolaseikkailu omilla hahmoilla, kentällä ja väliaikaisilla grafiikoilla.

## MVP-ominaisuudet

- Ruutupohjainen luolakenttä.
- Pelaaja liikkuu nuolinäppäimillä tai WASD-näppäimillä.
- Pelaaja voi kaivaa ruskeaa maata pois kulkemalla sen läpi.
- Kristallit antavat pisteitä ja avaavat uloskäynnin, kun tavoitemäärä täyttyy.
- Kivet putoavat alas, jos niiden alla on tyhjää.
- Hassu kaivosmörrikkä liikkuu ruudukossa ja yrittää tavoittaa pelaajan.
- Törmäys viholliseen tai putoavaan kiveen päättää yrityksen.
- Avoimesta uloskäynnistä tulee voittonäkymä.
- Kaikki MVP-grafiikat luodaan Phaserilla ilman ulkopuolisia kuvatiedostoja.

## Kehitysympäristö

Asenna riippuvuudet:

```bash
npm install
```

Käynnistä kehityspalvelin:

```bash
npm run dev
```

Avaa selaimessa Viten ilmoittama osoite, tavallisesti `http://localhost:5173`.

## Tuotantobuild

```bash
npm run build
```

Valmis staattinen build syntyy `dist/`-kansioon.


## GitHub Pages -julkaisu

Peli pitää julkaista Viten tuotantobuildista eli `dist/`-kansiosta. Repositoryn juureen jätetty `index.html` viittaa kehitysaikaiseen `/src/main.ts`-tiedostoon, joten se ei yksinään riitä GitHub Pagesissa.

Tähän projektiin on lisätty GitHub Actions -workflow `.github/workflows/deploy-pages.yml`, joka asentaa riippuvuudet, ajaa `npm run build` -komennon ja julkaisee syntyvän `dist/`-kansion GitHub Pagesiin. Varmista GitHubissa, että repositoryn **Settings → Pages → Source** on **GitHub Actions**.

## Ohjaus

- Liiku: nuolinäppäimet tai WASD
- Aloita kenttä uudelleen: R
- Voiton tai häviön jälkeen uusi yritys: välilyönti tai R

## Jatkokehitysideoita

- Lisää useita kenttiä, joiden vaikeustaso kasvaa asteittain.
- Lisää mobiiliohjaimet kosketusnäytölle.
- Lisää omat sprite-grafiikat ja lempeät äänet.
- Lisää paikallinen paras pistemäärä `localStorage`-tallennuksella.
