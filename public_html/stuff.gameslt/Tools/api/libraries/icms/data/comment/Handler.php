<?php
/**
 * Core class for managing comments
 *
 * @category	ICMS
 * @package		Data
 * @subpackage	Comment
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 * @copyright 	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @version		SVN: $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * Comment handler class.
 *
 * This class is responsible for providing data access mechanisms to the data source
 * of comment class objects.
 *
 * @category	ICMS
 * @package		Data
 * @subpackage  Comment
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 */
class icms_data_comment_Handler extends icms_ipf_Handler {
    
        public function __construct(&$db) {
            parent::__construct($db, 'data_comment', 'com_id', 'com_title', 'com_text', 'icms', 'xoopscomments', 'com_id');
        }

	/**
	 * Get a list of comments
	 *
	 * @param   object  $criteria   {@link icms_db_criteria_Element}
	 *
	 * @return  array   Array of raw database records
	 **/
	public function getList($criteria = null, $limit, $start, $debug) {            
            $comments = parent::getList($criteria, $limit, $start, $debug);
            return array_keys($comments);		
	}

	/**
	 * Retrieves comments for an item
	 *
	 * @param   int     $module_id  Module ID
	 * @param   int     $item_id    Item ID
	 * @param   string  $order      Sort order
	 * @param   int     $status     Status of the comment
	 * @param   int     $limit      Max num of comments to retrieve
	 * @param   int     $start      Start offset
	 *
	 * @return  array   Array of {@link icms_data_comment_Object} objects
	 **/
	public function getByItemId($module_id, $item_id, $order = null, $status = null, $limit = null, $start = 0) {
		$criteria = new icms_db_criteria_Compo(new icms_db_criteria_Item('com_modid', (int) $module_id));
		$criteria->add(new icms_db_criteria_Item('com_itemid', (int) $item_id));
		if (isset($status)) {
			$criteria->add(new icms_db_criteria_Item('com_status', (int) ($status)));
		}
		if (isset($order)) {
			$criteria->setOrder($order);
		}
		if (isset($limit)) {
			$criteria->setLimit($limit);
			$criteria->setStart($start);
		}
		return $this->getObjects($criteria);
	}

	/**
	 * Gets total number of comments for an item
	 *
	 * @param   int     $module_id  Module ID
	 * @param   int     $item_id    Item ID
	 * @param   int     $status     Status of the comment
	 *
	 * @return  array   Array of {@link icms_data_comment_Object} objects
	 **/
	public function getCountByItemId($module_id, $item_id, $status = null) {
		$criteria = new icms_db_criteria_Compo(new icms_db_criteria_Item('com_modid', (int) $module_id));
		$criteria->add(new icms_db_criteria_Item('com_itemid', (int) $item_id));
		if (isset($status)) {
			$criteria->add(new icms_db_criteria_Item('com_status', (int) $status));
		}
		return $this->getCount($criteria);
	}

	/**
	 * Get the top {@link icms_data_comment_Object}s
	 *
	 * @param   int     $module_id
	 * @param   int     $item_id
	 * @param   strint  $order
	 * @param   int     $status
	 *
	 * @return  array   Array of {@link icms_data_comment_Object} objects
	 **/
	public function getTopComments($module_id, $item_id, $order, $status = null) {
		$criteria = new icms_db_criteria_Compo(new icms_db_criteria_Item('com_modid', (int) $module_id));
		$criteria->add(new icms_db_criteria_Item('com_itemid', (int) $item_id));
		$criteria->add(new icms_db_criteria_Item('com_pid', 0));
		if (isset($status)) {
			$criteria->add(new icms_db_criteria_Item('com_status', (int) $status));
		}
		$criteria->setOrder($order);
		return $this->getObjects($criteria);
	}

	/**
	 * Retrieve a whole thread
	 *
	 * @param   int     $comment_rootid
	 * @param   int     $comment_id
	 * @param   int     $status
	 *
	 * @return  array   Array of {@link icms_data_comment_Object} objects
	 **/
	public function getThread($comment_rootid, $comment_id, $status = null) {
		$criteria = new icms_db_criteria_Compo(new icms_db_criteria_Item('com_rootid', (int) $comment_rootid));
		$criteria->add(new icms_db_criteria_Item('com_id', (int) $comment_id, '>='));
		if (isset($status)) {
			$criteria->add(new icms_db_criteria_Item('com_status', (int) $status));
		}
		return $this->getObjects($criteria);
	}

	/**
	 * Update
	 *
	 * @param   object  &$comment       {@link icms_data_comment_Object} object
	 * @param   string  $field_name     Name of the field
	 * @param   mixed   $field_value    Value to write
	 *
	 * @return  bool
	 **/
	public function updateByField(&$comment, $field_name, $field_value) {
		$comment->unsetNew();
		$comment->setVar($field_name, $field_value);
		return $this->insert($comment);
	}

	/**
	 * Delete all comments for one whole module
	 *
	 * @param   int $module_id  ID of the module
	 * @return  bool
	 **/
	public function deleteByModule($module_id) {
		return $this->deleteAll(new icms_db_criteria_Item('com_modid', (int) $module_id));
	}

	/**
	 * Change a value in multiple comments
	 *
	 * @param   string  $fieldname  Name of the field
	 * @param   string  $fieldvalue Value to write
	 * @param   object  $criteria   {@link icms_db_criteria_Element}
	 *
	 * @return  bool
	 **/
	/*
	 function updateAll($fieldname, $fieldvalue, $criteria = null)
	 {
	 $set_clause = is_numeric($fieldvalue) ? $filedname.' = '.$fieldvalue : $filedname.' = '.$this->db->quoteString($fieldvalue);
	 $sql = 'UPDATE '.$this->db->prefix('xoopscomments').' SET '.$set_clause;
	 if (isset($criteria) && is_subclass_of($criteria, 'icms_db_criteria_Element')) {
	 $sql .= ' '.$criteria->renderWhere();
	 }
	 if (!$result = $this->db->query($sql)) {
	 return false;
	 }
	 return true;
	 }
	 */
}

