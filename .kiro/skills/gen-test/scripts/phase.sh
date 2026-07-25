#!/usr/bin/env bash
# phase.sh — обгортка зовнішніх прогонів пайплайна gen-test.
# Міряє device-time й аппендить рядок у target/gen-test/phases-<checkId>.jsonl.
#
# УСІ mvn у пайплайні йдуть ЛИШЕ через цю обгортку (DESIGN.md 2.5 / 6.1) —
# інакше device-time не міряється.
#
# Використання:
#   scripts/phase.sh <check_id> <phase> -- <cmd> [args...]
#
#   <phase>: compile | run_aos | neg_control | run_ios | retry
#
# Приклад:
#   scripts/phase.sh 12345 run_aos -- mvn -s settings.xml test -Dtest=AuthTest#test_01_12345
#
# Exit-код обгортки = exit-код команди (ненульові фіксуються так само —
# саме вони найдорожчі).
set -u

if [[ $# -lt 4 ]]; then
  echo "usage: phase.sh <check_id> <phase> -- <cmd...>" >&2
  exit 2
fi

check_id="$1"; shift
phase="$1"; shift
if [[ "$1" != "--" ]]; then
  echo "phase.sh: очікував '--' перед командою" >&2
  exit 2
fi
shift

case "$phase" in
  compile|run_aos|neg_control|run_ios|retry) ;;
  *) echo "phase.sh: невідома фаза '$phase' (compile|run_aos|neg_control|run_ios|retry)" >&2; exit 2 ;;
esac

out_dir="target/gen-test"
mkdir -p "$out_dir"
phases_file="${out_dir}/phases-${check_id}.jsonl"

# attempt = скільки рядків цієї ж фази вже є + 1
attempt=1
if [[ -f "$phases_file" ]]; then
  prev=$(grep -c "\"phase\":\"${phase}\"" "$phases_file" 2>/dev/null || echo 0)
  attempt=$(( prev + 1 ))
fi

ts_start=$(date -u +%Y-%m-%dT%H:%M:%SZ)
start_epoch=$(date -u +%s)

# Прогін команди (stdout/stderr — наскрізь користувачу)
"$@"
exit_code=$?

end_epoch=$(date -u +%s)
ts_end=$(date -u +%Y-%m-%dT%H:%M:%SZ)
duration_s=$(( end_epoch - start_epoch ))

# JSON-екранування команди (мінімальне: лапки і бекслеші)
cmd_str="$*"
cmd_json=${cmd_str//\\/\\\\}
cmd_json=${cmd_json//\"/\\\"}

printf '{"check_id":%s,"phase":"%s","attempt":%s,"ts_start":"%s","ts_end":"%s","duration_s":%s,"exit_code":%s,"cmd":"%s"}\n' \
  "$check_id" "$phase" "$attempt" "$ts_start" "$ts_end" "$duration_s" "$exit_code" "$cmd_json" \
  >> "$phases_file"

exit "$exit_code"
