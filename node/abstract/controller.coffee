class Controller

Controller.instances = {}

Controller.register = (app) ->
  Controller.instances[@name] = new @()
  for f of Controller.instances[@name]
    continue if f is 'constructor'
    s = Controller.instances[@name][f].toString()
    args = s.slice(s.indexOf('(') + 1, s.indexOf(')')).match(/([^\s,]+)/g)
    request = '/' + @name
    p = ''
    i = 0
    if Array.isArray(args) and args.length > 0
      while i < args.length
        p += '/:' + args[i++]
    switch f
      when 'delete', 'put', 'get', 'post'
        request += '/' + p
        app[f] request, Controller.instances[@name][f]
      else
        request += '/' + f + p
        app.get request, Controller.instances[@name][f]
        
    console.info 'Registered route ' + request
    
module.exports = Controller