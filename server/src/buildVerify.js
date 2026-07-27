// Pure so it's testable without a DB: given the extension_builds row (or
// undefined if the version was never released) and the hash the service
// worker reported, is this install running exactly what was reviewed?
function isVerifiedBuild(releasedBuild, reportedHash) {
  return Boolean(releasedBuild && releasedBuild.build_hash === reportedHash);
}

module.exports = { isVerifiedBuild };
