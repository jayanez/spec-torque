import manifest from '../package.json' with { type: 'json' };

export const PRODUCT_VERSION = manifest.version;
