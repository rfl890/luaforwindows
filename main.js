import { join, resolve } from "node:path";
import {
    readFileSync,
    existsSync,
    rmSync,
    readdirSync,
    mkdirSync,
    renameSync,
    writeFileSync,
    cpSync,
} from "node:fs";
import prompts from "prompts";
import { download_with_progress } from "./util/download.js";
import { update_path } from "./util/path.js";
import { exec } from "./util/exec.js";
import decompress from "./util/decompress.js";
import ora from "ora";

const root = process.cwd();

const arch = (
    await prompts([
        {
            type: "select",
            name: "arch",
            message: "Select which architecture to build",
            choices: [
                { title: "i686", value: "32" },
                { title: "x86-64", value: "64" },
            ],
            initial: process.arch == "x64" ? 1 : 0,
        },
    ])
).arch;

const variables = {
    root,
    /* compiling variables */
    CC: `${arch == "64" ? "x86_64" : "i686"}-w64-mingw32-gcc`,
    CXX: `${arch == "64" ? "x86_64" : "i686"}-w64-mingw32-g++`,
    RC: `${arch == "64" ? "x86_64" : "i686"}-w64-mingw32-windres`,
    CFLAGS: ["-O3"],

    /* build variables */
    BUILD_DIR: join(root, "build"),
    TOOLS_DIR: join(root, "tools"),

    TOOLS_STATUS_FILE: join(root, "tools", "tools.json"),

    versions: JSON.parse(readFileSync("versions.json", "utf-8")),
};

if (existsSync(variables.BUILD_DIR)) {
    rmSync(variables.BUILD_DIR, { recursive: true, force: true });
}

const downloaded_tools = {};

if (existsSync(variables.TOOLS_STATUS_FILE)) {
    const tools_dir_status = JSON.parse(
        readFileSync(variables.TOOLS_STATUS_FILE, "utf-8")
    );

    for (const tool of readdirSync(variables.TOOLS_DIR)) {
        if (tools_dir_status[tool]) {
            downloaded_tools[tool] = true;
        } else {
            if (tool === "tools.json") continue;
            rmSync(join(variables.TOOLS_DIR, tool), {
                recursive: true,
                force: true,
            });
        }
    }
} else {
    console.log("Creating tools directory");
    rmSync(variables.TOOLS_DIR, { recursive: true, force: true });
    mkdirSync(variables.TOOLS_DIR);
}

const new_path = [];

process.env.CC = variables.CC;
process.env.CXX = variables.CXX;
process.env.CPP = variables.CXX;
process.env.RC = variables.RC;

for (const tool of variables.versions.tools) {
    const tool_output_archive = `${tool.name}-${tool.version}.archive`;
    const tool_output_dir = `${tool.name}-${tool.version}`;
    const spinner = ora(`Downloading ${tool.name} ${tool.version}...`).start();

    for (const path_dir of tool.to_path) {
        new_path.push(join(variables.TOOLS_DIR, tool_output_dir, path_dir));
    }
    update_path(new_path);

    if (downloaded_tools[tool_output_dir]) {
        spinner.succeed(`Downloaded ${tool.name} ${tool.version}`);
        continue;
    }

    await download_with_progress(
        tool.url,
        join(variables.TOOLS_DIR, tool_output_archive),
        `Downloading ${tool.name} ${tool.version}...`,
        tool.b3sum,
        spinner
    );
    spinner.text = `Extracting ${tool.name} ${tool.version}...`;

    if (tool.custom_extract_command) {
        const formatted_extract_command = tool.custom_extract_command.map(
            (segment) =>
                segment
                    .replace("__out_dir__", join(variables.TOOLS_DIR, "tmp"))
                    .replace(
                        "__file__",
                        join(variables.TOOLS_DIR, tool_output_archive)
                    )
        );
        await exec(
            formatted_extract_command[0],
            formatted_extract_command.slice(1),
            false,
            false
        );
    }

    if (tool.create_dir) {
        if (!tool.custom_extract_command) {
            await decompress(
                join(variables.TOOLS_DIR, tool_output_archive),
                join(variables.TOOLS_DIR, tool_output_dir)
            );
        }
    } else {
        if (!tool.custom_extract_command) {
            await decompress(
                join(variables.TOOLS_DIR, tool_output_archive),
                variables.TOOLS_DIR
            );
        }
        renameSync(
            join(variables.TOOLS_DIR, tool.out_dir),
            join(variables.TOOLS_DIR, tool_output_dir)
        );
    }

    if (tool.copy_files) {
        for (const orig_dir in tool.copy_files) {
            cpSync(
                join(variables.TOOLS_DIR, tool_output_dir, orig_dir),
                join(
                    variables.TOOLS_DIR,
                    tool_output_dir,
                    tool.copy_files[orig_dir]
                )
            );
        }
    }

    downloaded_tools[tool_output_dir] = true;
    spinner.succeed(`Downloaded ${tool.name} ${tool.version}`);
}

writeFileSync(variables.TOOLS_STATUS_FILE, JSON.stringify(downloaded_tools));
variables.PATH = new_path;

mkdirSync(variables.BUILD_DIR);

const valid_dirs = [];

for (const lib of variables.versions.libraries) {
    const { build } = await import(`./build-scripts/${lib.build_script}`);
    const spinner = ora(
        `Building library ${lib.name} ${lib.version}...`
    ).start();
    await build(variables, spinner);
    valid_dirs.push(
        resolve(join(variables.BUILD_DIR, lib.out_dir)).toLowerCase()
    );
    spinner.succeed(`Built library ${lib.name} version ${lib.version}`);
}

rmSync(join(variables.root, "out"), { recursive: true, force: true });
mkdirSync(join(variables.root, "out"));

for (const dir of readdirSync(variables.BUILD_DIR)) {
    if (
        !valid_dirs.includes(
            resolve(join(variables.BUILD_DIR, dir)).toLowerCase()
        )
    ) {
        console.log(`Excluding directory ${dir} from install`);
        continue;
    }
    await exec(
        "cp",
        ["-RT", join(variables.BUILD_DIR, dir), join(variables.root, "out")],
        true,
        true
    );
}

console.log("Done. Your LfW installation is the out directory");