# Integrazione IMDb reale — Guida passo-passo

## Struttura finale

```
C:.
├── api.py                         ← nuovo — server Flask
├── scripts/
│   └── build_db.py                ← nuovo — costruisce il DB
├── data/
│   ├── raw/
│   │   └── imdb_english.csv       ← il tuo file
│   └── processed/
│       └── imdb.db                ← generato da build_db.py
└── js/
    └── data/
        └── all_decades.js         ← sostituito con la versione live
```

---

## Step 1 — Installa le dipendenze Python

```bash
pip install flask flask-cors
```

---

## Step 2 — Costruisci il database SQLite

```bash
python scripts/build_db.py \
  --csv data/raw/imdb_english.csv \
  --db  data/processed/imdb.db
```

Lo script:
- Legge ogni riga del CSV
- Calcola la colonna `decade`  (es. 1994 → 1990)
- Crea indici su `(decade)` e `(decade, numVotes DESC)` per query istantanee
- Stampa un riepilogo per decade a fine importazione

> **Nota:** Se il tuo CSV ha colonne `runtime`, `genres`, `director`, `actor`, `summary`
> già popolate, vengono importate direttamente.  
> Se mancano, le query restituiranno `null` per quei campi — il frontend li gestisce già.

---

## Step 3 — Avvia il server Flask

```bash
python api.py
```

Il server parte su `http://localhost:5000`.  
Prova subito nel browser: `http://localhost:5000/api/decade/1990s`

---

## Step 4 — Sostituisci `js/data/all_decades.js`

Copia il file `js/data/all_decades.js` fornito in questo pacchetto,
sovrascrivendo quello esistente con i dati fake.

Il nuovo file espone le stesse variabili (`DECADE_DB`) + una funzione async:

```js
const data = await getDecadeData('1990s');
// → { avgRating, avgVotes, avgRuntime, topGenres, films: [...] }
```

---

## Step 5 — Aggiorna `decade.js` e `index.js`

Ogni punto del codice che legge `DECADE_DB['1990s']` in modo sincrono
va convertito in async.  Il pattern è sempre lo stesso:

### Prima (dati fake, sincrono)
```js
function loadDecade(decade) {
  const data = DECADE_DB[decade];   // lettura sincrona
  renderFilmList(data.films);
  renderStats(data);
}
```

### Dopo (API live, asincrono)
```js
async function loadDecade(decade) {
  const data = await getDecadeData(decade);   // fetch con cache
  renderFilmList(data.films);
  renderStats(data);
}
```

E il chiamante diventa:
```js
// se era: loadDecade('1990s');
// diventa:
loadDecade('1990s').catch(err => console.error('Errore caricamento decade:', err));
```

### Pre-fetch al mouseover (opzionale ma consigliato)
Nel tuo `index.js`, dove gestisci l'hover sulle decade tile:
```js
decadeItem.addEventListener('mouseenter', () => {
  prefetchDecade(decadeItem.dataset.decade);  // scalda la cache in anticipo
});
```

---

## Endpoint disponibili

| Metodo | URL | Descrizione |
|--------|-----|-------------|
| `GET` | `/api/decades` | Lista tutte le decadi con statistiche base |
| `GET` | `/api/decade/1990s` | Dati completi della decade (top 20 film) |
| `GET` | `/api/decade/1990s/film/tt0111161` | Dettaglio singolo film |

---

## Formato risposta `/api/decade/1990s`

```json
{
  "decade":     "1990s",
  "avgRating":  7.85,
  "avgVotes":   412000,
  "avgRuntime": 117,
  "minRating":  7.2,
  "totalFilms": 284,
  "topGenres": [
    { "genre": "Drama",  "decadePct": 75 },
    { "genre": "Crime",  "decadePct": 40 }
  ],
  "films": [
    {
      "rank":    1,
      "tconst":  "tt0111161",
      "title":   "The Shawshank Redemption",
      "year":    1994,
      "rating":  9.3,
      "votes":   2800000,
      "runtime": 142,
      "genres":  ["Drama"],
      "director": null,
      "actor":   null,
      "summary": null,
      "poster":  null
    }
  ]
}
```

> I campi `director`, `actor`, `summary` dipendono da cosa contiene il tuo CSV.
> Se non ci sono, il frontend mostra semplicemente quei campi vuoti — nessuna modifica necessaria.

---

## Note su CORS e deployment

- In sviluppo le pagine HTML vengono aperte direttamente come file (`file://`),
  quindi Flask deve rispondere con le intestazioni CORS.  `flask-cors` lo gestisce già.
- In produzione servi sia le pagine che l'API dallo stesso dominio (es. con nginx)
  e puoi togliere la dipendenza da `flask-cors`.

---

## Se vuoi arricchire i dati con `director` / `summary`

Il tuo dataset IMDb raw contiene `title.crew.tsv.gz` (registi) e
`title.basics.tsv.gz` (generi e runtime).  Puoi estendere `build_db.py`
per fare un join sui file .tsv e popolare quelle colonne nel DB.
Fammelo sapere e lo aggiungo.
