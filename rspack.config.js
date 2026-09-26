const { defineConfig } = require('@meteorjs/rspack');

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the `Meteor` object, such as:
 * - `Meteor.isClient` / `Meteor.isServer`
 * - `Meteor.isDevelopment` / `Meteor.isProduction`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */
module.exports = defineConfig(Meteor => {
  // discord.js's optional native add-ons are compiled in the production image
  // (see Dockerfile); keep them out of the server bundle and require them at runtime.
  if (Meteor.isServer) {
    return { externals: ['zlib-sync', 'bufferutil', 'utf-8-validate'] };
  }
  // The bot is server-only. In test mode the client bundle still reaches
  // server/main.ts through the test imports, so stub discord.js out there.
  return { resolve: { alias: { 'discord.js': false } } };
});
