<?php

// don't HTML encode special characters

$lan = array(
'Running in testmode, no emails will be sent. Check your config file.' =>
	'Test-Modus. Es werden keine E-Mails versendet. Überprüfen Sie die Konfigurationsdatei.',
'The following restrictions have been set by your ISP:' =>
	'Der Betreiber Ihres Servers hat folgende Beschränkungen gesetzt:',
'Script stage' => 'Skript-Stufe',
'Finished, Nothing to do' => 'Keine anstehenden Aufgaben gefunden',
'messages sent in' => 'Nachrichten versandt in',
'seconds' => 'Sekunden',
'invalid emails' => 'ungültige E-Mails',
'emails failed (will retry later)' => 'E-Mails, die nicht versendet werden konnten (Versuch wird später wiederholt)',
'emails unconfirmed (not sent)' => 'nicht bestätigte E-Mails (nicht versendet)',
'Warning: script never reached stage 5' => 'Warnung: Das Skript hat die Stufe 5 nicht erreicht',
'This may be caused by a too slow or too busy server' => 'Der Grund könnte ein zu langsamer oder überlasteter Server sein.',


'In safe mode, batches are set to a maximum of 100' => 'Im Sicherheits-Modus werden Batch-Aufgaben auf maximal 100 gesetzt.',
'Running in safe mode' => 'Sicherheits-Modus',
'msgs/hr' => 'Nachrichten/Std.',
'Reload required' => 'Reload erforderlich',
'Finished, All done' => 'Verarbeitung abgeschlossen',
'Script finished, but not all messages have been sent yet.' =>
	'Das Skript wurde abgeschlossen, es wurden aber noch nicht alle Mails versendet.',
'Finished this run' => 'AusfÜhrung beendet',
'(test)' => '(Test)',
'Would have sent' => 'Hätte versendet',
'(test)' => '(Test)',
'Would have sent' => 'Hätte versendet',
'Started' => 'Verarbeitung gestartet',
'Processing has been suspended by your ISP, please try again later' =>
	'Der Betreiber Ihres Servers hat die Verarbeitung unterbrochen. Bitte versuchen Sie es später nochmals.',
'Sending in batches of' => 'Versand in Batches von',
'emails' => 'E-Mails',
'This batch will be' => 'Dieser Batch enthält',
'emails, because in the last' => 'E-Mails, weil im vorangehenden',
'emails were sent' => 'E-Mails versendet wurden.',
'Sending in batches of' => 'Versand in Batches von',
'emails' => 'E-Mails',
'In the last' => 'Während der letzten',
'seconds more emails were sent' => 'Sekunden wurden mehre E-Mails versendet',
'than is currently allowed per batch' => 'als derzeit pro Batch erlaubt sind.',
'Sent in last run' => 'Im letzten Durchgang versendet',
'Skipped in last run' => 'Im letzten Durchgang übersprungen',
'Processing has started,' => 'Anzahl pendente Nachrichten:',
'message(s) to process.' => '',
'It is safe to click your stop button now, report will be sent by email to' =>
	'Sie können nun problemlos den Stop-Button anklicken. Der Bericht wird per E-Mail an folgende Adresse verschickt:',
'Your webserver is running in safe_mode. Please keep this window open.
	It may reload several times to make sure all messages are sent.' =>
	'Ihr Web-Server wird im "safe_mode" betrieben. Bitte schliessen Sie dieses Fenster nicht.
	Es wird möglicherweise mehrere Male neu geladen, um sicherzustellen, dass alle Nachrichten versendet wurden.',
'Reports will be sent by email to' => 'Berichte werden per E-Mail an folgende Adresse verschickt:',
'Processing message' => 'Verarbeite Nachricht',
'Message' => 'Nachricht',
'is an RSS feed for' => 'ist ein RSS-Feed f&uuml;r',
'Looking for users' => 'Suche Empfänger',
'users apply for attributes, now checking lists' => 'users apply for attributes, now checking lists',
'No users apply for attributes' => 'No users apply for attributes',
'looking for users who can be excluded from this mailing' => 'Überprüfe auf Empfänger die von der Verarbeitung ausgeschlossen werden können',
'Process Killed by other process' => 'Prozess wurde durch einen anderen Prozess abgebrochen',
'Found them' => 'Gefunden',
'to process' => 'Empfänger',
'No users to process for this batch' => 'Keine Empfänger für diesen Batch',
'batch limit reached' => 'Batch-Limit wurde erreicht',
'Process Killed by other process' => 'Prozess wurde durch einen anderen Prozess abgebrochen',
'Message I was working on has disappeared' => 'Die zu verarbeitende Nachricht ist verschwunden',
'Sending' => 'Sende',
'It took' => 'Es dauerte',
'seconds to send' => 'Sekunden um zu senden',
'Failed sending to' => 'Versand fehlgeschlagen an',
'Unconfirmed user' => 'Unbestätigter Empfänger',
'Not sending to' => 'Kein Versand an',
'already sent' => 'bereits versendet',
'Processed' => 'Verarbeitet:',
'out of' => 'von',
'Hmmm, No users found to send to' => 'Keine Empfänger gefunden',
'It took' => 'Versand dauerte',
'to send this message' => '',
'waiting for' => 'warte auf',
'to make sure we don\'t exceed our limit of' => 'um sicherzustellen, dass die folgende Limite nicht überschritten wird:',
'messages in' => 'Nachrichten in',

### new in 2.9.5
'Message Sending has started' => 'Versand gestartet',
'phplist has started sending the message with subject %s' => 'Versand der Nachricht mit Betreff %s gestartet',
'to view the progress of this message, go to %s' => 'Um den Stand des Versands zu sehen gehen Sie zu %s',
'There have been more than 10 attempts to send to %s that have been blocked for domain throttling.' =>
	'Mehr als 10 Sendeversuche an %s wurden blockiert wegen Domain-Beschränkung (Domain Throttling)',
'Introducing extra delay to decrease throttle failures' =>
	'Benutze zusätzliche Verzögerung um Fehlschläge wegen Domain-Beschränkung (Domain Throttling) zu reduzieren.',
'%s is currently over throttle limit of %d per %d seconds' =>
	'%s ist derzeit über dem Throttle-Limit von %d pro %d Sekunden',
'not sending to ' => 'kein Versand an ',
'Message Sending has finished' => 'Versand abgeschlossen',
'phplist has finished sending the message with subject %s' => 'Versand der Nachricht mit Betreff %s abgeschlossen',

'Sending of this message has been suspended' => 'Versand dieser Nachricht wurde aufgeschoben',

);

?>