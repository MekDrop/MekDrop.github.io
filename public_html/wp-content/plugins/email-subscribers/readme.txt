=== Email Subscribers ===
Contributors: storeapps, niravmehta, Mansi Shah
Donate link: http://www.storeapps.org/
Author URI: http://www.storeapps.org/
Plugin URI: http://www.storeapps.org/
Tags: email, email sign-up, email marketing, email newsletter form, email signup, email widget, email newsletter, newsletter, newsletter form, newsletter marketing, newsletter plugin, newsletter sending, newsletter signup, newsletter widget, subscribe, subscribers, subscribe form, subscription, subscription form, subscription, plugin, send, sendmail, marketing, registration form, bulk, feedburner, form, iscrizione, list, mailup, signup, smtp, widget
Requires at least: 3.4
Tested up to: 4.5.1
Stable tag: 3.1.3
License: GPLv3

Add subscription form on website,send HTML newsletters to subscribers & automatically notify them about new blog posts once it gets published.

== Description ==

Email Subscribers is a fully featured newsletter plugin. It helps you achieve all your newsletter related tasks effectively in one single place.

Email Subscribers plugin has a separate page with the HTML editor. You can easily create HTML newsletters using this editor in around 5 minutes. You also have a separate page to select the include and exclude categories before sending each newsletter. You can quickly import/ export email addresses of registered users and commentators to the subscription list using the import-export option in the plugin.

Email Subscribers plugin also has a subscription box and it allows users to publicly subscribe by submitting their email addresses. You can add the subscription box to your site using

*   Shortcode for any posts or pages

`[email-subscribers namefield="YES" desc="" group="Public"]`

*   Widget option

Go to Dashboard->Appearance->Widgets. Drag and drop the Email Subscribers widget to your sidebar location.

*   Add directly in the theme

`<?php es_subbox( $namefield = "YES", $desc = "", $group = "" ); ?>`

### Main advantages

1. Easily **collect emails by adding a subscription form** to your sidebar (using widget), post (using shortcode) or theme file (using php code)
2. **Send beautifully crafted HTML newsletters** and send them to your subscribers. Either manually (or schedule it)
3. Send notifications **newsletters notifying your subscribers about the newly published post on your blog**
4. **Auto generate latest available posts in the blog and send to your subscribers via cron job**

### Plugin Features

*   Send **notification emails** to subscribers when **new posts are published**.
*   Option to **schedule mail (Cron job option)** or **send them manually**.
*   **Collect customer emails by adding a subscription box (Widget/Shortcode/PHP Code)**.
*   **Double opt-in and single opt-in** facility for subscribers.
*   **Email notification** to admin when user **signs up** (Optional).
*   **Automatic welcome mail** to subscribers (Optional).
*   **Unsubscribe link** in the mail.
*   **Import/Export subscribers emails**.
*   **HTML editor** to compose newsletters.
*   Send newsletters.
*   **Alphabetized list** in send mail page.
*   Sent **mail status** and when it was viewed.
*   Support **localization or internationalization**.
*   **Include/exclude categories** while sending a newsletter.
*   **Ability to control user access** (Roles and Capabilities).

### Use Email Subscribers with it's Free Addon

Use Email Subscribers with it's free Addon - [Email Subscribers Advanced Form](https://wordpress.org/plugins/email-subscribers-advanced-form/).
It will extend Email Subscribers Form functionality by providing an option to your users to select interested group in the Subscribers Form.

### Read what clients have to say:

