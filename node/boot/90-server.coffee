class Server extends require '../abstract/boot.coffee'

  app: null
  parser: null

  launch: (endFunc) ->
    @app = require('express')()
    @parser = require('multiparty')
    @app.use @createCompressionMiddlewareInstance()
    @app.use @createTimeoutMiddlewareInstance()
    @app.use @createResponseTimeMiddlewareInstance()
    @registerControllers()
    server = @
    @extend @app.listen(parseInt(@module.Config.get('server.port', 3157)), () ->
      host = server.address().address
      port = server.address().port
      console.log "App listening at http://%s:%s", host, port
      endFunc()
    )
    
  registerControllers: () ->
    files = require("fs").readdirSync("controllers").filter(@isCoffeeScriptFilter)
    i = 0
    while i < files.length
      require("../controllers/" + files[i++]).register @app
    
  isCoffeeScriptFilter: (file) ->
    require("path").extname(file) is ".coffee"
    
  createResponseTimeMiddlewareInstance: () ->
    require('response-time')()
    
  createTimeoutMiddlewareInstance: () ->
    require('connect-timeout')(
      @module.Config.get('server.timeout', '5s')
    )
    
  createCompressionMiddlewareInstance: () ->
    require('compression')(
      threshold: parseInt(@module.Config.get('server.compress.threshold', 512))
    )
    
        
#app.get('/', function (req, res) {
#  res.send('mekdrop.name.api')
#})

module.exports = Server