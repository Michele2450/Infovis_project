"""api.py — Cinema through the Decades · Flask back-end"""

import sqlite3, os
from flask import Flask, jsonify, abort
from flask_cors import CORS

DB_PATH = os.environ.get(
    "IMDB_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "processed", "imdb.db")
)

TOP_N     = 20
MIN_VOTES = 500

app = Flask(__name__)
CORS(app)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def decade_int(decade_str):
    try: return int(decade_str.replace("s", ""))
    except: abort(404, description=f"Invalid decade '{decade_str}'")

def build_film(row, rank):
    genres_raw = row["genres"] or ""
    genres = [g.strip() for g in genres_raw.split(",") if g.strip()] if genres_raw else []
    return {
        "rank":     rank,
        "tconst":   row["tconst"],
        "title":    row["localTitle"] or row["primaryTitle"],
        "year":     row["startYear"],
        "rating":   row["averageRating"],
        "votes":    row["numVotes"],
        "runtime":  row["runtime"],
        "genres":   genres,
        "director": row["director"],
        "actor":    None,
        "summary":  None,
        "poster":   row["poster"] if row["poster"] else None,
    }

def build_decade_response(decade_str):
    decade = decade_int(decade_str)
    conn   = get_db()

    films_rows = conn.execute(
        "SELECT tconst, primaryTitle, localTitle, startYear, averageRating, numVotes, runtime, genres, director, poster "
        "FROM movies "
        "WHERE decade = ? AND numVotes >= ? AND averageRating IS NOT NULL "
        "ORDER BY averageRating DESC, numVotes DESC LIMIT ?",
        (decade, MIN_VOTES, TOP_N)
    ).fetchall()

    films = [build_film(r, i + 1) for i, r in enumerate(films_rows)]

    stats = conn.execute(
        "SELECT ROUND(AVG(averageRating),2) AS avg_rating, "
        "ROUND(AVG(numVotes)) AS avg_votes, "
        "ROUND(AVG(runtime)) AS avg_runtime, "
        "MIN(averageRating) AS min_rating, "
        "COUNT(*) AS total_films "
        "FROM movies "
        "WHERE decade = ? AND numVotes >= ? AND averageRating IS NOT NULL",
        (decade, MIN_VOTES)
    ).fetchone()

    # genreStats: every genre with its percentage among the top films of the decade
    genre_counts = {}
    for f in films:
        for g in f["genres"]:
            genre_counts[g] = genre_counts.get(g, 0) + 1

    total = len(films) or 1
    top_genres = [
        {"genre": g, "decadePct": round(genre_counts[g] / total * 100)}
        for g in sorted(genre_counts, key=lambda g: genre_counts[g], reverse=True)
    ]

    conn.close()
    return {
        "decade":     decade_str,
        "avgRating":  stats["avg_rating"],
        "avgVotes":   int(stats["avg_votes"] or 0),
        "avgRuntime": int(stats["avg_runtime"] or 0),
        "minRating":  stats["min_rating"],
        "totalFilms": stats["total_films"],
        "topGenres":  top_genres,
        "films":      films,
    }

@app.route("/api/decade/<string:decade>")
def api_decade(decade):
    return jsonify(build_decade_response(decade))

@app.route("/api/decade/<string:decade>/film/<string:tconst>")
def api_film(decade, tconst):
    decade_int(decade)
    conn = get_db()
    row = conn.execute(
        "SELECT tconst, primaryTitle, localTitle, startYear, averageRating, numVotes, runtime, genres, director, poster "
        "FROM movies WHERE tconst = ?", (tconst,)
    ).fetchone()
    conn.close()
    if not row: abort(404, description=f"Film '{tconst}' not found")
    return jsonify(build_film(row, rank=0))

@app.route("/api/decades")
def api_decades():
    conn = get_db()
    rows = conn.execute(
        "SELECT decade, COUNT(*) AS total, ROUND(AVG(averageRating),2) AS avg_rating "
        "FROM movies WHERE decade IS NOT NULL AND numVotes >= ? AND averageRating IS NOT NULL "
        "GROUP BY decade ORDER BY decade", (MIN_VOTES,)
    ).fetchall()
    conn.close()
    return jsonify([{"decade": f"{r['decade']}s", "total": r["total"], "avgRating": r["avg_rating"]} for r in rows])

@app.errorhandler(404)
def not_found(e): return jsonify({"error": str(e)}), 404

@app.errorhandler(500)
def server_error(e): return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    print(f"Starting dev server on http://localhost:{port}")
    print(f"Using DB: {DB_PATH}")
    app.run(debug=True, port=port)