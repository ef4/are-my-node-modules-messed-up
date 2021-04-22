# are-my-node-modules-messed-up

NPM and Yarn have bugs. It's all too common that your node_modules folder ends up with a structure that doesn't satisfy every package's stated dependencies. This tool lets you check for that.

## Usage

1. Somebody reports a weird bug to you.
2. You tell them to run:
   > `npx are-my-node-modules-messed-up`
3. They close the issue and say "yup, my node_modules were messed up. `rm -rf node_modules` fixed it."
