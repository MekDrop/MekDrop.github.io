var app = require('express')();

app.get('/', function (req, res) {
  res.send('mekdrop.name.api')
})

var server = app.listen(3157, function () {

  var host = server.address().address
  var port = server.address().port

  console.log('App listening at http://%s:%s', host, port)

})