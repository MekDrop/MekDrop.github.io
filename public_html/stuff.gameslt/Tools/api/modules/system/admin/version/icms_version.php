<?php
/**
 * Versionchecker, versionfile
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @package		System
 * @subpackage	Version
 * @version	$Id: icms_version.php 11610 2012-02-28 03:53:55Z skenow $
 */

$modversion = array(
	'name' => _MD_AM_VRSN,
	'version' => "1.0",
	'description' => _MD_AM_VRSN_DSC,
	'author' => "marcan (marcan@impresscms.org)",
	'credits' => "The ImpressCMS Project",
	'help' => "",
	'license' => "GPL see LICENSE",
	'official' => 1,
	'image' => "version.gif",
	'hasAdmin' => 1,
	'adminpath' => "admin.php?fct=version",
	'category' => XOOPS_SYSTEM_VERSION,
	'group' => _MD_AM_GROUPS_SYSTEMTOOLS);