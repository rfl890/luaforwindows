import { createWriteStream } from "fs";
import { createBLAKE3 } from "hash-wasm";
import ora from "ora";
import { Writable } from "stream";

const download_without_progress = async (
    url,
    output_file,
    header,
    hash,
    spinner_in
) => {
    const response = await fetch(url);
    const spinner = spinner_in || ora(header).start();

    const hasher = hash
        ? await createBLAKE3()
        : {
              init: () => {},
              update: () => {},
              digest: () => {},
          };
    hasher.init();

    spinner.text = header;
    await new ReadableStream({
        async start(controller) {
            const reader = response.body.getReader();
            while (1) {
                const { done, value } = await reader.read();
                if (done) break;
                hasher.update(value);
                controller.enqueue(value);
            }
            controller.close();
        },
    }).pipeTo(Writable.toWeb(createWriteStream(output_file)));

    if (hash) {
        const computed_hash = hasher.digest("hex");
        if (hash != computed_hash) {
            throw "hash mismatch";
        }
    }

    if (!spinner_in) {
        spinner.succeed();
    }
};

const download_with_progress = async (
    url,
    output_file,
    header,
    hash,
    spinner_in
) => {
    const response = await fetch(url);
    const length = parseInt(response.headers.get("content-length"));

    if (!length) {
        return await download_without_progress(
            url,
            output_file,
            header,
            hash,
            spinner_in
        );
    }

    const spinner = spinner_in || ora(header).start();
    let progress = 0;

    const hasher = hash
        ? await createBLAKE3()
        : {
              init: () => {},
              update: () => {},
              digest: () => {},
          };
    hasher.init();

    await new ReadableStream({
        async start(controller) {
            const reader = response.body.getReader();
            while (1) {
                const { done, value } = await reader.read();
                if (done) break;
                progress += value.byteLength;
                spinner.text = `${header} - ${(
                    (progress / length) *
                    100
                ).toFixed(2)}%`;
                hasher.update(value);
                controller.enqueue(value);
            }
            controller.close();
        },
    }).pipeTo(Writable.toWeb(createWriteStream(output_file)));

    if (hash) {
        const computed_hash = hasher.digest("hex");
        if (hash != computed_hash) {
            throw "hash mismatch";
        }
    }

    if (!spinner_in) {
        spinner.succeed();
    }
};

export { download_with_progress };