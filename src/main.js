import chalk from "chalk";
import fs from "fs";
import { readdir } from "fs/promises";
import { promisify } from "util";
import path from "path";
import execa from "execa";
import Listr from "listr";
import VerboseRenderer from "listr-verbose-renderer";

import copyTemplateFiles from "./functions/copyTemplateFiles";
import createDirectory from "./functions/createDirectory";

// REMOVE LATER
import gitignore from "gitignore";
import { projectInstall } from "pkg-install";

const writeGitignore = promisify(gitignore.writeFile);

const createGitignore = async (opts) => {
  const file = fs.createWriteStream(path.join(opts.targetDir, ".gitignore"), {
    flags: "a",
  });
  return writeGitignore({
    type: "Node",
    file: file,
  });
};

const gitInit = async () => {
  const res = await execa("git", ["init"], {
    cwd: opts.targetDir,
  });
  if (res.failed) {
    return Promise.reject(
      new Error("%s Failed to initialize git", chalk.red.bold("ERR"))
    );
  }
  return opts.git;
};

export const createProject = async (opts) => {
  opts = {
    ...opts,
  };

  if (!opts.targetDir) return;

  const fullPathName = new URL(import.meta.url).pathname;
  const rawDirectory = opts.targetDir;

  const templateDir = path
    .join(
      process.cwd(),
      `${opts.targetDir}/node_modules/`,
      opts.template.toLowerCase()
    )
    .replace("%20", " ");

  opts.templateDirectory = templateDir;

  opts.verbose &&
    console.log(
      chalk.red.bold("\n VERBOSE MODE \n "),
      chalk.bold("\ntemplate-dir: "),
      templateDir,
      chalk.bold("\ntarget-dir: "),
      opts.targetDir,
      chalk.bold("\nopts: "),
      opts
    );

  opts.verbose &&
    console.log(
      "Found a bug? Create an issue at: \n",
      chalk.underline.blue(
        "https://github.com/Nemesisly/create-discordjs-project/issues"
      ),
      "\n"
    );

  const tasks = new Listr(
    [
      {
        title: "📁 Creating project directory",
        task: () => createDirectory(opts),
        skip: () => {
          return new Promise((resolve, reject) => {
            readdir(path.join(process.cwd(), opts.targetDir))
              .then((files) => {
                if(files.length == 0) resolve(true);
                resolve(false)
              })
              .catch(() => {resolve(false)});
          });
        },
      },
      {
        title: "🔗 Installing template",
        task: async () => {
          await execa("npm", ["init", "-y"], {
            cwd: path.resolve(process.cwd(), opts.targetDir),
            all: true,
          });
          await execa("npm", ["install", opts.template], {
            cwd: path.resolve(process.cwd(), opts.targetDir),
            all: true,
          });
        },
      },
      {
        title: "📜 Copying project template into your project",
        task: () => copyTemplateFiles(opts),
      },
      {
        title: "🦺 Creating gitignore",
        task: () => createGitignore(opts),
      },
      {
        title: "☁ Initializing git",
        task: () => gitInit(opts),
        enabled: () => opts.git,
      },
      {
        title: "🚚 Installing dependencies",
        task: () =>
          projectInstall({
            cwd: opts.targetDir,
          }),
        skip: () =>
          !opts.runInstall
            ? "Pass --install to automatically install required dependencies"
            : undefined,
      },
    ],
    {
      renderer: opts.verbose ? VerboseRenderer : undefined,
    }
  );

  await tasks.run();

  console.log("%s Project ready", chalk.green.bold("DONE"));
  opts.verbose ||
    console.log(
      "Here are some commands you can run in the project: ",
      chalk.magenta(`\n\n${opts.pkgManager} start`),
      "\n Starts the bot",
      chalk.gray.italic(
        " → The bot is run using nodemon meaning that if you save anything the code automatically restarts!"
      ),
      "\n\nWe suggest you run:\n\n",
      chalk.magenta("cd"),
      `${rawDirectory.trim()}\n`,
      chalk.magenta(`cp .env.TEMPLATE .env\n`),
      chalk.magenta(`nano .env\n`),
      chalk.magenta(`${opts.pkgManager} start\n`),
    );
  opts.verbose || console.log("Happy hacking!");
  return true;
};
