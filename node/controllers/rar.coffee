class RAR extends require '../abstract/controller.coffee'

  get: ->
    res.send('mekdrop.name.api')

  hideInImage: (req, res) ->
    

module.exports = RAR