> As many of my subscribers won't be too technical with computers, or use facebook/twitter etc., I was looking for a plug in that would be easy to use from a subscribers point of view. This works very well - the subscriber doesn't have to mess about with member settings and completing a profile etc, or have to opt out of categories, tags and such...they only have to enter their name and email address in a widget or page where the shortcode has been placed, then later click a link in a confirmatory email, and they're all set up to receive new posts updates. SIMPLE and effective. Well done to the developer, this is great as it's flexible and easy for the webmaster to set up and customise, but more importantly it's end user friendly.
> - [RegTheDonk](https://wordpress.org/support/topic/nice-1139)

And here's another customer's review:

> I have tried quite a few subscribe by email type plugins and this by far blows them all out of the water. Beautiful emails and and great backend design for the admin. This works so nice and works well with SMTP solutions
> - [Mike Price](https://wordpress.org/support/topic/best-email-subscriber-plugin)

And one more:

> This works very well indeed... It does all the necessary things for a newsletter/email list(s)... It is simple, clean, easy to engage, and looks good... I was also easily able to do some styling on the input forms by adding its widget css into my child's style.css file and add and/or change some properties and values... Thanks much for making this available and staying on top of it... :-)
> - [crzyhrse](https://wordpress.org/support/topic/very-well-indeed)

### Help Fellow WordPressers by Writing a Review

If you like Email Subscribers, please leave a **five star** review on WordPress. That helps fellow website owners assess Email Subscribers easily and benefit from it!

### Translators

* Turkish (tr_TR) - Dr Abdullah Manaz
* Tamil (ta) - Gopi Ramasamy
* Dutch (nl_NL) - John van Halderen
* Dutch (nl_NL_2) - Paul't Hoen
* Serbian (sr_RS) - Ogi Djuraskovic
* German (de_DE) - Stefanie Drucker , Vineet Talwar
* Russian (ru_RU) - everyonesdesign
* Polish (pl) - Abdul Sattar

**Note**: Translations of above language files are not updated w.r.t Email Subscribers version 3.1. If you have updated translation files of the same language, then please write to us from [here](http://www.storeapps.org/support/contact-us/) so we can update it.

== Installation ==

Option 1:

1. Go to WordPress Dashboard->Plugins->Add New
2. Search Email Subscribers plugin using search option
3. Find the plugin and click Install Now button
4. After installation, click on Activate Plugin link to activate the plugin.

Option 2:

1. Download the plugin email-subscribers.zip
2. Unpack the email-subscribers.zip file and extract the email-subscribers folder
3. Upload the plugin folder to your /wp-content/plugins/ directory
4. Go to WordPress dashboard, click on Plugins from the menu
5. Locate the Email Subscribers plugin and click on Activate link to activate the plugin.

Option 3:

1. Download the plugin email-subscribers.zip
2. Go to WordPress Dashboard->Plugins->Add New
3. Click on Upload Plugin link from top
4. Upload the downloaded email-subscribers.zip file and click on Install Now
5. After installation, click on Activate Plugin link to activate the plugin.

== Frequently Asked Questions ==

= 1. Notification Emails are not being received by Subscribers? =

Plugin Settings :

* Make sure you are using latest version of Email Subscribers.
* Then make sure that you have followed all the steps listed here : [Configure notification email to subscribers when new posts are published](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-notifications-settings/).
* Also check that the new post that you are publishing, that category is checked under the Notification tab. Because if that category is not checked, then post published to that category won't be send to subscribers.
* Also, just for testing, create one sample notification and try sending it to 1 or 2 subscribers (including yourself) and then check if you are receiving the emails or not.
* If you are sending emails using Cron, then in Cron, initially you can send only 50 emails per hour and this value can be changed from WordPress Dashboard -> Email Subscribers -> Cron Mail -> Cron Count.
* You can also ask your Subscriber's to check in their SPAM/JUNK folder as the emails might be ending up there.

Host/Server End Settings :

Sometimes, there is a delay of sending emails from the server due to excess number of emails being send. Have a check with your Host Provider / System Administrator if
* the emails are being send, by checking in the email log file
* the emails are getting bounced back from the server
* your host provider has not blocked email domains to whom you are sending notifications

If your Host Provider is blocking the emails that you are sending, then try sending emails in Plain Text format instead of HTML format (setting available inside plugin) and check.
If your Host Provider is not blocking the emails that you are sending and you are getting emails successfully send notice and record of emails send in email log file also, then there is a possibility that your Subscriber's Host Provider is blocking the emails.

Refer more from [here](http://www.gopiplus.com/work/2014/08/17/mail-not-working-on-email-subscribers-wordpress-plugin/).

= 2. How to add unsubscribe link in welcome email? =

Please make sure Email Subscribers version is 3.1.2+. Then go to WordPress -> Email Subscribers -> Settings -> Subscriber welcome mail content.
Add the following code at the end of welcome email content :

`Please <a href='###LINK###'>click here</a> to unsubscribe.`

& then click on Save Settings button.

= 3. How to change/update/translate any strings from the plugin? =

Email Subscribers has a POT file named email-subscribers.pot present at /wp-content/plugins/email-subscribers/languages/. Use that with [Loco Translate](https://wordpress.org/plugins/loco-translate/) plugin and change/update/translate any text that you want. Refer steps from [here](http://www.storeapps.org/support/documentation/translating-storeapps-plugins/).

= 4. Add subscription box in your website =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-subscription-box/).

= 5. How to Import and export email address to subscribers list? =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-subscriber-management-and-import-and-export-email-address/).

= 6. How to compose static newsletters? =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-compose-html-emails/).

= 7. How to modify Opt-in mail, Welcome mail, Admin mail contents =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-general-settings/).

= 8. How to send static newsletter manually? =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-send-email-newsletters/).

= 9. Where to check sent mails? =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-send-email-newsletters/).

