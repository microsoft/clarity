
# Clarity Developer Tools

## About the Project
The goal of this project is to demonstrate how various components of Clarity come together. It enables:
1. Debugging support for [clarity-js](https://github.com/microsoft/clarity/tree/master/packages/clarity-js) to browser developer tools. 
2. Exporting data captured by Clarity - both in encoded and decoded format.
3. Live session replays against any website

## Building Extension
 - Setup your development environment by following instructions **[here](https://github.com/microsoft/clarity/blob/master/CONTRIBUTING.md)**
 - Build everything: `yarn build`
 - Extension will be built under: `extension` folder

## Using Extension
1. Go to extensions page on your browser (e.g. `edge://extensions` or `chrome://extensions`)
2. Enable `Developer mode`
3. Click on `Load unpacked`
4. Select the `extension` folder that you was generated after building the project
5. Navigate to a website of your choice, and open `developer tools` (F12) in your browser
6. Click on the `Clarity` tab in the developer tools - and see the live replay in action

## Data Collection
By default, Clarity Developer Tools will only begin instrumenting after you open explicitly open the developer tools in your browser and click on the `Clarity` tab. Even then, all data captured by the extension stays on your own device, and is not uploaded anywhere.

## Contributing

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

Happy coding!