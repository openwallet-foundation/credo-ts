# Setup Libindy for Windows

## prerequisites

- Node (We have tested 17.0.1 and 16.8.0 and they both work, so those should be safe.)
- Python 3+
- VS 2022 Community, or better (With the `Desktop Development with C++` installed)

## Step 1.1: Downloading libindy

You can download the libindy from the repository [here](https://repo.sovrin.org/windows/libindy/master/1.16.0-1636/libindy_1.16.0.zip). This will download libindy and all its required dependencies.

### Step 1.2: Extracting libindy

When it has been done downloading, navigate to your downloads folder and extract the `lib` directory to a permanent location. Remeber this path as it is required later.

## Step 2: Add libindy to your environment variables

Go to your environment variables and click on `new` at the `System variables`. the `name` MUST be `LD_LIBRARY_PATH` and the value MUST be the path to the `lib` folder. This path is where you extracted the downloaded zip file to.

## Step 3: Confirming the installation

After cloning, building and moving libindy, everything should be installed correctly to develop with Aries Framework JavaScript. To confirm this, execute the following script:

```sh
npx -p @aries-framework/node is-indy-installed

# OUTPUT: Libindy was installed correctly
```

If the output was anything else then that, there might be some issues with your installation. If the only step you did the step 1 and 2 from this article, please report this [here](https://github.com/hyperledger/aries-framework-javascript/issues) or email me directly at berend@animo.id with an error log.

To acquire this error log execute the following:

```sh
npm i @aries-framework/node
```
