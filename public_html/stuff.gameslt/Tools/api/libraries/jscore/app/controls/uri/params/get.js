define(function () {    

    var app = function () {
            // based on http://snipplr.com/view/11455/parse-locationsearch/
            var parameters, cx, query;
            
            if (!arguments[0])
                query = location.search;
            else
                query = arguments[0];

            parameters = query.split(/[&?]/);

            for (cx = 0; cx < parameters.length; cx++) {
                parameters[cx] = parameters[cx].split("=");
                if (parameters[cx].length < 2) //Drop "" or /[A-Za-z]\w*=$/
                    parameters.splice(cx--, 1);
            }

            while (parameters.length) {
                parameter = parameters.shift();
                if (!parameters[parameter[0]])
                    parameters[parameter[0]] = [];
                parameters[parameter.shift()].push( parameter.shift() ); //p=1&p=2&p=3 -> parameters.p = [1, 2, 3]
            }
            return parameters;
        };

    return app;

});
