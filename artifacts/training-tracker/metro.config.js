const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite loads its web implementation from a bundled WASM asset.
config.resolver.assetExts.push('wasm');

module.exports = config;
