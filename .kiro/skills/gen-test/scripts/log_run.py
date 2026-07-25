#!/usr/bin/env python3
"""log_run.py — запис одного рядка прогону пайплайна у runs.jsonl.

Робить те, що модель робити не повинна (інакше схема попливе від сесії до
сесії, DESIGN.md 6.1):
  1) валідує схему рядка;
  2) дочитує target/gen-test/phases-<checkId>.jsonl і рахує device-корзину
     (device_seconds, device_runs, phase_breakdown);
  3) рахує agent_seconds = total − device − human;
  4) ставить таймстемпи за потреби й аппендить рядок у metrics/runs.jsonl.

Вхід — JSON із полями, які знає лише оркестратор (агентські/людські метрики):
    python3 log_run.py --in run.json
    echo '{...}' | python3 log_run.py

Обовʼязкові поля у вхідному JSON:
    check_id, functional_id, ts_start, ts_end, outcome,
    negative_control, platforms_green
Решта (compile_fix_iterations, debug_iterations, flaky_retries,
failure_classes, scroll_fix, appium_fallback_used, code_edited_by_human,
plan_edited_by_user, checkpoint, gaps_from_fetcher, human_seconds) — опційні,
дефолти нижче. device_* і phase_breakdown РАХУЮТЬСЯ тут, вхідні значення
ігноруються.
"""
import sys
import os
import json
import argparse
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
RUNS_FILE = os.path.join(SKILL_DIR, "metrics", "runs.jsonl")

REQUIRED = ["check_id", "functional_id", "ts_start", "ts_end",
            "outcome", "negative_control", "platforms_green"]

OUTCOMES = {"green", "escalated", "abandoned"}
NEG = {"pass", "fail", "n/a"}

DEFAULTS = {
    "gaps_from_fetcher": 0,
    "checkpoint": "auto",
    "plan_edited_by_user": False,
    "compile_fix_iterations": 0,
    "debug_iterations": 0,
    "flaky_retries": 0,
    "failure_classes": [],
    "scroll_fix": 0,
    "appium_fallback_used": False,   # завжди False (рішення 13.3), лишено для сумісності
    "code_edited_by_human": False,
    "human_seconds": 0,
}


def _parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def read_phases(check_id):
    """Повертає (device_seconds, device_runs, phase_breakdown) з phases-файлу."""
    path = os.path.join("target", "gen-test", f"phases-{check_id}.jsonl")
    device_seconds = 0
    device_runs = 0
    breakdown = {}
    if not os.path.exists(path):
        return device_seconds, device_runs, breakdown
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            dur = int(row.get("duration_s", 0))
            phase = row.get("phase", "unknown")
            device_seconds += dur
            device_runs += 1
            breakdown[phase] = breakdown.get(phase, 0) + dur
    return device_seconds, device_runs, breakdown


def validate(row):
    errors = []
    for f in REQUIRED:
        if f not in row:
            errors.append(f"відсутнє обовʼязкове поле: {f}")
    if row.get("outcome") not in OUTCOMES:
        errors.append(f"outcome має бути одним з {sorted(OUTCOMES)}")
    if row.get("negative_control") not in NEG:
        errors.append(f"negative_control має бути одним з {sorted(NEG)}")
    if not isinstance(row.get("platforms_green", []), list):
        errors.append("platforms_green має бути списком")
    return errors


def build_row(inp):
    errors = validate(inp)
    if errors:
        raise ValueError("; ".join(errors))

    row = dict(DEFAULTS)
    row.update(inp)

    check_id = row["check_id"]
    device_seconds, device_runs, breakdown = read_phases(check_id)
    row["device_seconds"] = device_seconds
    row["device_runs"] = device_runs
    row["phase_breakdown"] = breakdown

    total = (_parse_ts(row["ts_end"]) - _parse_ts(row["ts_start"])).total_seconds()
    total = int(round(total))
    human = int(row.get("human_seconds", 0))
    agent = total - device_seconds - human
    row["agent_seconds"] = max(agent, 0)
    if agent < 0:
        row["_warning"] = "agent_seconds<0: перевір ts_start/ts_end/human_seconds"

    return row


def main():
    ap = argparse.ArgumentParser(description="Append a gen-test run row to runs.jsonl")
    ap.add_argument("--in", dest="infile", help="JSON-файл рядка прогону (інакше stdin)")
    ap.add_argument("--dry-run", action="store_true", help="лише надрукувати рядок, не аппендити")
    args = ap.parse_args()

    raw = open(args.infile, encoding="utf-8").read() if args.infile else sys.stdin.read()
    try:
        inp = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"log_run: некоректний JSON на вході: {e}", file=sys.stderr)
        return 2

    try:
        row = build_row(inp)
    except ValueError as e:
        print(f"log_run: валідація не пройдена: {e}", file=sys.stderr)
        return 1

    line = json.dumps(row, ensure_ascii=False)
    if args.dry_run:
        print(line)
        return 0

    os.makedirs(os.path.dirname(RUNS_FILE), exist_ok=True)
    with open(RUNS_FILE, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    print(f"log_run: записано check_id={row['check_id']} outcome={row['outcome']} "
          f"device_s={row['device_seconds']} agent_s={row['agent_seconds']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
