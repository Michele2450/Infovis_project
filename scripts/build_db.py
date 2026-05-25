import argparse, csv, sqlite3, sys
from pathlib import Path

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", default="data/raw/imdb_english.csv")
    p.add_argument("--db",  default="data/processed/imdb.db")
    return p.parse_args()

DDL = """
CREATE TABLE IF NOT EXISTS movies (
    tconst        TEXT PRIMARY KEY,
    titleType     TEXT,
    primaryTitle  TEXT NOT NULL,
    localTitle    TEXT,
    startYear     INTEGER,
    decade        INTEGER,
    region        TEXT,
    language      TEXT,
    averageRating REAL,
    numVotes      INTEGER,
    runtime       INTEGER,
    genres        TEXT,
    director      TEXT
);
CREATE INDEX IF NOT EXISTS idx_decade       ON movies (decade);
CREATE INDEX IF NOT EXISTS idx_decade_votes ON movies (decade, numVotes DESC);
"""

INSERT_SQL = """
INSERT OR REPLACE INTO movies
  (tconst, titleType, primaryTitle, localTitle, startYear, decade,
   region, language, averageRating, numVotes, runtime, genres, director)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

BATCH = 10_000

def safe_int(v):
    try: return int(v)
    except: return None

def safe_float(v):
    try: return float(v)
    except: return None

def clean(v):
    v = (v or "").strip()
    return None if v in ("", "\\N") else v

def import_csv(conn, csv_path):
    path = Path(csv_path)
    if not path.exists():
        sys.exit(f"ERRORE: CSV non trovato in '{csv_path}'")

    total, batch = 0, []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            year   = safe_int(row.get("startYear") or row.get("year"))
            decade = (year // 10) * 10 if year else None

            # Genres: can come with quotes like "Drama,Crime"
            genres_raw = (row.get("genres") or "").strip().strip('"')
            genres = None if genres_raw in ("", "\\N") else genres_raw

            batch.append((
                (row.get("tconst") or "").strip(),
                clean(row.get("titleType")),
                (row.get("primaryTitle") or row.get("title", "")).strip(),
                clean(row.get("title")),
                year,
                decade,
                clean(row.get("region")),
                clean(row.get("language")),
                safe_float(row.get("averageRating") or row.get("rating")),
                safe_int(row.get("numVotes") or row.get("votes")),
                safe_int(row.get("runtimeMinutes") or row.get("runtime")),
                genres,
                clean(row.get("directorName") or row.get("director")),
            ))

            if len(batch) >= BATCH:
                conn.executemany(INSERT_SQL, batch)
                conn.commit()
                total += len(batch)
                batch.clear()
                print(f"  … {total:,} righe inserite", end="\r", flush=True)

    if batch:
        conn.executemany(INSERT_SQL, batch)
        conn.commit()
        total += len(batch)

    print(f"\n✓ Import completato — {total:,} righe totali")

def report(conn):
    print("\nRiepilogo per decade:")
    print(f"  {'Decade':<10}  {'Film':>8}  {'Avg rating':>10}  {'Con runtime':>11}  {'Con genres':>10}  {'Con director':>12}")
    print("  " + "-" * 68)
    for r in conn.execute("""
        SELECT decade, COUNT(*) AS cnt,
               ROUND(AVG(averageRating),2),
               SUM(CASE WHEN runtime  IS NOT NULL THEN 1 ELSE 0 END),
               SUM(CASE WHEN genres   IS NOT NULL THEN 1 ELSE 0 END),
               SUM(CASE WHEN director IS NOT NULL THEN 1 ELSE 0 END)
        FROM movies
        WHERE decade IS NOT NULL AND averageRating IS NOT NULL AND numVotes >= 500
        GROUP BY decade ORDER BY decade
    """):
        print(f"  {r[0]}s{'':<7}  {r[1]:>8,}  {r[2]:>10}  {r[3]:>11,}  {r[4]:>10,}  {r[5]:>12,}")

def main():
    args = parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
        print("→ DB precedente eliminato")
    print(f"→ CSV sorgente : {args.csv}")
    print(f"→ DB target    : {args.db}\n")

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.executescript(DDL)
    conn.commit()

    import_csv(conn, args.csv)
    report(conn)
    conn.close()
    print(f"\n✓ Database scritto in {args.db}")

if __name__ == "__main__":
    main()