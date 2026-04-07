# Contributing to Clarity

The goal of this document is to provide easy instructions to setup a development environment and provide clear contribution guidelines to encourage participation from more developers.

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repositories using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Reporting Issues

Before opening a GitHub issue, please determine which type of issue you're experiencing:

### Issues with the Clarity Dashboard or Service (clarity.microsoft.com)

If your issue is related to the **Clarity dashboard, service, or your project at [clarity.microsoft.com](https://clarity.microsoft.com)**, this GitHub repository is **not** the right place. Instead, please email **[clarityms@microsoft.com](mailto:clarityms@microsoft.com)** with:

- Your **Clarity project ID** or a link to your project page
- A description of the issue you're experiencing
- Screenshots or screen recordings, if applicable

Examples of dashboard/service issues:
- Missing or incorrect data in recordings, heatmaps, or analytics
- Problems logging in to your Clarity account
- Issues with GA4 integration, Smart Events, or Custom Tags in the dashboard
- Session recordings not appearing or rendering incorrectly
- Export API questions
- Project setup or team management

### Issues with the Open-Source Packages (clarity-js, clarity-decode, clarity-visualize)

If your issue is a **bug, feature request, or question about the open-source code** in this repository, please [open a GitHub issue](https://github.com/microsoft/clarity/issues/new). Include:

- The **package name** and **version** you're using (e.g., `clarity-js@0.8.1`)
- Steps to reproduce the issue
- Expected vs. actual behavior
- Browser and OS information
- A minimal code sample, if possible

## Workflow

### Submitting Code Changes

Submit a pull-request with your changes. This involves creating a local feature branch, publishing it, and submitting a pull request, which will generate a code review. Once the review is approved, the code will automatically be merged.

### Git

On Windows, grab an installer from here: https://git-scm.com/download/win and go with the default options (there will be a lot of option screens).

On Mac and Linux, it's pre-installed.

### Node.js (22+)

**Required:** Node.js 22 or higher

On Windows, grab an installer from nodejs.org and go with the default options:
```
https://nodejs.org/en/download/
```

On Mac, setup Homebrew and then proceed to install node
```
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
brew install node
```

On Ubuntu, it's fairly straight forward except you've a few extra steps
```
sudo apt-get install nodejs
sudo apt-get install build-essential
sudo apt-get install libssl-dev
sudo apt-get install npm
sudo update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10
  -- There's a naming conflict on Ubuntu for node vs. nodejs.
  -- If you happen to have node install, run: sudo apt-get --purge remove node
```

### Cloning Clarity

```
1. Open command line prompt (Windows) / Terminal (Mac) / Shell (Ubuntu)
2. Go to a directory where you would like to pull Clarity code
3. git clone https://github.com/microsoft/clarity.git
4. When prompted, enter your github credentials
```

### Starting Clarity

Install yarn package manager globally on your machine:
```
npm i -g yarn
```

Install yarn packages:
```
yarn install
```

To build:
```
yarn build
```

To test:
```
yarn test
```

On Ubuntu, if you run into errors, it may be because you are missing the libfontconfig package
```
sudo apt-get install libfontconfig
```

### Testing Clarity

Clarity uses `@playwright/test` for testing. You can find end-to-end tests under `test/` and per-package tests under `packages/<package-name>/test/`.

To run tests, make sure `yarn install` and `yarn build` have been executed successfully, and that Playwright's chromium browser is installed by running:
```
npx playwright install chromium
```

To run Playwright's UI for better reporting, watch mode, etc:
```
yarn test:ui
```

### Debugging Clarity
Use [clarity-devtools](https://github.com/microsoft/clarity/tree/master/packages/clarity-devtools) to debug Clarity against any live website.

### Text Editor

Recommended text editor is Visual Studio Code, but if you prefer a different text editor, feel free to use it.

Download Visual Studio Code
```
https://code.visualstudio.com/download
```

Edit Clarity:
```
Go to 'File -> Open Folder' and select the 'clarity' folder that you just cloned.
```

To debug tests from Visual Studio Code, install the [Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) extension.

### Text Editor TSLint Plugin

TSLint plugin will read Clarity's TSLint configuration and highlight any TSLint errors immediately as you edit your code.

For Visual Studio Code, you can install the TSLint plugin from the Visual Studio Marketplace:
```
https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-tslint-plugin
```