= 10. How to configure notification email to subscribers when new posts are published =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-notifications-settings/).

= 11. How to add new subscribers group? =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-subscriber-management-and-import-and-export-email-address/).

= 12. Does plugin contain bulk update option for subscribers group? =

Refer [here](http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-subscriber-management-and-import-and-export-email-.address/).

= 13. How to install and activate Email Subscribers on multisite installation blogs? =

Refer [here](http://www.gopiplus.com/work/2014/08/31/email-subscribers-wordpress-plugin-network-activation-for-multisite-installation/).

= 14. Schedule auto mails/Cron mails =

Refer [here](http://www.gopiplus.com/work/2015/08/08/email-subscribers-wordpress-plugin-how-to-schedule-auto-mails-cron-mails/).

= 15. Schedule auto emails for Email Subscribers in cPanel =

Refer [here](http://www.gopiplus.com/work/2015/08/04/how-to-schedule-auto-emails-for-email-subscribers-wordpress-plugin-in-cpanel/)?.

= 16. Schedule auto emails for Email Subscribers in Parallels Plesk =

Refer [here](http://www.gopiplus.com/work/2015/08/02/how-to-schedule-auto-emails-for-email-subscribers-wordpress-plugin-in-parallels-plesk/).

= 17. Add Group Selection in front end subscription box =

Refer [here](http://www.gopiplus.com/work/2015/09/24/email-subscribers-advanced-form-wordpress-plugin/).

= How to install and activate the plugin? and How to setup subscription box widget?﻿ =

[youtube http://www.youtube.com/watch?v=xTlvNCTF46k]

= How to compose Newsletter and How to Send Newsletter Emails to subscribers? =

[youtube http://www.youtube.com/watch?v=_Gwxvs9oAIs]

= How to setup notification mail when news posts are published in the blog? =

[youtube http://www.youtube.com/watch?v=-qd4HvXRW7k]

= How to Import & Export email address? =

[youtube http://www.youtube.com/watch?v=SZEJCijAS1o]

== Screenshots ==

1. Front Page - Subscription box

2. Subscribers Management Admin page

3. Compose Mail Admin page

4. Notification Management Admin page

5. Send Mail Admin page

6. Cron Job Detailes Admin page (Schedule mail)

7. Settings Admin page

8. Roles and Capabilities Management Admin page

9. Sent Mails Admin page

10. Delivery Report Admin page

== Changelog ==

= 3.1.3 =

* New: Added form tag to subscribe form
* Fix: Added missing charset to meta tag
* Update: Moved javascripts to footer
* Update: Translation for Serbian (sr_RS) language updated (Thanks to Ogi Djuraskovic)
* Update: Updated POT file

= 3.1.2 =

* New: You can now include Unsubscribe link in Welcome Email (Email Subscribers v3.1.2+)
* New: Welcome Page on activating Email Subscribers
* Fix: Shortcode not showing error messages upon user subscription
* Fix: Show full sized featured image when using ###POSTIMAGE### shortlink
* Fix: Can't edit settings in admin panel if SSL is enabled
* Update: Revised the FAQ's in Help & Info page inside plugin
* Update: Text correction in few places
* Update: Updated POT file
* Tweak: Do not allow admin to edit Subscribe, Unsubscribe link in admin settings

= 3.1.1 =

* Fix: call_user_func_array() expects parameter 1 to be a valid callback, function 'es_admin_option' not found or invalid function name
* Fix: Incorrect plugin name in admin dashboard
* Fix: Warnings in console on submitting subscription form in Chrome
* Update: Revised Help & Info page inside plugin
* Update: Added translation for missing texts
* Update: Updated POT file
* Tweaks: Minor tweaks

= 3.1 =

* New: Scripts and styles are now localized and can be translated
* Fix: Subscribe button not visible correctly in Chrome
* Update: Added POT file

= 3.0.1 =

* New contributor name has been added successfully.

= 3.0 =

* Tested upto 4.4

= 2.9.2 =

* Add-on plugin available for advanced subscribers form (Users can select interested group in subscribers form).
* Polish language file added in the language directory.
* Text Domain slug has been added for Language Packs.

= 2.9.1 =

* Fixed cross-site scripting vulnerabilities and a potential SQL injection.

= 2.9 =

* Tested upto 4.3
* Option available to add same email address to multiple group name
* Cron Mail option added. With this option you can schedule cron jobs for newsletter and notification emails. Using this cron option you can schedule mail (example 100 mails per hour)
* Group Name added in the export list.
* Mail Type option has been added in the Send Mail admin page. With this option you can add the mails into cron job or you can send the mail immediately.
* Notification Status option has been added in the notification setup page. With this option you can add notification mails into cron job or you can send the mail immediately when new post is published.
* Group name filter has been added in the subscriber admin page.

= 2.8 =

* Tested upto 4.2
* Fixed warning message bug on Roles page
* Sync Email option has been added in the subscribers admin page. with this option all newly registered email address will be synced automatically into the plugin subscribers group.

= 2.7 =

* Up to plugin version 2.6 only administrator level users can manage this plugin in dashboard. From this version I have introduced new feature  called Roles. The user role can be selected using this Roles Menu. For example, If you want to give Send Email feature to Editor. Go to plugin Roles menu using administrator login and select Editor role to Send Email Menu, So that your Editor level user can access plugin Send Email menu to publish newsletter emails.

= 2.6 =

* Added new option in the Email Import page to select Email Status and Email Group. with this option you can select (or create) group name and emails status when you import the email address.

= 2.5 =

* Now plugin supports custom post type. i.e. With this plugin, you can able to send automatic newsletter/notification emails when you publish custom posts.

= 2.4 =

* Tested upto 4.1
* Fixed special character bug on Sender of Notification FROM email name.

= 2.3 =

* This warning issue has been fixed (Warning: call_user_func_array() expects parameter 1 to be a valid callback, function 'es_admin_option' not found or invalid function name)

= 2.2 =

* Warning message issue has been fix on notification mails. previously $post object was submitted to notification mail method without filtering post_id.
* Added new keywords ###POSTLINK-ONLY###, ###POSTLINK-WITHTITLE### for notification mail content.
	###POSTLINK-ONLY### 		- Use this key word to add post link in the mail content (Post link cannot be clickable)
	###POSTLINK-WITHTITLE### 	- Use this key word to display post link with title (Clickable post title)
	###POSTLINK### 				- Use this key word to display clickable post link.

= 2.1 =

* In view subscribers admin page, Filter option and paging moved to the top right corner (Previous version it was in bottom).
* Plugin tested for multisite installation blogs.

= 2.0 =

* Tested up to WordPress 4.0
* In view subscribers admin page, new option added to filter the email address based on status.
* Paging option added on view subscribers admin page. In default it will show only first 200 emails, you have drop down box to navigate another page (i.e. 201 to 400 emails etc..).
* Warning message fix on email address import page (i.e Strict standards: Only variables should be passed by reference)	- Fixed

= 1.9 =

* New option added in admin setting page to update Sent Mail Report  Subject/Content. For each newsletter mail and notification mail, plugin will send one report mail to admin with default content. Now with this option, admin can update that default mail content.

= 1.8 =

* Bug fixed on Double Opt-In welcome mail check (Previously it was not checking admin setting for welcome mail).
* Tested up to WordPress 3.9.2

= 1.7 =

* Bug fixed on individual subscriber delete option.
* Bug fixed on individual subscriber resend confirmation mail option.

= 1.6 =

* Bug fix on Send Mail/Notification warning message (i.e Call to undefined method issue has been fixed)
* Call to undefined method es_cls_common::es_sent_report_plain() 	- Fixed
* Call to undefined method es_cls_common::es_sent_report_html() 	- Fixed

= 1.5 =

* Bug fix on admin notification email for new subscribers.

= 1.4 =

* Scheduled published posts issue has been fixed (From this version onwards, Notification emails will be triggered for scheduled posts)
* Bulk update option for subscribers group in admin view subscribers page.

= 1.3 =

* Fixed small error on mail compose page.
* Added check for Already Confirmed emails. This is to prevent user clicking optin email link multiple time.

= 1.2 =

* Widget translation issue has been fixed
* PHP warning message from Subscribers Export page has been removed.

= 1.1 =

* Subscriber admin page, Check ALL & Uncheck All bug fixed.
* Updated Help documents.

= 1.0 =

* First version

== Upgrade Notice ==

= 3.1.3 =

* New: Added form tag to subscribe form
* Fix: Added missing charset to meta tag
* Update: Moved javascripts to footer
* Update: Translation for Serbian (sr_RS) language updated (Thanks to Ogi Djuraskovic)
* Update: Updated POT file

= 3.1.2 =

* New: You can now include Unsubscribe link in Welcome Email (Email Subscribers v3.1.2+)
* New: Welcome Page on activating Email Subscribers
* Fix: Shortcode not showing error messages upon user subscription
* Fix: Show full sized featured image when using ###POSTIMAGE### shortlink
* Fix: Can't edit settings in admin panel if SSL is enabled
* Update: Revised the FAQ's in Help & Info page inside plugin
* Update: Text correction in few places
* Update: Updated POT file
* Tweak: Do not allow admin to edit Subscribe, Unsubscribe link in admin settings

= 3.1.1 =

* Fix: call_user_func_array() expects parameter 1 to be a valid callback, function 'es_admin_option' not found or invalid function name
* Fix: Incorrect plugin name in admin dashboard
* Fix: Warnings in console on submitting subscription form in Chrome
* Update: Revised Help & Info page inside plugin
* Update: Added translation for missing texts
* Update: Updated POT file
* Tweaks: Minor tweaks

= 3.1 =

* New: Scripts and styles are now localized and can be translated
* Fix: Subscribe button not visible correctly in Chrome
* Update: Added POT file

= 3.0.1 =

* New contributor name has been added successfully.

= 3.0 =

* Tested upto 4.4

= 2.9.2 =

* Add-on plugin available for advanced subscribers form (Users can select interested group in subscribers form).
* Polish language file added in the language directory.
* Text Domain slug has been added for Language Packs.

= 2.9.1 =

* Fixed cross-site scripting vulnerabilities and a potential SQL injection.

= 2.9 =

* Tested upto 4.3
* Option available to add same email address to multiple group name
* Cron Mail option added. With this option you can schedule cron jobs for newsletter and notification emails. Using this cron option you can schedule mail (example 100 mails per hour)
* Group Name added in the export list.
* Mail Type option has been added in the Send Mail admin page. With this option you can add the mails into cron job or you can send the mail immediately.
* Notification Status option has been added in the notification setup page. With this option you can add notification mails into cron job or you can send the mail immediately when new post is published.
* Group name filter has been added in the subscriber admin page.

= 2.8 =

* Tested upto 4.2
* Fixed warning message bug on Roles page
* Sync Email option has been added in the subscribers admin page. with this option all newly registered email address will be synced automatically into the plugin subscribers group.

= 2.7 =

* Up to plugin version 2.6 only administrator level users can manage this plugin in dashboard. From this version I have introduced new feature  called Roles. The user role can be selected using this Roles Menu. For example, If you want to give Send Email feature to Editor. Go to plugin Roles menu using administrator login and select Editor role to Send Email Menu, So that your Editor level user can access plugin Send Email menu to publish newsletter emails.

= 2.6 =

* Added new option in the Email Import page to select Email Status and Email Group. with this option you can select (or create) group name and emails status when you import the email address.

= 2.5 =

* Now plugin supports custom post type. i.e. With this plugin, you can able to send automatic newsletter/notification emails when you publish custom posts.

= 2.4 =

* Tested upto 4.1
* Fixed special character bug on Sender of Notification FROM email name.

= 2.3 =

* This warning issue has been fixed (Warning: call_user_func_array() expects parameter 1 to be a valid callback, function 'es_admin_option' not found or invalid function name)

= 2.2 =

* Warning message issue has been fix on notification mails. previously $post object was submitted to notification mail method without filtering post_id.
* Added new keywords ###POSTLINK-ONLY###, ###POSTLINK-WITHTITLE### for notification mail content.
	###POSTLINK-ONLY### 		- Use this key word to add post link in the mail content (Post link cannot be clickable)
	###POSTLINK-WITHTITLE### 	- Use this key word to display post link with title (Clickable post title)
	###POSTLINK### 				- Use this key word to display clickable post link.

= 2.1 =

* In view subscribers admin page, Filter option and paging moved to the top right corner (Previous version it was in bottom).
* Plugin tested for multisite installation blogs.

= 2.0 =

* Tested up to WordPress 4.0
* In view subscribers admin page, new option added to filter the email address based on status.
* Paging option added on view subscribers admin page. In default it will show only first 200 emails, you have drop down box to navigate another page (i.e. 201 to 400 emails etc..).
* Warning message fix on email address import page (i.e Strict standards: Only variables should be passed by reference)	- Fixed

= 1.9 =

* New option added in admin setting page to update Sent Mail Report  Subject/Content. For each newsletter mail and notification mail, plugin will send one report mail to admin with default content. Now with this option, admin can update that default mail content.

= 1.8 =

* Bug fixed on Double Opt-In welcome mail check (Previously it was not checking admin setting for welcome mail).
* Tested up to WordPress 3.9.2

= 1.7 =

* Bug fixed on individual subscriber delete option.
* Bug fixed on individual subscriber resend confirmation mail option.

= 1.6 =

* Bug fix on Send Mail/Notification warning message (i.e Call to undefined method issue has been fixed)
* Call to undefined method es_cls_common::es_sent_report_plain() 	- Fixed
* Call to undefined method es_cls_common::es_sent_report_html() 	- Fixed

= 1.5 =

* Bug fix on admin notification email for new subscribers.

= 1.4 =

* Scheduled published posts issue has been fixed (From this version onwards, Notification emails will be triggered for scheduled posts)
* Bulk update option for subscribers group in admin view subscribers page.

= 1.3 =

* Fixed small error on mail compose page.
* Added check for Already Confirmed emails. This is to prevent user clicking optin email link multiple time.

= 1.2 =

* Widget translation issue has been fixed
* PHP warning message from Subscribers Export page has been removed.

= 1.1 =

* Subscriber admin page, Check ALL & Uncheck All bug fixed.
* Updated Help documents.

= 1.0 =

* First version