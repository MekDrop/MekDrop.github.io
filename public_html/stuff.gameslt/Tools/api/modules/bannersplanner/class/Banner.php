<?php
class mod_bannersplanner_Banner extends icms_ipf_Object {

	/**
	 * Constructor
	 *
	 * @param object $handler ContactPostHandler object
	 */
	public function __construct(& $handler, $data = array()) {

				$this->quickInitVar('banner_id', self::DTYPE_INTEGER, true);		
                $this->quickInitVar('type', self::DTYPE_INTEGER, true);
                $this->quickInitVar('platform', self::DTYPE_STRING, false);
                $this->quickInitVar('game', self::DTYPE_STRING, false); 
                $this->quickInitVar('game_id', self::DTYPE_INTEGER, false); 
                $this->quickInitVar('name', self::DTYPE_STRING, true);
                $this->quickInitVar('url', self::DTYPE_STRING, false);
                $this->quickInitVar('notify_email', self::DTYPE_STRING, false);
				$this->quickInitVar('size', self::DTYPE_INTEGER, true);
                $this->quickInitVar('image', self::DTYPE_STRING, true);
				$this->quickInitVar('social_message', self::DTYPE_STRING, true);
				$this->quickInitVar('social_image', self::DTYPE_STRING, true);

				$this->setVarInfo('image', self::VARCFG_MAX_LENGTH, 2197000);
				$this->setVarInfo('social_image', self::VARCFG_MAX_LENGTH, 2197000);

				parent::__construct($handler, $data);

	}
	
}
