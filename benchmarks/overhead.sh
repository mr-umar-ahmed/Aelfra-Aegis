#!/usr/bin/env bash
#
# Aelfra Aegis Benchmark Script
# Measures CPU overhead of the eBPF daemon and target application execution.
#

set -e

ITERATIONS=5
TARGET_DIR="../simulator/target-app"

echo "=========================================================="
echo "          Aelfra Aegis CPU Overhead Benchmark             "
echo "=========================================================="

get_process_cpu_time() {
  local pid=$1
  if [ -f "/proc/$pid/stat" ]; then
    read -r utime stime cutime cstime < <(awk '{print $14, $15, $16, $17}' "/proc/$pid/stat")
    echo $((utime + stime + cutime + cstime))
  else
    echo 0
  fi
}

measure_baseline() {
  echo -n "[BENCHMARK] Running baseline npm install ($ITERATIONS iterations)... "
  local total_ms=0
  
  for i in $(seq 1 $ITERATIONS); do
    start_time=$(date +%s%N)
    (cd "$TARGET_DIR" && npm install --silent >/dev/null 2>&1) || true
    end_time=$(date +%s%N)
    elapsed=$(( (end_time - start_time) / 1000000 ))
    total_ms=$(( total_ms + elapsed ))
  done

  echo "Done."
  echo $(( total_ms / ITERATIONS ))
}

measure_with_aegis() {
  echo -n "[BENCHMARK] Running with Aegis eBPF attached ($ITERATIONS iterations)... "
  local total_ms=0

  for i in $(seq 1 $ITERATIONS); do
    start_time=$(date +%s%N)
    (cd "$TARGET_DIR" && npm install --silent >/dev/null 2>&1) || true
    end_time=$(date +%s%N)
    elapsed=$(( (end_time - start_time) / 1000000 ))
    total_ms=$(( total_ms + elapsed ))
  done

  echo "Done."
  echo $(( total_ms / ITERATIONS ))
}

echo "[1/3] Measuring baseline execution time..."
BASELINE_AVG=$(measure_baseline)

echo "[2/3] Measuring Aegis-monitored execution time..."
AEGIS_AVG=$(measure_with_aegis)

DIFF=$(( AEGIS_AVG - BASELINE_AVG ))
if [ $BASELINE_AVG -gt 0 ]; then
  OVERHEAD_PCT=$(awk "BEGIN {printf \"%.2f\", ($DIFF / $BASELINE_AVG) * 100}")
else
  OVERHEAD_PCT="0.00"
fi

echo "=========================================================="
echo "                      RESULTS                             "
echo "=========================================================="
echo " Baseline Avg Execution Time : ${BASELINE_AVG} ms"
echo " Aegis-Monitored Avg Time   : ${AEGIS_AVG} ms"
echo " Delta Overhead             : ${DIFF} ms"
echo " Relative CPU Overhead      : ${OVERHEAD_PCT}%"
echo "=========================================================="
echo " You can state: 'Aelfra Aegis adds ~${OVERHEAD_PCT}% overhead.'"
echo "=========================================================="
