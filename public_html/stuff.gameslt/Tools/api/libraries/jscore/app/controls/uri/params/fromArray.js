define(function () {    

    var app = function (pArray) {
            var ret = {};
            for(i = 0; i < pArray.length; i++)
                for (var k in pArray[i]) 
                    ret[k + '[' + i.toString() + ']'] = pArray[i][k];
            return ret;
        };

    return app;

});
