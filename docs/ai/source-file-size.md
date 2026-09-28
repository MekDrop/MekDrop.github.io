# Source File Size

ESLint warns when a JavaScript or Vue source file under `src/` grows past 1,000 nonblank, noncomment lines. This is an advisory limit: use the warning as a prompt to split a module when that improves cohesion, not as a reason to fragment related code.

Files that were already over the limit when the rule was introduced are listed in `oversizedSourceFileExemptions` in `eslint.config.js`. These are temporary baseline exemptions. Remove each entry after its file has been reduced below the limit; do not add exemptions for new files.
