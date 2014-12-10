class Controller

Controller.instances = {}

Controller.register = (app) ->
  Controller.instances[@name] = new @()
  fnargs = require('fn-args')
  for f of Controller.instances[@name]
    continue if f is 'constructor'
    Object.defineProperty Controller.instances[@name][f], 'args',
      value: fnargs(Controller.instances[@name][f])
      writable: false
      configurable: false
      enumerable: true
    Object.defineProperty Controller.instances[@name][f], 'parent',
      value: @
      writable: false
      configurable: false
      enumerable: true
    Controller.instances[@name][f].parseParams = (req) ->
      args = []
      for arg of Controller.instances[@name][f].args
        args.push req.params[arg]
      args
    Controller.instances[@name][f].callAsAction = (req) ->
      @apply @parent, @parseParams(req)
    
    request = '/' + @name
    p = ''
    i = 0
    if Array.isArray(Controller.instances[@name][f].args) and Controller.instances[@name][f].args.length > 0
      p += Controller.instances[@name][f].args.join('/:')
    name = @name
    switch f
      when 'delete', 'put', 'get', 'post'
        request += '/' + p
        app[f] request, (req, res) ->
          console.log name
         # Controller.instances[name][f].callAsAction req
      else
        request += '/' + f + p
        app.get request, (req, res) ->
          Controller.instances[name][f].callAsAction req
        
    console.info 'Registered route ' + request
    
module.exports = Controller