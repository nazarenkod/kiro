#!/usr/bin/env python3
"""metrics_summary.py — агрегати по runs.jsonl + mrs.jsonl (DESIGN.md 6.2/6.3).

Друкує зведення пілоту й перевіряє пороги 6.3. Все — детерміновано, без моделі.

Використання:
    python3 metrics_summary.py
    python3 metrics_summary.py --json
"""
import argparse
import json
import os
import statistics
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
RUNS_FILE = os.path.join(SKILL_DIR, "metrics", "runs.jsonl")
MRS_FILE = os.path.join(SKILL_DIR, "metrics", "mrs.jsonl")


def load(path):
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def median(values):
    values = [v for v in values if v is not None]
    return statistics.median(values) if values else None


def pct(part, whole):
    return round(100.0 * part / whole, 1) if whole else None


def summarize(runs, mrs):
    n = len(runs)
    green = [r for r in runs if r.get("outcome") == "green"]
    ng = len(green)

    # розподіл failure_classes
    fc_counts = {}
    for r in runs:
        for c in r.get("failure_classes", []):
            fc_counts[c] = fc_counts.get(c, 0) + 1
    total_fc = sum(fc_counts.values())

    # корзини часу
    dev = sum(r.get("device_seconds", 0) for r in runs)
    hum = sum(r.get("human_seconds", 0) for r in runs)
    agt = sum(r.get("agent_seconds", 0) for r in runs)
    tot = dev + hum + agt

    green_no_manual = [r for r in green if not r.get("code_edited_by_human", False)]

    s = {
        "runs_total": n,
        "runs_green": ng,
        "median_debug_iterations": median([r.get("debug_iterations", 0) for r in runs]),
        "pct_green_no_manual_edit": pct(len(green_no_manual), n),
        "pct_negative_control_pass": pct(
            sum(1 for r in runs if r.get("negative_control") == "pass"), n),
        "median_device_runs_to_green": median([r.get("device_runs", 0) for r in green]),
        "median_device_seconds_to_green": median([r.get("device_seconds", 0) for r in green]),
        "time_buckets_seconds": {"device": dev, "human": hum, "agent": agt},
        "time_buckets_pct": {
            "device": pct(dev, tot), "human": pct(hum, tot), "agent": pct(agt, tot),
        },
        "failure_classes": fc_counts,
        "pct_failure_unknown": pct(fc_counts.get("unknown", 0), total_fc) if total_fc else None,
        "pct_failure_scroll": pct(fc_counts.get("scroll", 0), total_fc) if total_fc else None,
        "pct_runs_scroll_fix": pct(sum(1 for r in runs if r.get("scroll_fix", 0) > 0), n),
        "pct_appium_fallback": pct(sum(1 for r in runs if r.get("appium_fallback_used")), n),
        "abandoned_by_looping": sum(1 for r in runs if r.get("outcome") == "abandoned"),
        "median_time_to_merge_s": median([m.get("time_to_merge_s") for m in mrs]),
        "mrs_total": len(mrs),
    }
    return s


def check_thresholds(s):
    """Пороги 6.3 (пілот, 5 кейсів). Повертає список (назва, ok, факт, поріг)."""
    checks = []
    md = s["median_debug_iterations"]
    checks.append(("median debug_iterations ≤ 2", md is not None and md <= 2, md, "≤ 2"))
    gm = s["pct_green_no_manual_edit"]
    # ≥ 3 з 5 = 60%
    checks.append(("green без ручних правок ≥ 60%", gm is not None and gm >= 60, gm, "≥ 60%"))
    nc = s["pct_negative_control_pass"]
    checks.append(("negative_control pass = 100%", nc == 100.0, nc, "100%"))
    checks.append(("abandoned через зациклення = 0",
                   s["abandoned_by_looping"] == 0, s["abandoned_by_looping"], "0"))
    sf = s["pct_runs_scroll_fix"]
    checks.append(("прогонів зі scroll_fix>0 ≤ 30%",
                   sf is not None and sf <= 30, sf, "≤ 30%"))
    return checks


def main():
    ap = argparse.ArgumentParser(description="Aggregate gen-test metrics")
    ap.add_argument("--json", action="store_true", help="вивід у JSON")
    args = ap.parse_args()

    runs = load(RUNS_FILE)
    mrs = load(MRS_FILE)
    s = summarize(runs, mrs)

    if args.json:
        print(json.dumps({"summary": s,
                          "thresholds": [
                              {"name": n, "ok": ok, "actual": a, "target": t}
                              for (n, ok, a, t) in check_thresholds(s)]},
                         ensure_ascii=False, indent=2))
        return 0

    if not runs:
        print("metrics_summary: runs.jsonl порожній — ще нема прогонів.")
        return 0

    print(f"=== gen-test метрики ({s['runs_total']} прогонів, {s['runs_green']} green) ===")
    print(f"медіана debug_iterations:        {s['median_debug_iterations']}")
    print(f"% green без ручних правок:        {s['pct_green_no_manual_edit']}")
    print(f"% negative_control pass:          {s['pct_negative_control_pass']}")
    print(f"медіана device_runs до green:     {s['median_device_runs_to_green']}")
    print(f"медіана device_seconds до green:  {s['median_device_seconds_to_green']}")
    b = s["time_buckets_pct"]
    print(f"корзини часу (device/human/agent):{b['device']}% / {b['human']}% / {b['agent']}%")
    print(f"failure_classes:                 {s['failure_classes'] or '—'}")
    print(f"  частка unknown:                {s['pct_failure_unknown']}")
    print(f"  частка scroll:                 {s['pct_failure_scroll']}")
    print(f"% прогонів зі scroll_fix>0:       {s['pct_runs_scroll_fix']}")
    print(f"% appium_fallback (має бути 0):   {s['pct_appium_fallback']}")
    print(f"медіана time_to_merge_s:          {s['median_time_to_merge_s']} ({s['mrs_total']} MR)")

    print("\n=== Пороги пілоту (6.3) ===")
    all_ok = True
    for name, ok, actual, target in check_thresholds(s):
        mark = "✅" if ok else "❌"
        all_ok = all_ok and ok
        print(f"{mark} {name}: факт={actual}, поріг={target}")
    print(f"\nПідсумок: {'усі пороги пройдені' if all_ok else 'є непройдені пороги → вхід у reflection'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
