import { spawn } from "node:child_process";

const exec = (cmd, args, keep_output = true, log = false) =>
    new Promise((res, rej) => {
        const spawned = spawn(cmd, args);
        if (log) console.log([cmd, ...args].join(" "));
        if (keep_output) {
            spawned.stdout.pipe(process.stdout);
            spawned.stderr.pipe(process.stderr);
        }
        
        spawned.on("error", (err) => {
            rej(err);
        });

        spawned.on("exit", (code) => {
            if (code === 0) {
                res();
            } else {
                rej(`Process "${cmd} ${args.join(" ")} exited with code ${code}`);
            }
        });
    });

const invoke_compiler = async (
    { compiler, includeDirectories, flags, output, sourceFiles, linkerFlags, keepOutput, log }
) => {
    await exec(
        compiler,
        [
            ...(includeDirectories
                ? includeDirectories.map((x) => ["-I", x]).flat()
                : []),
            ...(flags || []),
            ...(output ? ["-o", output] : []),
            ...sourceFiles,
            ...(linkerFlags || []),
        ],
        keepOutput,
        log
    );
};

export {
    exec,
    invoke_compiler
}