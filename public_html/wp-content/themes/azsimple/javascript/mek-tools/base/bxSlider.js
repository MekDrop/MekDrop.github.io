define(['jQuery','bxSlider'], function (jQuery, bxSlider) {
	$(document).ready(function(){
		$('#featured-posts-list').bxSlider({
			pager: true,
			pagerSelector: '#featured-posts-pages',
			controls: false
		});
	})
});