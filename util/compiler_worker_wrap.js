import { cpus } from "os";
import { join } from "path";
import { Worker } from "worker_threads";

const arr_chunks = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

// make -j$(nproc) cries when he sees this
const submit_compile_job = async (variables, jobs) => {
    const worker_jobs = arr_chunks(jobs, Math.ceil(jobs.length / cpus().length));
    const promises = [];
    const worker_filename = join(variables.root, "util", "compiler_worker.js");
    for (const worker_job_idx in worker_jobs) {
        promises.push(
            (() =>
                new Promise((res, rej) => {
                    const worker_job = worker_jobs[worker_job_idx];
                    const worker = new Worker(worker_filename);

                    worker.addListener("message", (result) => {
                        worker.terminate();
                        if (!result.success) {
                            rej(result.err);
                        } else {
                            res();
                        }
                    });

                    worker.postMessage({
                        jobs: worker_job,
                    });
                }))()
        );
    }
    await Promise.all(promises);
};

export { submit_compile_job };