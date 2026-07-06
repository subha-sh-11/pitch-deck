"""Push your LOCAL data up to the CLOUD (Neon Postgres + Filebase storage).

Usage (from the repo root):
    python scripts/push_to_cloud.py            # sync DB + assets (asks to confirm the DB replace)
    python scripts/push_to_cloud.py --yes      # no prompt
    python scripts/push_to_cloud.py assets     # only upload new images
    python scripts/push_to_cloud.py db --yes   # only replace the cloud DB

Credentials are read from scripts/cloud.env (gitignored).

IMPORTANT — the DB sync is ONE-WAY and REPLACES the cloud DB with your local one
(truncate + copy). Only run it if the cloud is meant to mirror local. The ASSET sync is
additive/resumable (it only uploads files that aren't in the bucket yet).
"""
from __future__ import annotations

import io
import mimetypes
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ASSETS_DIR = os.path.join(REPO, "backend", "_assets")

# Tables to copy, and the FK parents-first order used when loading into the cloud.
TABLE_ORDER = ["users", "projects", "decks", "assets", "slides", "generation_jobs"]


def load_env() -> dict:
    path = os.path.join(HERE, "cloud.env")
    if not os.path.exists(path):
        sys.exit(f"Missing {path} — create it with your cloud credentials.")
    env = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def sync_db(env: dict, assume_yes: bool) -> None:
    import psycopg2

    local = dict(
        host=env["LOCAL_DB_HOST"], port=int(env["LOCAL_DB_PORT"]),
        user=env["LOCAL_DB_USER"], password=env["LOCAL_DB_PASSWORD"], dbname=env["LOCAL_DB_NAME"],
    )
    s = psycopg2.connect(**local)
    d = psycopg2.connect(env["CLOUD_DATABASE_URL"])
    sc, dc = s.cursor(), d.cursor()

    # Refuse to run if the schema versions differ (would corrupt data).
    sc.execute("select version_num from alembic_version")
    dc.execute("select version_num from alembic_version")
    lv, nv = sc.fetchone(), dc.fetchone()
    if lv != nv:
        sys.exit(f"Schema mismatch: local={lv} cloud={nv}. Run migrations so they match, then retry.")

    if not assume_yes:
        ans = input("This REPLACES the cloud DB with your local data. Type 'yes' to continue: ")
        if ans.strip().lower() != "yes":
            print("Skipped DB sync.")
            s.close(); d.close()
            return

    def cols(cur, t):
        cur.execute(
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name=%s order by ordinal_position", (t,))
        return [r[0] for r in cur.fetchall()]

    common = {t: [c for c in cols(sc, t) if c in set(cols(dc, t))] for t in TABLE_ORDER}
    dc.execute("truncate " + ", ".join(f'"{t}"' for t in TABLE_ORDER) + " cascade")
    for t in TABLE_ORDER:  # parents first — cloud blocks disabling FK triggers
        cl = ", ".join(f'"{c}"' for c in common[t])
        buf = io.StringIO()
        sc.copy_expert(f'COPY "{t}" ({cl}) TO STDOUT (FORMAT csv)', buf)
        buf.seek(0)
        dc.copy_expert(f'COPY "{t}" ({cl}) FROM STDIN (FORMAT csv)', buf)
        print(f"  db: {t} <- {len(common[t])} cols")

    # keep serial sequences ahead of the copied ids
    sc.execute(
        "select table_name, column_name, pg_get_serial_sequence(table_name, column_name) "
        "from information_schema.columns where table_schema='public' and column_default like 'nextval%'")
    for tab, col, seq in sc.fetchall():
        if seq:
            dc.execute(f'select setval(%s, coalesce((select max("{col}") from "{tab}"),1))', (seq,))
    d.commit()
    for t in TABLE_ORDER:
        dc.execute(f'select count(*) from "{t}"')
        print(f"  cloud {t}: {dc.fetchone()[0]}")
    s.close(); d.close()
    print("DB sync done.")


def sync_assets(env: dict) -> None:
    import boto3
    from botocore.client import Config

    s3 = boto3.client(
        "s3", endpoint_url=env["CLOUD_S3_ENDPOINT"],
        aws_access_key_id=env["CLOUD_S3_KEY"], aws_secret_access_key=env["CLOUD_S3_SECRET"],
        region_name=env.get("CLOUD_S3_REGION", "us-east-1"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    bucket = env["CLOUD_S3_BUCKET"]
    if not os.path.isdir(ASSETS_DIR):
        print(f"  assets: no {ASSETS_DIR} directory — skipping.")
        return

    existing, tok = set(), None
    while True:
        kw = dict(Bucket=bucket, MaxKeys=1000)
        if tok:
            kw["ContinuationToken"] = tok
        r = s3.list_objects_v2(**kw)
        for o in r.get("Contents", []):
            existing.add(o["Key"])
        if r.get("IsTruncated"):
            tok = r["NextContinuationToken"]
        else:
            break

    files = [os.path.join(rt, f) for rt, _, fs in os.walk(ASSETS_DIR) for f in fs]
    todo = [p for p in files if os.path.relpath(p, ASSETS_DIR).replace(os.sep, "/") not in existing]
    print(f"  assets: total={len(files)} already={len(existing)} to_upload={len(todo)}")
    up = err = 0
    for i, path in enumerate(todo, 1):
        key = os.path.relpath(path, ASSETS_DIR).replace(os.sep, "/")
        ctype = mimetypes.guess_type(key)[0] or "application/octet-stream"
        try:
            with open(path, "rb") as fh:
                s3.put_object(Bucket=bucket, Key=key, Body=fh.read(), ContentType=ctype)
            up += 1
        except Exception as e:  # noqa: BLE001
            err += 1
            if err <= 5:
                print("    ERR", key, repr(e)[:120])
        if i % 100 == 0:
            print(f"    {i}/{len(todo)} ok={up} err={err}")
    print(f"  assets: uploaded={up} errors={err}")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    assume_yes = "--yes" in sys.argv or "-y" in sys.argv
    what = args[0] if args else "all"
    env = load_env()
    if what in ("all", "db"):
        sync_db(env, assume_yes)
    if what in ("all", "assets"):
        sync_assets(env)
    print("All done.")


if __name__ == "__main__":
    main()
