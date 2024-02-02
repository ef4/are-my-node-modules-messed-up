#!/usr/bin/env node

import { existsSync } from 'fs';
import { readJSONSync } from 'fs-extra';
import { dirname, sep } from 'path';
import resolvePackagePath from 'resolve-package-path';
import { satisfies } from 'semver';
import chalk from 'chalk';
import { findRoot } from "@manypkg/find-root";

let CUSTOM_SETINGS;

const IGNORE = ['webpack'];

class Walker {
  errors: string[] = [];

  private seen: Map<string, string> = new Map();

  traverse(packageJSONPath: string, checkDevDependencies = false): string {
    let version = this.seen.get(packageJSONPath);
    if (version) {
      return version;
    }

    let pkg = readJSONSync(packageJSONPath);
    this.seen.set(packageJSONPath, pkg.version);

    let root = dirname(packageJSONPath);
    this.checkSection('dependencies', pkg, root);
    this.checkSection('peerDependencies', pkg, root);
    if (checkDevDependencies) {
      this.checkSection('devDependencies', pkg, root);
    }
    return pkg.version;
  }

  private checkSection(
    section: 'dependencies' | 'devDependencies' | 'peerDependencies',
    pkg: any,
    packageRoot: string
  ): void {
    let dependencies = pkg[section];
    if (!dependencies) {
      return;
    }
    for (let name of Object.keys(dependencies)) {
      let range = dependencies[name];

      // Ignore workspace protocol
      if (range.startsWith('workspace:')) continue;
      // For package-aliases (due to bad-actors, etc)
      if (range.startsWith('npm:') && range.includes('@')) {
        let [, rangeOverride] = range.split('@');
        range = rangeOverride;
      }

      let version = this.checkDep(packageRoot, name);

      if (version) {
        if (!satisfies(version, range, { includePrerelease: true })) {
          this.errors.push(
            `${chalk.cyanBright(pkg.name)} asked for ${chalk.cyanBright(name)} ${chalk.green(
              range
            )} but got ${chalk.red(version)}\n  - in ${section} at ${humanPath(packageRoot)}`
          );
        }
      } else {
        if (IGNORE.includes(name)) continue;

        if (section !== 'peerDependencies' || !pkg.peerDependenciesMeta?.[name]?.optional) {
          this.errors.push(
            `${chalk.cyanBright(pkg.name)} is missing ${chalk.red(name)}\n  in ${section} at ${humanPath(packageRoot)}`
          );
        }
      }
    }
  }

  private checkDep(packageRoot: string, pkgName: string): string | false {
    let target = resolvePackagePath(pkgName, packageRoot);
    if (!target) {
      return false;
    }
    return this.traverse(target);
  }
}

async function main() {
  let dir = await findRoot(process.cwd());
  let monorepoInfo = await dir.tool.getPackages(dir.rootDir);
  let root = monorepoInfo.rootPackage;

  CUSTOM_SETINGS = (root?.packageJson as any).pnpm;

  if (!existsSync('package.json')) {
    process.stderr.write(`You must run this command in a project with a package.json file.`);
    process.exit(-1);
  }
  let walker = new Walker();
  walker.traverse('package.json', true);
  if (walker.errors.length > 0) {
    process.stdout.write(walker.errors.join('\n') + '\n');
    process.stdout.write(chalk.red('Your node_modules are messed up.\n'));
    process.exit(-1);
  } else {
    process.stdout.write(chalk.green('Your node_modules look good.\n'));
  }
}

function humanPath(path: string) {
  let prefix = process.cwd() + sep;
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }
  return path;
}

main();
