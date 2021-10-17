let langFiles = require.context('yaml-loader!../../translations/', false, /\.yml$/);

let results = {};

langFiles
    .keys()
    .forEach(
        function (e) {
            results[e.substr(2).replace(/([^\.]+)\.([a-z]+)/, '$1')] = langFiles(e);
        }
    );

export default results;