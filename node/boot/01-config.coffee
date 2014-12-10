class Config extends require '../abstract/boot.coffee'

  launch: (endFunc) ->
    @load @getEnviroment()
    endFunc()
    
  getEnviroment: ->
    if typeof process.env.NODE_ENV is 'undefined' then 'default' else process.env.NODE_ENV
    
  getINIPath: (env) ->
    './config/' + env + '.ini'
    
  get: (name, _default) ->
    parts = name.split('.')
    i = 0
    v = @
    while i < parts.length
      v = v[parts[i]]
      if typeof v is 'undefined'        
        return _default
      i++
    v

  load: (enviroment) ->
    fs = require('fs')
    ini = require('ini')
    filename = @getINIPath(enviroment)
    @extend ini.parse(fs.readFileSync(filename, 'utf-8'))
    
  save: (enviroment) ->
    fs = require('fs')
    ini = require('ini')
    filename = @getINIPath(enviroment)
    config = {}
    for c of @
      continue if ['launch', 'getEnviroment', 'getINIPath', 'load', 'save', 'get'].indexOf(c) > -1
      config = @[c]
    fs.writeFileSync(filename, ini.stringify(config))
    
module.exports = Config