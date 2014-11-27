<?php


class mod_bannersplanner_BannerHandler extends icms_ipf_Handler {

	/**
	 * Constructor
	 */
	public function __construct(& $db) {
		parent::__construct($db, 'banner', 'banner_id', 'name', '', 'bannersplanner');
	}
	

}