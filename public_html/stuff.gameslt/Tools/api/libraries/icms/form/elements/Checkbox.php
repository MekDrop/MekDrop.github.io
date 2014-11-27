<?php
/**
 * Creates a checkbox form attribut
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Form
 * @subpackage	Elements
 * @version	$Id: Checkbox.php 11420 2011-10-25 03:14:27Z skenow $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");


/**
 * One or more Checkbox(es)
 *
 * @category	ICMS
 * @package     Form
 * @subpackage  Elements
 *
 * @author	Kazumi Ono	<onokazu@xoops.org>
 */
class icms_form_elements_Checkbox extends icms_form_Element {

	/**
	 * Available options
	 * @var array
	 */
	private $_options = array();

	/**
	 * pre-selected values in array
	 * @var	array
	 */
	private $_value = array();

	/**
	 * HTML to separate the elements
	 * @var	string
	 */
	private $_delimeter;

	/**
	 * Constructor
	 *
	 * @param	string  $caption
	 * @param	string  $name
	 * @param	mixed   $value  Either one value as a string or an array of them.
	 */
	public function __construct($caption, $name, $value = null, $delimeter = "&nbsp;") {
		$this->setCaption($caption);
		$this->setName($name);
		if (isset($value)) {
			$this->setValue($value);
		}
		$this->_delimeter = $delimeter;
	}

	/**
	 * Get the "value"
	 *
	 * @param	bool    $encode   Would you like to sanitize the text?
	 * @return	array
	 */
	public function getValue($encode = false) {
		if (!$encode) {
			return $this->_value;
		}
		$value = array();
		foreach ($this->_value as $val) {
			$value[] = $val ? htmlspecialchars($val, ENT_QUOTES) : $val;
		}
		return $value;
	}

	/**
	 * Set the "value"
	 *
	 * @param	array
	 */
	public function setValue($value) {
		$this->_value = array();
		if (is_array($value)) {
			foreach ($value as $v) {
				$this->_value[] = $v;
			}
		} else {
			$this->_value[] = $value;
		}
	}

	/**
	 * Add an option
	 *
	 * @param	string  $value
	 * @param	string  $name
	 */
	public function addOption($value, $name = "") {
		if ($name != "") {
			$this->_options[$value] = $name;
		} else {
			$this->_options[$value] = $value;
		}
	}

	/**
	 * Add multiple Options at once
	 *
	 * @param	array   $options    Associative array of value->name pairs
	 */
	public function addOptionArray($options) {
		if (is_array($options)) {
			foreach ($options as $k => $v) {
				$this->addOption($k, $v);
			}
		}
	}

	/**
	 * Get an array with all the options
	 *
	 * @param	int     $encode     To sanitize the text? potential values: 0 - skip; 1 - only for value; 2 - for both value and name
	 * @return	array   Associative array of value->name pairs
	 */
	public function getOptions($encode = false) {
		if (!$encode) {
			return $this->_options;
		}
		$value = array();
		foreach ($this->_options as $val => $name) {
			$value[$encode
					? htmlspecialchars($val, ENT_QUOTES)
					: $val]
					= ($encode > 1)
						? htmlspecialchars($name, ENT_QUOTES)
						: $name;
		}
		return $value;
	}

	/**
	 * Get the delimiter of this group
	 *
	 * @param	bool    $encode To sanitizer the text?
	 * @return	string  The delimiter
	 */
	public function getDelimeter($encode = false) {
		return $encode
				? htmlspecialchars(str_replace('&nbsp;', ' ', $this->_delimeter))
				: $this->_delimeter;
	}

	/**
	 * prepare HTML for output
	 *
	 * @return    string
	 */
	public function render() {
		$ele_name = $this->getName();
		$ele_value = $this->getValue();
		$ele_options = $this->getOptions();
		$ele_extra = $this->getExtra();
		$ele_delimeter = $this->getDelimeter();
		$extra = '';
		$ret = '';

		$classes = $this->isRequired() ? 'required ' : '';
		$classes .= get_class($this);

		if (count($ele_options) > 1 && substr($ele_name, -2, 2) != "[]") {
			$ele_name = $ele_name . "[]";
			$this->setName($ele_name);
		}
		foreach ($ele_options as $value => $name) {
			$ret .= "<span class='icms_checkboxoption'><label for='" . $ele_name . "_item_" . $value . "'>";
			$ret .= "<input type='checkbox' class='".$classes."' name='" . $ele_name;
			$ret .= "' id='" . $ele_name . "_item_" . $value . "' value='" . htmlspecialchars($value, ENT_QUOTES) . "'";
			if (count($ele_value) > 0 && in_array($value, $ele_value)) {
				$ret .= " checked='checked'";
			}
			$ret .= $ele_extra . " />" . $name . $ele_delimeter . "</label></span>";
		}
		if (count($ele_options) > 1) {
			$extra .= "<div class='checkemallWrapper'><div class='inner'>";
			$extra .= "<span class='icms_checkboxoption'><label for='" 
				. $ele_name . "_checkemall'><input type='checkbox' id='" 
				. $ele_name	. "_checkemall' class='checkemall' />" . _CHECKALL . "</label></span>";
			$extra .= "</div></div>";
		}

		if($ret != '') {
			return '<div class="grouped"><div class="inner">' . $ret . '</div>' . $extra . '</div>';
		} else {
			return;
		}
	}
}