const path = require('path-browserify')
const cache = {}

function importAll (r) {
  r.keys().forEach((key) => {
    const lang = path.basename(path.dirname(key))
    const section = path.basename(key, '.yml')

    if (typeof cache[lang] === 'undefined') {
      cache[lang] = {}
    }

    cache[lang][section] = r(key).default
  })
}

importAll(require.context('yaml-loader!' + __dirname, true, /\.yml$/))

console.log(cache)

export default {}
