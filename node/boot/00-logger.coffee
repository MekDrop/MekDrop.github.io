class Logger extends require '../abstract/boot.coffee'

  launch: (endFunc) ->
    @extend require('log4js')
    @replaceConsole()
    endFunc()

module.exports = Logger