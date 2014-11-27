<?php
/**
 * Administration of usergroups, functionfile
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @package		Administration
 * @subpackage	Groups
 * @version		SVN: $Id: groups.php 11719 2012-05-22 00:40:10Z skenow $
 */

if (!is_object(icms::$user) || !is_object($icmsModule) || !icms::$user->isAdmin($icmsModule->getVar('mid'))) {
	exit("Access Denied");
}

/**
 * Diplay groups and options/permissions
 */
function displayGroups() {
	icms_cp_header();
	echo '<div class="CPbigTitle" style="background-image: url(' . ICMS_MODULES_URL . '/system/admin/groups/images/groups_big.png)">' . _AM_EDITADG . '</div><br />';

	$member_handler = icms::handler('icms_member');
	$groups =& $member_handler->getGroups();
	echo "<table class='outer' width='40%' cellpadding='4' cellspacing='1'><tr><th colspan='2'>" . _AM_EDITADG . "</th></tr>";
	$count = count($groups);

	$gperm_handler = icms::handler('icms_member_groupperm');
	$ugroups  = (is_object(icms::$user)) ? icms::$user->getGroups() : array(ICMS_GROUP_ANONYMOUS);
	for ($i = 0; $i < $count; $i++) {
		$id = $groups[$i]->getVar('groupid');
		if ($gperm_handler->checkRight('group_manager', $id, $ugroups)) {
			echo '<tr><td class="head">' . $groups[$i]->getVar('name') . '</td>';
			echo '<td class="even"><a href="admin.php?fct=groups&amp;op=modify&amp;g_id=' . (int) $id . '">' . _AM_MODIFY . '</a>';
			if (ICMS_GROUP_ADMIN == $id || ICMS_GROUP_USERS == $id || ICMS_GROUP_ANONYMOUS == $id) {
				echo '</td></tr>';
			} else {
				echo '&nbsp;<a href="admin.php?fct=groups&amp;op=del&amp;g_id=' . (int) $id . '">' . _DELETE . '</a></td></tr>';
			}
		}
	}
	echo "</table><br />";
	$name_value = "";
	$desc_value = "";
	$s_cat_value = '';
	$a_mod_value = array();
	$r_mod_value = array();
	$ed_mod_value = array();
	$group_manager_value = array();
	$debug_mod_value = array();
	$r_block_value = array();
	$op_value = "add";
	$submit_value = _AM_CREATENEWADG;
	$g_id_value = "";
	$type_value = "";
	$form_title = _AM_CREATENEWADG;
	include ICMS_MODULES_PATH . "/system/admin/groups/groupform.php";
	icms_cp_footer();
}

/**
 * Modify settings for a group
 * @param int $g_id	Unique group ID
 */
