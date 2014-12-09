class Server extends require '../abstract/boot.coffee'

  app: null

  launch: (endFunc) ->
    @app = require('express')()    
    server = @
    @extend @app.listen(3157, () ->
      host = server.address().address
      port = server.address().port
      console.log "App listening at http://%s:%s", host, port
      endFunc()
    )
        
#app.get('/', function (req, res) {
#  res.send('mekdrop.name.api')
#})

module.exports = Server