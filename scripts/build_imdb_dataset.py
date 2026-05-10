#!/usr/bin/env python3
"""
Build processed IMDb movie datasets for the cinema project.

Expected input files in data/raw/:
  - title.basics.tsv.gz
  - title.ratings.tsv.gz
  - title.crew.tsv.gz
  - name.basics.tsv.gz
Optional:
  - title.akas.tsv.gz

Outputs in data/processed/:
  - movies.csv
  - movie_directors.csv
  - movie_writers.csv
  - movie_titles_by_region.csv   (only if title.akas exists)
  - decade_top_movies.json

Website output in js/data/:
  - all_decades.js
"""

from pathlib import Path
import csv
import gzip
import json


PROJECT_ROOT = Path(__file__).resolve().parents[1] #to get the root of the project
#build folder paths relative to the project root to have acces to the data and js folders in an easier way
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
JS_DATA_DIR = PROJECT_ROOT / "js" / "data"

#raw files our script will use to build the processed datasets
REQUIRED_FILES = [
    "title.basics.tsv.gz",
    "title.ratings.tsv.gz",
    "title.crew.tsv.gz",
    "name.basics.tsv.gz",
    "title.akas.tsv.gz",  
]

#create the output folder if it doesn't exist
for folder in [PROCESSED_DIR, JS_DATA_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

#checks all required files exist in the raw data folder
for filename in REQUIRED_FILES:
    path = RAW_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

print("Folders and raw files are ready.")

#to open the compressed files without using the gzip function everytime
def open_tsv_gz(path):
    return gzip.open(path, "rt", encoding="utf-8", newline="")

#convert missing values into python None and keep the rest as they are
def clean_value(value):
    if value in (None, "", "\\N"):
        return None
    return value

#separate by commas if there is more than one value in a column
def split_list(value):
    value = clean_value(value)
    if not value:
        return []
    return value.split(",")


movies = {} #create an empty dicitionary, dictionary to quickly find by tconst later

with open_tsv_gz(RAW_DIR / "title.basics.tsv.gz") as f: #open title.basics file
    reader = csv.DictReader(f, delimiter="\t") #to read each row as a dictionary \t as delimiter since it is a tsv file
    for row in reader:
        if row["titleType"] != "movie": #keep only movies
            continue
        if row["isAdult"] != "0": #remove adult movies
            continue

        #store the relevant information for each movie in the movies dictionary, using tconst as the key
        movies[row["tconst"]] = {
            "tconst": row["tconst"],
            "title": clean_value(row["primaryTitle"]),
            "originalTitle": clean_value(row["originalTitle"]),
            "year": clean_value(row["startYear"]),
            "runtime": clean_value(row["runtimeMinutes"]),
            "genres": split_list(row["genres"]),
            "rating": None,
            "votes": None,
            "directors": [],
            "writers": [],
        }

print(f"Loaded {len(movies)} movies from title.basics")

with open_tsv_gz(RAW_DIR / "title.ratings.tsv.gz") as f: #open the title.ratings file
    reader = csv.DictReader(f, delimiter="\t")
    for row in reader:
        tconst = row["tconst"] #grab the key of the movie to find it in the dictionary and be able to merge the datasets
        if tconst not in movies: #only add for the movies we already have in the movies dictionary, if not, we skip it
            continue
        movies[tconst]["rating"] = clean_value(row["averageRating"])
        movies[tconst]["votes"] = clean_value(row["numVotes"])

print("Merged ratings.")

person_ids = set() #create an empty set to store the unique person ids for directors and writers, set because many movies may share director/writer

with open_tsv_gz(RAW_DIR / "title.crew.tsv.gz") as f: #open the title.crew file
    reader = csv.DictReader(f, delimiter="\t")
    for row in reader:
        tconst = row["tconst"] #grab the key of the movie to find it in the dictionary and be able to merge the datasets
        if tconst not in movies:
            continue

        #might contain more than one director/writer so we split them and store them in a list
        directors = split_list(row["directors"])
        writers = split_list(row["writers"])

        movies[tconst]["directors"] = directors
        movies[tconst]["writers"] = writers

        #add director and writer id to the person_ids set
        person_ids.update(directors)
        person_ids.update(writers)

print("Merged crew.")
print(f"Need names for {len(person_ids)} people.")

names = {} #create an empty dictionary

with open_tsv_gz(RAW_DIR / "name.basics.tsv.gz") as f: #open the name.basics file
    reader = csv.DictReader(f, delimiter="\t")
    for row in reader:
        nconst = row["nconst"] #grab the key of the person to find it in the set of person_ids
        if nconst not in person_ids:
            continue
        names[nconst] = clean_value(row["primaryName"]) #for filtering names of directors and writers

print(f"Loaded {len(names)} names.")

clean_movies = [] #now a list becuase we only wanted the dictionary to merge the datasets

for movie in movies.values():
    director_names = [names[n] for n in movie["directors"] if n in names]
    writer_names = [names[n] for n in movie["writers"] if n in names]

    year = int(movie["year"]) if movie["year"] else None
    runtime = int(movie["runtime"]) if movie["runtime"] else None
    rating = float(movie["rating"]) if movie["rating"] else None
    votes = int(movie["votes"]) if movie["votes"] else None
    decade = f"{(year // 10) * 10}s" if year else None

    clean_movies.append({
        "tconst": movie["tconst"],
        "title": movie["title"],
        "originalTitle": movie["originalTitle"],
        "year": year,
        "decade": decade,
        "runtime": runtime,
        "genres": movie["genres"],
        "rating": rating,
        "votes": votes,
        "directors": director_names,
        "writers": writer_names,
    })

print(f"Built clean dataset with {len(clean_movies)} movies.")


with open(PROCESSED_DIR / "movies.csv", "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=[
            "tconst", "title", "originalTitle", "year", "decade",
            "runtime", "genres", "rating", "votes", "directors", "writers"
        ]
    )
    writer.writeheader()

    for movie in clean_movies:
        row = movie.copy()
        row["genres"] = ",".join(row["genres"])
        row["directors"] = ",".join(row["directors"])
        row["writers"] = ",".join(row["writers"])
        writer.writerow(row)

print("Saved movies.csv")

from collections import defaultdict

movies_by_decade = defaultdict(list)

for movie in clean_movies:
    if movie["decade"] and movie["rating"] is not None and movie["votes"] is not None:
        movies_by_decade[movie["decade"]].append(movie)

decade_data = {}

for decade, items in movies_by_decade.items():
    ranked = sorted(
        items,
        key=lambda m: (m["rating"], m["votes"] or 0),
        reverse=True
    )[:20]

    decade_data[decade] = ranked

print("Built decade groups.")

with open(PROCESSED_DIR / "decade_top_movies.json", "w", encoding="utf-8") as f:
    json.dump(decade_data, f, ensure_ascii=False, indent=2)

print("Saved decade_top_movies.json")