function modifyGroup($g_id) {
	$userstart = $memstart = 0;
	if (!empty($_POST['userstart'])) {
		$userstart = (int) $_POST['userstart'];
	} elseif (!empty($_GET['userstart'])) {
		$userstart = (int) $_GET['userstart'];
	}
	if (!empty($_POST['memstart'])) {
		$memstart = (int) $_POST['memstart'];
	} elseif (!empty($_GET['memstart'])) {
		$memstart = (int) $_GET['memstart'];
	}
	icms_cp_header();
	echo '<div class="CPbigTitle" style="background-image: url(' . ICMS_MODULES_URL . '/system/admin/groups/images/groups_big.png)"><a href="admin.php?fct=groups">'. _AM_GROUPSMAIN .'</a>&nbsp;<span style="font-weight:bold;">&raquo;&raquo;</span>&nbsp;'. _AM_MODIFYADG . '</div><br />';

	$member_handler = icms::handler('icms_member');
	$thisgroup =& $member_handler->getGroup($g_id);
	$name_value = $thisgroup->getVar("name", "E");
	$desc_value = $thisgroup->getVar("description", "E");

	$moduleperm_handler = icms::handler('icms_member_groupperm');
	$a_mod_value = $moduleperm_handler->getItemIds('module_admin', $thisgroup->getVar('groupid'));
	$r_mod_value = $moduleperm_handler->getItemIds('module_read', $thisgroup->getVar('groupid'));
	$ed_mod_value = $moduleperm_handler->getItemIds('use_wysiwygeditor', $thisgroup->getVar('groupid'));
	$debug_mod_value = $moduleperm_handler->getItemIds('enable_debug', $thisgroup->getVar('groupid'));
	$group_manager_value = $moduleperm_handler->getItemIds('group_manager', $thisgroup->getVar('groupid'));

	$gperm_handler = icms::handler('icms_member_groupperm');
	$r_block_value = $gperm_handler->getItemIds('block_read', $g_id);
	$op_value = "update";
	$submit_value = _AM_UPDATEADG;
	$g_id_value = $thisgroup->getVar("groupid");
	$type_value = $thisgroup->getVar("group_type", "E");
	$form_title = _AM_MODIFYADG;
	if (ICMS_GROUP_ADMIN == $g_id) {
		$s_cat_disable = TRUE;
	}

	$s_cat_value = $gperm_handler->getItemIds('system_admin', $g_id);

	include ICMS_MODULES_PATH . "/system/admin/groups/groupform.php";
	$usercount = $member_handler->getUserCount(new icms_db_criteria_Item('level', 0, '>'));
	$membercount = $member_handler->getUserCountByGroup($g_id);
	if ($usercount < 200 && $membercount < 200) {
		// do the old way only when counts are small
		$mlist = array();
		$members =& $member_handler->getUsersByGroup($g_id, FALSE);
		if (count($members) > 0) {
			$member_criteria = new icms_db_criteria_Item('uid', "(" . implode(',', $members) . ")", "IN");
			$member_criteria->setSort('uname');
			$mlist = $member_handler->getUserList($member_criteria);
		}
		$criteria = new icms_db_criteria_Item('level', 0, '>');
		$criteria->setSort('uname');
		$userslist = $member_handler->getUserList($criteria);
		$users = array_diff($userslist, $mlist);
		$gMem = '<table class="table table-bordered">';
		  $gMem .= '<tr>';
		    $gMem .= '<th colspan="2">' . _AM_EDITMEMBER . '</th>';
		  $gMem .= '</tr>';
		  $gMem .= '<tr>';
		    $gMem .= '<td>';
		      $gMem .= '<form action="admin.php" method="post">';
		        $gMem .= '<fieldset>';
		        	$gMem .= '<div class="control-group">';
		        		$gMem .= '<label>' . _AM_NONMEMBERS . '</label>';
			          $gMem .= '<select name="uids[]" multiple="multiple">';
			          foreach ($users as $u_id => $u_name) {
			            $gMem .= '<option value="' . (int) $u_id . '">' . $u_name . '</option>';
			          }  
			          $gMem .= '</select>';
			        $gMem .= '</div>';
		          $gMem .= '<input type="hidden" name="op" value="addUser" />';
		          $gMem .= icms::$security->getTokenHTML();
		          $gMem .= '<input type="hidden" name="fct" value="groups" />';
		          $gMem .= '<input type="hidden" name="groupid" value="' . $thisgroup->getVar("groupid") .'" />';
		          $gMem .= '<input type="submit" name="submit" value="' . _AM_ADDBUTTON . '" />';          
		        $gMem .= '</fieldset>';
		      $gMem .= '</form>';
		    $gMem .= '</td>';

		    $gMem .=  '<td>';
		      $gMem .= '<form action="admin.php" method="post" />';
		        $gMem .= '<fieldset>';
		          $gMem .= ' <div class="control-group">';
		          	$gMem .= '<label>' . _AM_MEMBERS . '</label>';
		          	$gMem .= '<select name="uids[]" multiple="multiple">';
		          	foreach ($mlist as $m_id => $m_name) {
		            	$gMem .= '<option value="' . (int) $m_id . '">' . $m_name . '</option>';
		          	}
		          	$gMem .= '</select>';
		          $gMem .= '</div>';
		          $gMem .= '<input type="hidden" name="op" value="delUser" />';
		          $gMem .= icms::$security->getTokenHTML();
		          $gMem .= '<input type="hidden" name="fct" value="groups" />';
		          $gMem .= '<input type="hidden" name="groupid" value="' . $thisgroup->getVar("groupid") . '" />';
		          $gMem .= '<input type="submit" name="submit" value="' . _AM_DELBUTTON . '" />';
		        $gMem .= '</fieldset>';
		      $gMem .= '</form>';
		    $gMem .= '</td>';
		  $gMem .= '</tr>';
		$gMem .= '</table>';

		echo $gMem;
	} else {
		$members =& $member_handler->getUsersByGroup($g_id, FALSE, 200, $memstart);
		$mlist = array();
		if (count($members) > 0) {
			$member_criteria = new icms_db_criteria_Item('uid', "(" . implode(',', $members) . ")", "IN");
			$member_criteria->setSort('uname');
			$mlist = $member_handler->getUserList($member_criteria);
		}
		echo '<a href="' . ICMS_MODULES_URL . '/system/admin.php?fct=findusers&amp;group=' . (int) $g_id . '">' . _AM_FINDU4GROUP . '</a><br />';
		echo '<form action="admin.php" method="post"><table class="outer"><tr><th align="center">' . _AM_MEMBERS . '<br />';
		$nav = new icms_view_PageNav($membercount, 200, $memstart, "memstart", "fct=groups&amp;op=modify&amp;g_id=" . (int) $g_id);
		echo $nav->renderNav(4);
		echo "</th></tr><tr><td class='even' align='center'>"
		. "<input type='hidden' name='op' value='delUser' />"
		. "<input type='hidden' name='fct' value='groups' />"
		. "<input type='hidden' name='groupid' value='" . $thisgroup->getVar("groupid")
		. "' /><input type='hidden' name='memstart' value='" . $memstart
		. "' />" . icms::$security->getTokenHTML()
		. "<select name='uids[]' size='10' multiple='multiple'>";
		foreach ($mlist as $m_id => $m_name) {
			echo '<option value="' . (int) $m_id . '">' . $m_name . '</option>' . "\n";
		}
		echo "</select><br /><input type='submit' name='submit' value='" . _DELETE
		. "' /></td></tr></table></form>";
	}
	icms_cp_footer();
}
