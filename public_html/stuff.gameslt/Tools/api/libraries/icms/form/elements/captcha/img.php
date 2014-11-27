<?php
/**
 * Image Creation script
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
 * @category	ICMS
 * @package		Form
 * @subpackage	Elements
 * @author		Sina Asghari (aka stranger) <pesian_stranger@users.sourceforge.net>
 * @version		SVN: $Id: img.php 10681 2010-09-25 20:40:50Z skenow $
 */

include "../../../../../mainfile.php";
error_reporting(0);
icms::$logger->activated = FALSE;

$image_handler = icms::handler('icms_form_elements_captcha_Image');
$image_handler->loadImage();