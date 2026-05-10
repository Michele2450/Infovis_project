#!/usr/bin/env python3
"""
build_db.py
-----------
Converte imdb_english.csv + title.basics.tsv.gz in un database SQLite.

Il CSV imdb_english.csv contiene già runtimeMinutes.
title.basics.tsv.gz viene usato solo per la colonna genres.

Usage:
  python scripts/build_db.py
"""

import argparse
import csv
import gzip
import sqlite3
import sys
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--csv",    default="data/raw/imdb_english.csv")
    p.add_argument("--basics", default="data/raw/title.basics.tsv.gz")
    p.add_argument("--db",     default="data/processed/imdb.db")
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
    genres        TEXT
);
CREATE INDEX IF NOT EXISTS idx_decade       ON movies (decade);
CREATE INDEX IF NOT EXISTS idx_decade_votes ON movies (decade, numVotes DESC);
"""

INSERT_SQL = """
INSERT OR REPLACE INTO movies
  (tconst, titleType, primaryTitle, localTitle, startYear, decade,
   region, language, averageRating, numVotes, runtime, genres)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

BATCH = 10_000


def safe_int(v):
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def safe_float(v):
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def load_genres(basics_path):
    """Returns dict tconst -> genres_string (e.g. 'Drama,Crime')"""
    path = Path(basics_path)
    if not path.exists():
        print(f"  ⚠ title.basics.tsv.gz non trovato in '{basics_path}' — genres sarà null")
        return {}

    print(f"→ Caricamento genres da {basics_path} …")
    data = {}
    opener = gzip.open if str(basics_path).endswith(".gz") else open

    with opener(path, "rt", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            tconst = (row.get("tconst") or "").strip()
            genres = (row.get("genres") or "").strip()
            if genres in ("\\N", ""):
                genres = None
            if tconst:
                data[tconst] = genres

    print(f"  ✓ {len(data):,} entries caricati")
    return data


def import_csv(conn, csv_path, genres_map):
    path = Path(csv_path)
    if not path.exists():
        sys.exit(f"ERRORE: CSV non trovato in '{csv_path}'")

    total = 0
    batch = []

    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)

        for row in reader:
            tconst  = (row.get("tconst") or "").strip()
            year    = safe_int(row.get("startYear") or row.get("year"))
            decade  = (year // 10) * 10 if year else None
            runtime = safe_int(row.get("runtimeMinutes") or row.get("runtime"))
            genres  = genres_map.get(tconst)

            batch.append((
                tconst,
                (row.get("titleType") or "").strip() or None,
                (row.get("primaryTitle") or row.get("title", "")).strip(),
                (row.get("title") or "").strip() or None,
                year,
                decade,
                (row.get("region") or "").strip() or None,
                (row.get("language") or "").strip() or None,
                safe_float(row.get("averageRating") or row.get("rating")),
                safe_int(row.get("numVotes") or row.get("votes")),
                runtime,
                genres,
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
    print(f"  {'Decade':<10}  {'Film':>8}  {'Avg rating':>10}  {'Con runtime':>11}  {'Con genres':>10}")
    print("  " + "-" * 56)
    cur = conn.execute("""
        SELECT decade,
               COUNT(*)                                              AS cnt,
               ROUND(AVG(averageRating), 2)                         AS avg_r,
               SUM(CASE WHEN runtime IS NOT NULL THEN 1 ELSE 0 END) AS has_rt,
               SUM(CASE WHEN genres  IS NOT NULL THEN 1 ELSE 0 END) AS has_g
        FROM   movies
        WHERE  decade IS NOT NULL AND averageRating IS NOT NULL AND numVotes >= 500
        GROUP  BY decade ORDER BY decade
    """)
    for r in cur:
        print(f"  {r[0]}s{'':<7}  {r[1]:>8,}  {r[2]:>10}  {r[3]:>11,}  {r[4]:>10,}")


def main():
    args = parse_args()

    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Elimina il DB vecchio per ripartire da zero
    if db_path.exists():
        db_path.unlink()
        print(f"→ DB precedente eliminato")

    print(f"→ CSV sorgente : {args.csv}")
    print(f"→ Title basics : {args.basics}")
    print(f"→ DB target    : {args.db}")
    print()

    genres_map = load_genres(args.basics)

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.executescript(DDL)
    conn.commit()

    import_csv(conn, args.csv, genres_map)
    report(conn)
    conn.close()

    print(f"\n✓ Database scritto in {args.db}")


if __name__ == "__main__":
    main()