<?php
$lan = array(
  'File is either to large or does not exist.' => 'Plik jest za duży albo nie istnieje.',
  'No file was specified.' => 'Nie wskazano pliku.',
  'Some characters that are not valid have been found. These might be delimiters. Please check the file and select the right delimiter. Character found:' => 'Znalezono nieprawidłowe znaki. To mogą byc separatory. Sprawdź plik i wybierz prawidłowy separator. Znalezione znaki:',
  'Name cannot be empty' => 'Nazwa nie może być pusta',
  'Name is not unique enough' => 'Nazwa nie jest wystarczająco unikatowa',
  'Cannot find the email in the header' => 'Nie można odnaleźć adresu email w nagłówku',
  'Cannot find the password in the header' => 'Nie mozna znaleźć hasła w nagłówku',
  'Cannot find the loginname in the header' => 'Nie można znaleźć nazwy logowania w nagłówku',
  'Record has no email' => 'Rekord nie zawiera adresu email',
  'Invalid Email' => 'Nieprawidłowy adres email',
  'Record has more values than header indicated, this may cause trouble' => 'Rekord posiada więcej wartości niż wskazuje na to nagłówek, to może spowodować problemy',
  'password' => 'hasło',
  'loginname' => 'nazwa logowania',
  'Empty loginname, using email:' => 'Pusta nazwa logowania, użyto adresu email:',
  'Value' => 'Wartość',
  'added to attribute' => 'dodano do atrybutu',
  'new email was' => 'nowy adres był',
  'new emails were' => 'nowe adresy były',
  'email was' => 'adres był',
  'emails were' => 'adresy były',
  'All the emails already exist in the database' => 'Wszystkie adresy email już istnieją w bazie danych',
  'succesfully imported to the database and added to the system.' => 'z powodzeniem zaimportowano do bazy danych i dodano do systemu.',
  'Import some more emails' => 'Zaimportuj więcej adresów email',
  'No default permissions have been defined, please create default permissions first, by creating one dummy admin and assigning the default permissions to this admin' => 'Nie zdefiniowano domyślnych uprawnień,  utwórz najpierw domyślne uprawnienia, tworząc jednego sztucznego admina i przypisz domyślne uprawnienia do tego admina',
  
  # do not translate email, loginname and password
  '   The file you upload will need to contain the administrators you want to add to the system. The columns need to have the following headers: email, loginname, password. Any other columns will be added as admin attributes.  Warning: the file needs to be plain text. Do not upload binary files like a Word Document.   ' => '
  Plik, który przekazujesz powienien zawierać administratorów, 
których chcesz dodać do systemu. Kolumny muszą mieć następujące nagłówki: <b>email</b>, <b>loginname</b>, <b>password</b>. Każda inna kolumna będzie dodana jako atrybut administratora.
 <b>Uwaga</b>: plik musi być zwykłym tekstem. Nie przekazuj plików binarnych jak dokumenty Worda.
  ',
  'File containing emails' => 'Plik z adresami email',
  'Field Delimiter' => 'Separator pól',
  'Record Delimiter' => 'Separator rekordów',
  'If you check "Test Output", you will get the list of parsed emails on screen, and the database will not be filled with the information. This is useful to find out whether the format of your file is correct. It will only show the first 50 records.' => 'Jeśli zaznaczysz "Wyjście na ekran", odczytane adresy email wyświetlą się na ekranie ale nie zostaną wpisane do bazy danych. Jest to przydatne aby dowiedzieć się czy format pliku jest poprawny. Wyświetlone zostanie tylko pierwsze 50 rekordów.',
  # this should be the same as the term between quotes in the previous one
  'Test output' => 'Wyjście na ekran',
  'Check this box to create a list for each administrator, named after their loginname' => 'Zaznacz to pole aby utworzyć listę dla każdego administratora. Nazwy list po nazwie logowania administratora',
  'Do Import' => 'Importuj',
  'default is TAB' => 'domyślnie TAB',
  'default is line break' => 'domyślnie przełamanie linii',
  'Test output:There should only be ONE email per line.If the output looks ok, go Back to resubmit for real' => 'Wyjście na ekran:<br>Powinien byc tylko JEDEN adres email na wiersz.<br>Jeśli wyniki są ok, <a href="javascript:history.go(-1)">Wróć</a> aby zaimportować naprawdę<br><br>',  
  'List for' => 'Lista dla',
'login' => 'zaloguj',
  
  
);
?>