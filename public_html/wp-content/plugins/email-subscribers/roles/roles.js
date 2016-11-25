function _es_addroles()
{
	if(document.form_addemail.es_email_mail.value=="")
	{
		alert(es_roles_notices.es_roles_email_address);
		document.form_addemail.es_email_mail.focus();
		return false;
	}
	else if(document.form_addemail.es_email_status.value=="" || document.form_addemail.es_email_status.value=="Select")
	{
		alert(es_roles_notices.es_roles_email_status);
		document.form_addemail.es_email_status.focus();
		return false;
	}
	else if( (document.form_addemail.es_email_group.value == "") && (document.form_addemail.es_email_group_txt.value == "") )
	{
		alert(es_roles_notices.es_roles_email_group);
		document.form_addemail.es_email_group.focus();
		return false;
	}
}

function _es_redirect()
{
	window.location = "admin.php?page=es-roles";
}

function _es_help()
{
	window.open("https://wordpress.org/plugins/email-subscribers/faq/");
}