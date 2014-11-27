<?php
$lan = array( 
 'checklist for installation' => 'Чеклист для установки',
 'cannot be empty' => 'не может быть пустым',
 'Editing' => 'Изменение',
 'save changes' => 'Сохранить изменения',
 'edit' => 'изменить',

  # added 24 May 2006
  'delete user' => 'удалить пользователя',
  'unconfirm user' => 'отметить пользователя как \"неподтверженный\"',
  'blacklist user' => 'внести пользователя в \"черный список\"',
  'delete user and bounce' => 'удалить пользователя и отказ',
  'unconfirm user and delete bounce' => 'отметить пользователя как \"неподтверженный\" и удалить отказ',
  'blacklist user and delete bounce' => 'внести пользователя в \"черный список\" и удалить отказ',
  'delete bounce' => 'удалить отказ',
  'Website address (without http://)' => 'адрес вэб-сайта(без http://)',
  'Domain Name of your server (for email)' => 'домен Вашего сервера (для электронной почты)',
  'Person in charge of this system (one email address)' => 'Отвественный за систему(один электронный адрес)',
  'How often do you want to check for a new version of PHPlist (days)' => 'Как часто Вы хотите проверять на наличие новой версии PHPlist (в днях)',
  'List of people to CC in system emails (separate by commas)' => 'Куда отправлять копии сообщений: (отделять запятой)',
  'Who gets the reports (email address, separate multiple emails with a comma)' => 'Куда отправлять отчеты(электронный адрес, несколько адресов разделять запятой)',
  'From email address for system messages' => 'От какого электронного адреса получать системные сообщения',
  'What name do system messages appear to come from' => 'Имя отправителя системных сообщений',
  'Reply-to email address for system messages' => 'Адрес для ответа для системных сообщений',
  'if there is only one visible list, should it be hidden in the page and automatically subscribe users who sign up (0/1)' => 
  'Существуют ли один список, который сделать невидимым и в который добавляются подписавшиеся пользователи?(0/1)',
  'width of a textline field (numerical)' => 'Длина текстовой линии (число)',
  'dimensions of a textarea field (rows,columns)' => 'Размеры текстового поля(строки, столбцы)',
  'Does the admin get copies of subscribe, update and unsubscribe messages (0/1)' => 'Получает ли администратор копии сообщений о подписке, изменении или отписке (0/1)',
  'The default subscribe page when there are multiple' => 'Страница подписки по-умолчанию, в случае если подобных страниц несколько',
  'The default HTML template to use when sending a message' => 'HTML шаблон, используемый по-умолчанию, при отправке сообщений',
  'URL where users can subscribe' => 'URL, где пользователи могут подписаться',
  'URL where users can unsubscribe' => 'URL, где пользователи могут отписаться',
  'URL where users have to confirm their subscription' => 'URL, где пользователи должны подтвердить подписку',
  
  'URL where users can update their details' => 'URL, где пользователи могут изменить детали подписки',
  'URL where messages can be forwarded' => 'URL, где сообщения могут быть перенаправлены',
  
  'Subject of the message users receive when they subscribe' => 'Тема письма, которое получают пользователи в случае подписки',
  'Message users receive when they subscribe' => 'Сообщение, которое получают пользователи при подписке',
  
  'Subject of the message users receive when they unsubscribe' => 'Тема письма, которое получают пользователи в случае отписки',
  'Message users receive when they unsubscribe' => 'Сообщение, которое получают пользователи при отписки',
  
  'Subject of the message users receive after confirming their email address' => 'Тема сообщения, которое получают пользователи после подтверждения их электронного адреса',
  'Message users receive after confirming their email address' => 'Сообщение, которое получают пользователи после подтверждения их электронного адреса',
  
  'Subject of the message users receive when they have changed their details' => 'Тема сообщения, которое получают пользователи после изменения персональных деталей',
  'Message that is sent when users change their information' => 'Сообщение, которое получают пользователи после изменения персональных деталей',
  
  'Part of the message that is sent to their new email address when users change their information, and the email address has changed' => 
  'Часть сообщения, которое посылается на новый электронный адрес, когда пользователи изменяют персональую информацию и электронный адрес',
  'Part of the message that is sent to their old email address when users change their information, and the email address has changed' => 
  'Часть сообщения, которое посылается на старый электронный адрес, когда пользователи изменяют персональую информацию и электронный адрес',
  
  'Subject of message to send when users request their personal location' => 'Тема сообщения, которе получают пользователи, запросившие личное расположение в системе',
  'Message to send when they request their personal location' => 'Сообщение, которе получают пользователи, запросившие личное расположение в системе',
  
  'Default footer for sending a message' => 'Подпись по-умолчанию отправляемого сообщения',
  'Footer used when a message has been forwarded' => 'Подпись для перенаправляемого сообщения',
  
  'Header of public pages. The header should start with &lt;/head&gt; . You can add header elements, but don\'t add the title or other basic header elements.' => 'Заголовок <head> для публичных страниц. Заговолок должен начинаться с &lt;/head&gt; . Вы можете добаить элементы заголовка, но не добавляйте название или другие базовые элементы заголовка.', #need to escape <head>
  'Footer of public pages' => 'Подпись (футер) публичных страниц',
  'Charset for HTML messages' => 'Кодировка  для HTML сообщений',
  'Charset for Text messages' => 'Кодировка для текстовых сообщений',
  'CSS for HTML messages without a template' => 'CSS для HTML сообщений без шаблона',
  'Domains that only accept text emails, one per line' => 'Почтовые домены, которые принимают только текстовые сообщения, перечислить через запятую',
  'Minimum amount of items to send in an RSS feed' => 'Минимальное количество элементов в RSS-ленте для отправки',
  'Template for text item in RSS feeds' => 'Шаблон для текстовых элементов в RSS-ленте',
  'Template for HTML item in RSS feeds' => 'Шаблон для HTML элементов в RSS-ленте',
  'Maximum amount of items to send in an RSS feed' => 'Максимальное количество элементов в RSS-ленте для отправки',
  'Template for separator between feeds in RSS feeds (text)' => 'Шаблон для разделителя между сообщениями в RSS ленте (текстовой формат)',
  'Template for separator between feeds in RSS feeds (HTML)' => 'Шаблон для разделителя между сообщениями в RSS ленте (HTML формат)',
  'Width in px of FCKeditor Area' => 'Ширина в пикселях для поля редактирования FCKeditor',
  'Height in px of FCKeditor Area' => 'Ширина в пикселях для поля редактирования FCKeditor',
);
?>