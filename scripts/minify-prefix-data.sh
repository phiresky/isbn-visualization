#!/bin/bash
set -euo pipefail

JOBS="${JOBS:-$(nproc)}"

OUTPUT_DIR_PUBLIC="${OUTPUT_DIR_PUBLIC:-public}"

echo compressing files in $OUTPUT_DIR_PUBLIC/prefix-data with zopfli using $JOBS threads
for f in $OUTPUT_DIR_PUBLIC/prefix-data/*.json; do
    (
        # .. do your stuff here
        echo "zopfli $f.."
        zopfli "$f" && rm "$f"
    ) &

    # allow to execute up to $N jobs in parallel
    while [[ $(jobs -r -p | wc -l) -ge $JOBS ]]; do
        # now there are $N jobs already running, so wait here for any job
        # to be finished so there is a place to start next one.
        wait -n
    done

done

# no more jobs to be started but wait for pending jobs
# (all need to be finished)
wait

echo "all done"