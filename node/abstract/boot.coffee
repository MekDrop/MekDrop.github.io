class Boot

  extend: (obj) ->
    require('extend') @, obj
    
Boot.modules = {}
    
Boot.launch = (tasks) ->
  name = @name
  Boot.modules[name] = new @()
  Boot.modules[name].instance = Boot.modules[name]
  Object.defineProperty Boot.modules[name], 'module',
    get: () ->
      Boot.modules
  Object.defineProperty Boot.modules[name], 'instance',
    get: () ->
      Boot.modules[name]
  Boot.modules[@name].launch ->
    tasks.done()

module.exports = Boot