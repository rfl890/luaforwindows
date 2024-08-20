import { parentPort } from "worker_threads";
import { invoke_compiler } from "./exec.js";

const do_jobs = async (jobs) => {
    for (const job_idx in jobs) {
        const job = jobs[job_idx];
        await invoke_compiler(job);
    }
};

parentPort.on("message", async (data) => {
    do_jobs(data.jobs)
        .then(() => {
            parentPort.postMessage({ success: true });
        })
        .catch((err) => {
            parentPort.postMessage({ success: false, err });
        });
});
