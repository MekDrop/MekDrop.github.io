define(['jquery', 'when'], function ($, when) {
    return function (field, minWidth, minHeight) {
		field = $(field);
        return when.promise(function (resolve, reject, notify) {            
            if (typeof (field.get(0).files) == 'undefined') {
                reject('old-browser');
				$(field).val('');
            } else {
                var file = field.get(0).files[0];
                var fr = new FileReader();
                fr.onload = function () {
                    image = new Image();
                    image.onerror = function () {
                        reject('cant-read-image');
						$(field).val('');
                    };
                    image.onload = function () {
                        if (image.width < minWidth) {
                            reject('image-width-too-small');
							$(field).val('');
                        } else if (image.height < minHeight) {
                            reject('image-height-too-small');
							$(field).val('');
                        } else {
	                        resolve(image);
						}
                    };
                    image.src = fr.result;
                };
                try {
                    fr.readAsDataURL(file);
                } catch (ex) {
                    reject(ex);
					$(field).val('');
                }
            }
        });/*.catch(function (e) {
            $(field).val('');
        });*/
    }
});