const babel = require("@babel/core");

const pkg = require("../package.json");
const cache = require("./cache");
const transform = require("./transform");

const relative = require("./utils/relative");

const loaderUtils = require("loader-utils");

function subscribe(subscriber, metadata, context) {
  if (context[subscriber]) {
    context[subscriber](metadata);
  }
}

module.exports = function loader(source, inputSourceMap) {
  // Make the loader async
  const callback = this.async();

  const filename = this.resourcePath;

  const loaderOptions = loaderUtils.getOptions(this) || {};

  // Deprecation handling
  if ("forceEnv" in loaderOptions) {
    console.warn(
      "The option `forceEnv` has been removed in favor of `envName` in Babel 7.",
    );
  }
  if (typeof loaderOptions.babelrc === "string") {
    console.warn(
      "The option `babelrc` should not be set to a string anymore in the babel-loader config. " +
        "Please update your configuration and set `babelrc` to true or false.\n" +
        "If you want to specify a specific babel config file to inherit config from " +
        "please use the `extends` option.\nFor more information about this options see " +
        "https://babeljs.io/docs/core-packages/#options",
    );
  }

  // Set babel-loader's default options.
  const {
    sourceRoot = process.cwd(),
    sourceMap = this.sourceMap,
    sourceFileName = relative(sourceRoot, filename),
  } = loaderOptions;

  const programmaticOptions = Object.assign({}, loaderOptions, {
    filename,
    inputSourceMap: inputSourceMap || undefined,
    sourceRoot,
    sourceMap,
    sourceFileName,
  });
  // Remove loader related options
  delete programmaticOptions.cacheDirectory;
  delete programmaticOptions.cacheIdentifier;
  delete programmaticOptions.metadataSubscribers;

  if (!babel.loadPartialConfig) {
    throw new Error(
      `babel-loader ^8.0.0-beta.3 requires @babel/core@7.0.0-beta.41, but ` +
        `you appear to be using "${babel.version}". Either update your ` +
        `@babel/core version, or pin you babel-loader version to 8.0.0-beta.2`,
    );
  }

  const config = babel.loadPartialConfig(programmaticOptions);

  const options = config.options;

  const {
    cacheDirectory = null,
    cacheIdentifier = JSON.stringify({
      options,
      "@babel/core": transform.version,
      "@babel/loader": pkg.version,
    }),
    metadataSubscribers = [],
  } = loaderOptions;

  const done = (err, { code, map, metadata } = {}) => {
    if (err) return callback(err);

    // TODO: Babel should really provide the full list of config files that
    // were used so that this can also handle files loaded with 'extends'.
    if (typeof config.babelrc === "string") {
      this.addDependency(config.babelrc);
    }

    metadataSubscribers.forEach(subscriber => {
      subscribe(subscriber, metadata, this);
    });

    return callback(null, code, map);
  };

  if (cacheDirectory) {
    return cache(
      { source, options, transform, cacheDirectory, cacheIdentifier },
      done,
    );
  }

  return transform(source, options, done);
};
