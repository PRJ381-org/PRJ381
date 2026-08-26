/**
 * Stops the in-memory MongoDB, and - if there never was one - prints the skip
 * banner LAST, where it is actually read.
 *
 * The point of shouting here is that a passing suite must not be mistaken for a
 * verified data layer. Batch inserts, duplicate tolerance and lead source
 * mapping are the things most likely to be wrong, and they are exactly the
 * things that cannot be checked without a database.
 */
module.exports = async () => {
  if (globalThis.__MONGOD__) {
    await globalThis.__MONGOD__.stop();
    return;
  }

  const line = '='.repeat(74);
  process.stderr.write(
    `\n${line}\n` +
      '  DATABASE-BACKED TESTS DID NOT RUN - THIS SUITE IS NOT FULLY VERIFIED\n' +
      `${line}\n` +
      `  Reason: ${process.env.TEST_MONGO_SKIP_REASON || 'no in-memory MongoDB available'}\n` +
      '\n' +
      '  Unverified in this run:\n' +
      '    - batch insert persistence and counts\n' +
      '    - duplicate-key tolerance / retry idempotency\n' +
      '    - lead source derivation against stored documents\n' +
      '\n' +
      '  Fix with:  npm install   (fetches the mongod binary once)\n' +
      `${line}\n\n`
  );
};
