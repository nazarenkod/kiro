#!/usr/bin/env python3
"""mr_stats.py — детермінований підрахунок статистики MR для gen-test.

Цифри для MR рахує СКРИПТ, не модель (DESIGN.md крок 10): інакше вони
попливуть від сесії до сесії. mr-composer лише розкладає цей JSON по шаблону.

Парсить `git diff --name-status origin/<base>...HEAD -- src/test/kotlin/tests`
і повертає JSON:
    {
      "added_tests":   {"count": N, "tm_ids": [...]},
      "changed_tests": {"count": M, "tm_ids": [...]},
      "files_added": N, "files_changed": M,
      "stubs_added": ["...json"]
    }

Використання:
    python3 mr_stats.py --base main
    python3 mr_stats.py --base develop --range "origin/develop...HEAD"
"""
import argparse
import json
import re
import subprocess
import sys

TMID_RE = re.compile(r"@TMId\s*\(\s*(\d+)\s*\)")
TESTS_PREFIX = "src/test/kotlin/tests/"


def git(args):
    return subprocess.run(
        ["git"] + args, capture_output=True, text=True, check=False
    )


def extract_tm_ids(path):
    """TMId з поточної робочої версії файлу (для A і M — актуальний стан)."""
    try:
        with open(path, encoding="utf-8") as fh:
            content = fh.read()
    except OSError:
        return []
    return [int(m) for m in TMID_RE.findall(content)]


def main():
    ap = argparse.ArgumentParser(description="gen-test MR stats from git diff")
    ap.add_argument("--base", default="main", help="базова гілка (default: main)")
    ap.add_argument("--range", dest="rng",
                    help="явний git-діапазон (перекриває --base), напр. origin/main...HEAD")
    ap.add_argument("--path", default=TESTS_PREFIX,
                    help=f"обмеження шляху (default: {TESTS_PREFIX})")
    args = ap.parse_args()

    rng = args.rng or f"origin/{args.base}...HEAD"

    res = git(["diff", "--name-status", rng, "--", args.path])
    if res.returncode != 0:
        print(f"mr_stats: git diff помилка: {res.stderr.strip()}", file=sys.stderr)
        return 1

    added_tests_ids = []
    changed_tests_ids = []
    files_added = 0
    files_changed = 0
    stubs_added = []

    for line in res.stdout.splitlines():
        line = line.rstrip()
        if not line:
            continue
        parts = line.split("\t")
        status = parts[0][0]  # A, M, D, R (беремо першу літеру)
        # для R (rename) шлях призначення — останній елемент
        path = parts[-1]

        is_kt = path.endswith(".kt")
        is_json = path.endswith(".json")

        if is_kt:
            if status == "A":
                files_added += 1
                added_tests_ids.extend(extract_tm_ids(path))
            elif status in ("M", "R"):
                files_changed += 1
                changed_tests_ids.extend(extract_tm_ids(path))
        elif is_json and status in ("A", "R"):
            stubs_added.append(path)

    # унікалізувати, зберегти порядок появи
    def uniq(seq):
        seen = set()
        out = []
        for x in seq:
            if x not in seen:
                seen.add(x)
                out.append(x)
        return out

    added_tests_ids = uniq(added_tests_ids)
    changed_tests_ids = uniq(changed_tests_ids)

    out = {
        "range": rng,
        "added_tests": {"count": len(added_tests_ids), "tm_ids": added_tests_ids},
        "changed_tests": {"count": len(changed_tests_ids), "tm_ids": changed_tests_ids},
        "files_added": files_added,
        "files_changed": files_changed,
        "stubs_added": stubs_added,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
