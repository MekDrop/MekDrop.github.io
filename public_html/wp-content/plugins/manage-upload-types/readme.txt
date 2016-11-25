=== Manage Upload Types ===
Contributors: jmadea
Donate link: http://madea.net/projects/
Tags: media, upload, filetypes, mimetypes
Requires at least: 3.3.1
Tested up to: 4.2.3
Stable tag: 1.3

This plugin adds a panel to the Settings->Media page, enabling changes to the file types which are permitted to be uploaded to the media library. 

== Description ==

Manage Upload Types enables an administrator to see and change the list of file types that are permitted as file uploads to the media library. This is accomplished by adding an ajax-driven table to a panel on the Media Settings page. Each row has a delete link. Confirmation is required for deletions. There is also a small form to allow additional rows to be added. The form is aligned with the table and contains two text entry boxes. The first is for a file extension or list of file extensions separated by pipe symbols ('|') and the second is for a MIME type to be associated with files that match one of those extensions.


== Installation ==

1. Unpack `manage-upload-types.zip` in your `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. View and change your allowed upload types in Settings->Media.

== Frequently Asked Questions ==

= Must I click "Save Changes" to finalize additions or deletions made to the allowed upload types? =

No. The Save Changes button is necessary to save changes mades to other options on the Settings->Media page, but the Manage Upload Types section is AJAX driven and changes are made immediately. 


== Screenshots ==

1. The Manage Upload Types section on the Settings->Media page in the administration interface.

== Changelog ==
= 1.3 = 
* Tested for compatibility with current WordPress versions and updated this file.

= 1.2 = 
* Fix for small bug introduced in 1.1. Please update.

= 1.1 = 
* Minor cosmetic issue resolved. 

= 1.0 = 
* Public release on wordpress.org

= 0.9 =
* Prepared for public release on wordpress.org

= 0.4 = 
* Bug fixes. 
* Nonces now being used. 

= 0.3 =
* Inline Javascript removed. 

= 0.2 =
* Inline styles replaced with css file, some js cleanup.

= 0.1 =
* Initial release, uploaded to github.

== Upgrade Notice ==

= 1.0 =
This is the first stable release. Pre-1.0 releases were for development and testing only. 
