
# Clarity Opt Out Extension

## About the Project
The goal of this project is allow end users to opt of their sessions being collected by clarity-js, without needing to coordinate with web masters who utilize Clarity.

## Building Extension
 - Setup your development environment by following instructions **[here](https://github.com/microsoft/clarity/blob/master/CONTRIBUTING.md)**
 - Build everything: `yarn build`
 - Extension will be built under: `extension` folder

## Using Extension
1. Go to extensions page on your browser (e.g. `edge://extensions` or `chrome://extensions`)
2. Enable `Developer mode`
3. Click on `Load unpacked`
4. Select the `extension` folder that you was generated after building the project
5. Navigate to a website of your choice which runs Clarity such as https://clarity.microsoft.com
6. Notice no calls to Clarity's /collect endpoint

## Contributing

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

Happy coding!