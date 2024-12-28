#!/bin/bash
set -euo pipefail

N=$(nproc)

echo compressing files in public/prefix-data with zopfli using $N threads
for f in public/prefix-data/*.json; do
    (
        # .. do your stuff here
        echo "starting task $f.."
        zopfli "$f" && rm "$f"
    ) &

    # allow to execute up to $N jobs in parallel
    while [[ $(jobs -r -p | wc -l) -ge $N ]]; do
        # now there are $N jobs already running, so wait here for any job
        # to be finished so there is a place to start next one.
        wait -n
    done

done

# no more jobs to be started but wait for pending jobs
# (all need to be finished)
wait

echo "all done"