
"""
fetch_posters.py
Get's the posters for the top 20 films per decade.
Usage: python scripts/fetch_posters.py --key YOUR_TMDB_KEY
"""

import argparse, sqlite3, time, os
from pathlib import Path

try:
    import requests
except ImportError:
    raise SystemExit("Install requests: pip install requests")

TMDB_BASE   = "https://api.themoviedb.org/3"
POSTER_BASE = "https://image.tmdb.org/t/p/w500"
DB_DEFAULT  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "processed", "imdb.db")

DECADES   = [1900,1910,1920,1930,1940,1950,1960,1970,1980,1990,2000,2010,2020]
MIN_VOTES = 500
TOP_N     = 20

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--key",   required=True, help="TMDb API key")
    p.add_argument("--db",    default=DB_DEFAULT)
    p.add_argument("--delay", type=float, default=0.25)
    p.add_argument("--reset", action="store_true", help="Also fetch posters for films that already have one")
    return p.parse_args()

def ensure_poster_column(conn):
    cols = [r[1] for r in conn.execute("PRAGMA table_info(movies)")]
    if "poster" not in cols:
        conn.execute("ALTER TABLE movies ADD COLUMN poster TEXT")
        conn.commit()
        print("Column poster added")

def get_top20_tconsts(conn):
    result = []
    for decade in DECADES:
        sql = (
            "SELECT tconst, primaryTitle, poster FROM movies "
            "WHERE decade = ? AND numVotes >= ? AND averageRating IS NOT NULL "
            "ORDER BY averageRating DESC, numVotes DESC LIMIT ?"
        )
        rows = conn.execute(sql, (decade, MIN_VOTES, TOP_N)).fetchall()
        for r in rows:
            result.append((r[0], r[1], r[2], decade))
    return result

def fetch_poster(tconst, api_key, session):
    try:
        resp = session.get(
            f"{TMDB_BASE}/find/{tconst}",
            params={"api_key": api_key, "external_source": "imdb_id"},
            timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"    Network error: {e}")
        return None

    for key in ("movie_results", "tv_results", "tv_episode_results"):
        results = data.get(key, [])
        if results and results[0].get("poster_path"):
            return POSTER_BASE + results[0]["poster_path"]
    return None

def main():
    args = parse_args()
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    ensure_poster_column(conn)

    films = get_top20_tconsts(conn)
    if not args.reset:
        films = [(t, title, poster, d) for t, title, poster, d in films if not poster]

    print(f"Films to process: {len(films)}\n")

    session = requests.Session()
    found = missing = 0

    for i, (tconst, title, _, decade) in enumerate(films, 1):
        url = fetch_poster(tconst, args.key, session)
        if url:
            conn.execute("UPDATE movies SET poster = ? WHERE tconst = ?", (url, tconst))
            found += 1
            status = "OK"
        else:
            missing += 1
            status = "--"

        if i % 20 == 0:
            conn.commit()

        print(f"  [{i:>3}/{len(films)}] {status}  {decade}s  {tconst}  {title[:45]}")
        time.sleep(args.delay)

    conn.commit()
    conn.close()
    print(f"\nFatto — trovati: {found}, non trovati: {missing}")

if __name__ == "__main__":
    main()