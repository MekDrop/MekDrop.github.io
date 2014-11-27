<?php

$lan = array(

'The temporary directory for uploading (%s) is not writable, so import will fail' => 'Tymczasowy katalog do przesyłania plików (%s) jest niezapisywalny, więc import zakończy się niepowodzeniem',
'Invalid Email' => 'Nieprawidłowy email',
'Import cleared' => 'Import wyczyszczony',
'Continue' => 'Kontynuuj',
'Reset Import session' => 'Resetuj sesję importu',
'File is either too large or does not exist.' => 'Plik jest za duży lub nie istnieje.',
'No file was specified. Maybe the file is too big? ' => 'Nie podano pliku. Być może plik jest zbyt duży? ',
'File too big, please split it up into smaller ones' => 'Plik jest zbyt duży. Podziel go na mniejsze części',
'Use of wrong characters in filename: ' => 'Użyto niewłaściwych znaków w nazwie pliku: ',
'Please choose whether to sign up immediately or to send a notification' => 'Wybierz: czy potwierdzić użytkowników od razu, czy rozesłać prośbę o potwierdzenie',
'Cannot read %s. file is not readable !' => 'Nie mozna odczytać %s. Plik jest nieodczytywalny !',
'Something went wrong while uploading the file. Empty file received. Maybe the file is too big, or you have no permissions to read it.' => 'Coś poszło nie tak podczas przesyłania pliku. Otrzymano pusty plik. Może plik jest zbyt duży, albo nie masz prawa do odczytu pliku.',
'Reading emails from file ... ' => 'Odczytuję adresy z pliku ... ',
'Error was around here &quot;%s&quot;' => 'Tu jest błąd &quot;%s&quot;',
'Illegal character was %s' => 'Znaleziono nieprawidłowy znak %s',
'A character has been found in the import which is not the delimiter indicated, but is likely to be confused for one. Please clean up your import file and try again' => 'W imporcie znaleziono znak, który nie jest wskazanym separatorem, prawdopodobnie został pomylony. Wyczyść plik importu i spróbuj ponownie',
'ok, %d lines' => 'ok, %d wierszy',
'Cannot find column with email, please make sure the column is called &quot;email&quot; and not eg e-mail' => 'Nie znaleziono komlumny z adresami email, upewnij się, że istnieje kolumna &quot;email&quot; a nie na przykład e-mail',
'Create new one' => 'Utwórz nowy',
'Skip Column' => 'Pomiń kolumnę',
'Import Attributes' => 'importuj atrybuty',
'Continue' => 'Kontynuuj',
'Please identify the target of the following unknown columns' => 'Wskaż cel następujących nieznanych kolumn',
'Summary' => 'Podsumowanie',
'maps to' => 'zamapowane do',
'Create new Attribute' => 'Utwórz nowy atrybut',
'maps to' => 'zamapowane do',
'Skip Column' => 'Pomiń kolumnę',
'maps to' => 'zamapowane do',
'%d lines will be imported' => '%d wierszy zostanie zaimportowanych',
'Confirm Import' => 'Potwierdź import',
'Test Output' => 'Wyjście na ekran',
'Record has no email' => 'Rekord nie zawiera adresu email',
'Invalid Email' => 'Nieprawidłowy email',
'clear value' => 'wyczyśc wartość',
'New Attribute' => 'nowy atrybut',
'Skip value' => 'Pomiń wartość',
'duplicate' => 'duplikat',
'Duplicate Email' => 'Powielony email',
' user imported as ' => ' użytkownik zaimportowany jako ',
'duplicate' => 'duplikat',
'duplicate' => 'duplikat',
'Duplicate Email' => 'Powielony email',
'All the emails already exist in the database and are member of the lists' => 'Wszystkie adresy już istnieją w bazie i są członkami list',
'%s emails succesfully imported to the database and added to %d lists.' => '%s adresów zamiportowanych z sukcesem do bazy i dodanych do %d list.',
'%d emails subscribed to the lists' => '%d adresów dodanych do list',
'%s emails already existed in the database' => '%s adresów już istnieje w bazie',
'%d Invalid Emails found.' => '%d błednych adresów.',
'These records were added, but the email has been made up from ' => 'Rekordy zostały dodane ale adresy email zostały wygenerowane z ',
'These records were deleted. Check your source and reimport the data. Duplicates will be identified.' => 'Rekordy zostały usunięte. Sprawdź źródło i zaimportuj dane ponownie. Duplikaty zostaną wykryte.',
'User data was updated for %d users' => 'Dane użytkownika zostały zaktualizowane dla %d użytkowników',
'%d users were matched by foreign key, %d by email' => '%d użytkowników dopasowano po kluczu obcym, %d po adresie email',
'phplist Import Results' => 'Wyniki importu phplist',
'Test output<br/>If the output looks ok, click %s to submit for real' => 'Wyjście na ekran<br/>Jeśli wyniki są ok, kliknij %s aby zaimportować na prawdę',
'Confirm Import' => 'Potwierdź import',
'Import some more emails' => 'Zaimportuj więcej adresów email',
'Adding users to list' => 'Dodaję użytkowników do listy',
'Select the lists to add the emails to' => 'Wybierz listy, do których dodać adresy email',
'No lists available' => 'Brak dostępnych list',
'Add a list' => 'Dodaj listę',
'Select the groups to add the users to' => 'Wybierz grupy, do których dodać użytkowników',
'automatically added' => 'dodano automatycznie',
 'The file you upload will need to have the attributes of the records on    the first line.     Make sure that the email column is called "email" and not something like "e-mail" or     "Email Address".     Case is not important.          If you have a column called "Foreign Key", this will be used for synchronisation between an     external database and the phpList database. The foreignkey will take precedence when matching     an existing subscriber. This will slow down the import process. If you use this, it is allowed to have     records without email, but an "Invalid Email" will be created instead. You can then do     a search on "invalid email" to find those records. Maximum size of a foreign key is 100.          Warning: the file needs to be plain text. Do not upload binary files like a Word Document.     ' => '<p>Plik, który przesyłasz będzie musiał mieć atrybuty rekordów w pierwszym wierszu.
    Upewnij się, że kolumna z adresami email jest nazwana "email" a nie na przykład "e-mail" albo
    "Email Address".
    Wielkość liter nie ma znaczenia.
    </p>
    Jeśli w pliku jest kolumna klucza obcego o nazwie "Foreign Key", zostanie ona użyta do synchronizacji między
    zewnętrzną bazą danych i bazą danych PHPlist. Klucz obcy jest priorytetem podczas dopasowywania
    do istniejącego użytkownika. To spowolni proces importu. Przy użyciu tej opcji dopuszczalne są
    rekordy bez adresu email, ale zamiast tego zostanie utworzony wpis "Invalid Email" (Nieprawidłowy email). Później
    możesz poszukać "invalid email" aby znaleźć te rekordy. Maksymalna wielkośc klucza obcego to 100.
    <br/><br/>
    <b>Uwaga</b>: plik musi być zwykłym tekstem. Nie przekazuj plików binarnych jak dokumenty Worda.
    <br/>',
'The following limits are set by your server: Maximum size of a total data sent to server: %s Maximum size of each individual file: %s' => 'Następujące limity zostały ustawione na Twoim serwerze:<br/>
Maksymalna ilość łącznie wysłanych danych na serwer: <b>%s</b><br/>
Maksymalna wielkośc pojedynczego pliku: <b>%s</b>
<br/>PHPlist nie przetworzy plików większych niż %dMb',
'If you check "Test Output", you will get the list of parsed emails on screen, and the database will not be filled with the information. This is useful to find out whether the format of your file is correct. It will only show the first 50 records.' => 'Jeśli zaznaczysz "Wyjście na ekran", odczytane adresy email wyświetlą się na ekranie ale nie zostaną wpisane do bazy danych. Jest to przydatne aby dowiedzieć się czy format pliku jest poprawny. Wyświetlone zostanie tylko pierwsze 50 rekordów.',
'If you check "Show Warnings", you will get warnings for invalid records. Warnings will only be shown if you check "Test Output". They will be ignored when actually importing. ' => 'Jeśli zaznaczysz "Pokaż ostrzeżenia", wyświetlone zostaną ostrzeżenia dla pojedynczych rekordów. Ostrzeżenia zostaną wyświetlone tylko wówczas, gdy zaznaczysz opcję "Wyjście na ekran". Opcja "Pokaż ostrzeżenia" będzie zignorowana podczas właściwego importu. ',
'If you check "Omit Invalid", invalid records will not be added. Invalid records are records without an email. Any other attributes will be added automatically, ie if the country of a record is not found, it will be added to the list of countries.' => 'Jeśli zaznaczysz "Pomiń nieprawidłowe", nieprawidłowe rekordy nie zostaną dodane. Nieprawidłowe rekordy to rekordy bez adresów email. Wszelkie inne atrybuty zostaną dodane automatycznie, tzn. jeżeli rekord kraju nie zostanie odnaleziony, zostanie on dodany do listy krajów.',
'Assign Invalid will be used to create an email for subscribers with an invalid email address. You can use values between [ and ] to make up a value for the email. For example if your import file contains a column "First Name" and one called "Last Name", you can use "[first name] [last name]" to construct a new value for the email for this subscriber containing their first name and last name. The value [number] can be used to insert the sequence number for importing.' => 'Opcja "Przypisz nieprawidłowe" zostanie użyta aby utworzyć ares email dla użytkowników z nieprawidłowym adresem. 
Możesz użyć wartości pomiędzy [ oraz ] w celu uzupełnienia wartości email. Na przykład jeśli Twój plik importu zawiera kolumnę "First Name" oraz "Last Name", możesz użyć 
"[first name] [last name]" aby zbudować nową wartość dla adresu email tego użytkownika zawierającą jego imię i nazwisko. 
Wartość [number] może zostać użyta aby wstawiać kolejny numer importu.',
'If you check "Overwrite Existing", information about a subscriber in the database will be replaced by the imported information. Subscribers are matched by email or foreign key.' => 'Jeśli zaznaczysz "Nadpisz istniejące", informacje na temat użytkownika w bazie danych zostaną zamienione na te importowane. Użytkownicy są dopasowywani po adresie email lub po kluczu obcym.',
'If you check "Retain Old Email", a conflict of two emails being the same will keep the old one and add "duplicate" to the new one. If you don&quot;t check it, the old one will get "duplicate" and the new one will take precedence.' => 'Jeśli zaznaczysz "Zachowaj stary email", podczas wystąpienia konfliktu zostanie zachowany stary adres email oraz dodany wpis "duplikat" do nowego. Jeśli tego nie zaznaczysz, stary otrzyma wpis "duplikat" a nowy będzie miał pierszeństwo.',
'If you choose "send notification email" the subscribers you are adding will be sent the request for confirmation of subscription to which they will have to reply. This is recommended, because it will identify invalid emails.' => 'Jeśli wybierzesz "Wyślij potwierdzenie" użytkownicy, których dodajesz otrzymają prośbę o potwierdzenie rejestracji, na które będą musieli odpowiedzieć. Jest to zalecane, bo dzięki temu będzie można zidentyfikować nieprawidłowe adresy email.',
'phplist Import  Results' => 'Wyniki importu phplist',
'File containing emails' => 'Plik z adresami email',
'Field Delimiter' => 'Separator pól',
'(default is TAB)' => '(domyslnie TAB)',
'Record Delimiter' => 'Separator rekordów',
'(default is line break)' => '(domyślnie przełamanie linii)',
'Test output' => 'Wyjście na ekran',
'Show Warnings' => 'Pokaż ostrzeżenia',
'Omit Invalid' => 'Pomiń nieprawidłowe',
'Assign Invalid' => 'Przypisz do nieprawidłowych',
'Overwrite Existing' => 'Nadpisz istniejące',
'Retain Old User Email' => 'Zachowaj stary email',
'Send&nbsp;Notification&nbsp;email' => 'Wyślij potwierdzenie',
'Make confirmed immediately' => 'Oznacz użytkowników jako potwierdzonych',
'Import' => 'Importuj',


);
?>