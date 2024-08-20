import { cpSync, mkdirSync, renameSync, rmSync } from "fs";
import { invoke_compiler } from "../util/exec.js";
import { download_with_progress } from "../util/download.js";
import decompress from "../util/decompress.js";
import { join } from "path";
import { waitFile } from "wait-file";

export async function build(variables, spinner) {
    const pl_info = variables.versions.libraries.find(
        (obj) => obj.name === "penlight"
    );

    const pl_dir = join(variables.BUILD_DIR, pl_info.out_dir);
    await download_with_progress(
        pl_info.url,
        join(variables.BUILD_DIR, "pl.archive"),
        `Downloading ${pl_info.name} ${pl_info.version}...`,
        pl_info.b3sum,
        spinner
    );

    await decompress(
        join(variables.BUILD_DIR, "pl.archive"),
        join(variables.BUILD_DIR)
    );

    spinner.text = `Installing ${pl_info.name} ${pl_info.version}...`;
    process.chdir(variables.BUILD_DIR);

    const pl_install_dir = join(variables.BUILD_DIR, "pl-tmp-install");
    mkdirSync(pl_install_dir);

    mkdirSync(join(pl_install_dir, "share", "lua"), { recursive: true });
    mkdirSync(join(pl_install_dir, "doc"), { recursive: true });

    renameSync(
        join(pl_dir, "lua"),
        join(pl_install_dir, "share", "lua", "5.4")
    );

    renameSync(
        join(pl_dir, "docs"),
        join(pl_install_dir, "doc", "penlight")
    );

    spinner.text = "Cleaning up...";
    await waitFile({
        resources: [pl_dir],
        delay: 0,
        interval: 75,
        log: false,
        reverse: false,
        timeout: 20000,
        verbose: false,
        window: 250,
    });

    rmSync("pl.archive");
    rmSync(pl_dir, { recursive: true, force: true });
    renameSync(pl_install_dir, pl_dir);
}