class Express extends require '../abstract/boot.coffee'

  create: (endFunc) ->
    endFunc()

module.exports = Express