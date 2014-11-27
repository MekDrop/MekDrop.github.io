<?php

$lan = array(

'The temporary directory for uploading (%s) is not writable, so import will fail' => 'Den temporära uppladdningsmappen (%s) är inte skrivbar så import kommer misslyckas',
'Invalid Email' => 'Ogiltig e-postadress',
'Import cleared' => 'Import rensad',
'Continue' => 'Fortsätt',
'Reset Import session' => 'Återställ importsession',
'File is either too large or does not exist.' => 'Filen är antingen för stor eller finns inte.',
'No file was specified. Maybe the file is too big? ' => 'Ingen fil specifierades. Kanske är filen för stor? ',
'File too big, please split it up into smaller ones' => 'Filen är för stor, vänligen dela upp den i mindre filer',
'Use of wrong characters in filename: ' => 'Otillåtna tecken används i filnamnet: ',
'Please choose whether to sign up immediately or to send a notification' => 'Vänligen välj om anmälan sker direkt eller om en notifiering ska skickas',
'Cannot read %s. file is not readable !' => 'Kan inte läsa in %s. Filen är inte läsbar !',
'Something went wrong while uploading the file. Empty file received. Maybe the file is too big, or you have no permissions to read it.' => 'Någonting gick fel under filuppladdningen. En tom fil togs emot. Kanske är filen för stor, eller så har du inte behörighet att läsa den.',
'Reading emails from file ... ' => 'Läser in e-postadresser från fil ... ',
'Error was around here &quot;%s&quot;' => 'Felet är omkring här &quot;%s&quot;',
'Illegal character was %s' => 'Ett ogiltigt tecken var %s',
'A character has been found in the import which is not the delimiter indicated, but is likely to be confused for one. Please clean up your import file and try again' => 'Ett tecken har hittats i importen som inte är den indikerade avgröänsaren, men som är troligen misstagen för en. Vänligen städa upp i din importfil och försök igen',
'ok, %d lines' => 'ok, %d rader',
'Cannot find column with email, please make sure the column is called &quot;email&quot; and not eg e-mail' => 'Kan inte hitta e-postkolumn, vänligen kolla så kolumnen heter &quot;email&quot; och inte t. ex. e-mail',
'Create new one' => 'Skapa en ny',
'Skip Column' => 'Hoppa över kolumn',
'Import Attributes' => 'Importera attribut',
'Continue' => 'Fortsätt',
'Please identify the target of the following unknown columns' => 'Vänligen identifiera målet för följande okända kolumner',
'Summary' => 'Sammanfattning',
'maps to' => 'länkar till',
'Create new Attribute' => 'Skapa nytt attribut',
'maps to' => 'länkar till',
'Skip Column' => 'Hoppa över kolumn',
'maps to' => 'länkar till',
'%d lines will be imported' => '%d rader kommer importeras',
'Confirm Import' => 'Bekräfta import',
'Test Output' => 'Testa utmatning',
'Record has no email' => 'Posten innehåller ingen e-postadress',
'Invalid Email' => 'Ogiltig e-postadress',
'clear value' => 'rensa värde',
'New Attribute' => 'Nytt attribut',
'Skip value' => 'Hoppa över värder',
'duplicate' => 'dubblett',
'Duplicate Email' => 'Dubblett-e-postadress',
' user imported as ' => ' medlem importerad som ',
'duplicate' => 'dubblett',
'duplicate' => 'dubblett',
'Duplicate Email' => 'Dublett-e-postadress',
'All the emails already exist in the database and are member of the lists' => 'Alla e-postadresserna finns redan i databasen och är listmedlemmar',
'%s emails succesfully imported to the database and added to %d lists.' => '%s e-postadresser importerades till databasen och lades till i %d listor.',
'%d emails subscribed to the lists' => '%d e-postadresser anmäldes till listorna',
'%s emails already existed in the database' => '%s e-postadresser fanns redan i databasen',
'%d Invalid Emails found.' => '%d ogiltiga e-postadresser hittades.',
'These records were added, but the email has been made up from ' => 'Dessa poster lades till, men e-postadresserna har skapats från ',
'These records were deleted. Check your source and reimport the data. Duplicates will be identified.' => 'Dessa poster togs bort. Kolla källkoden och återimportera datan. Dubbletter kommer identifieras.',
'User data was updated for %d users' => 'Medlemsdata uppdaterades för %d medlemmar',
'%d users were matched by foreign key, %d by email' => '%d medlemmar matchades av främmande nyckel, %d genom e-postadress',
'phplist Import Results' => 'phplist-importresultat',
'Test output<br/>If the output looks ok, click %s to submit for real' => 'Testutmatning<br/>Om utmatningen ser ok ut, klicka på %s för att lägga till den på riktigt',
'Confirm Import' => 'Bekräfta import',
'Import some more emails' => 'Importera några fler e-postadresser',
'Adding users to list' => 'Lägger till medlemmar i lista',
'Select the lists to add the emails to' => 'Välj listorna som e-postadresserna ska läggas till i',
'No lists available' => 'Inga tillgängliga listor finns',
'Add a list' => 'Lägg till en lista',
'Select the groups to add the users to' => 'Välj grupperna som medlemmarna ska läggas till i',
'automatically added' => 'läggs till automatiskt',
 'The file you upload will need to have the attributes of the records on    the first line.     Make sure that the email column is called "email" and not something like "e-mail" or     "Email Address".     Case is not important.          If you have a column called "Foreign Key", this will be used for synchronisation between an     external database and the phpList database. The foreignkey will take precedence when matching     an existing subscriber. This will slow down the import process. If you use this, it is allowed to have     records without email, but an "Invalid Email" will be created instead. You can then do     a search on "invalid email" to find those records. Maximum size of a foreign key is 100.          Warning: the file needs to be plain text. Do not upload binary files like a Word Document.     ' => '<p class="information">Filen som du laddar upp behöver inte ha postattributen på den första raden.
    Försökra dig om att e-postkolumnen heter "email" och inte till exempel "e-mail" eller
    "e-postadress".
    Huruvida små eller stora bokstäver används är ovidkommande.
    </p>
    Om du har en kolumn som heter "Foreign Key" kommer denna användas för synkronisering mellan en
    extern databas och PHPlist-databasen. Nyckeln kommer ges företräde när existerande medlemmar
    matchas. Detta kommer sinka ner importprocessen. I den här processen är e-postlösa poster
    tillåtna, men "Invalid Email" kommer anges i e-postfältet för dessa. Du kan sedan söka
    efter "invalid email" för att hitta dessa poster. Högsta antal tecken i en främmande nyckel är 100.
    <br/><br/>
    <b>Varning</b>: filen måste vara vanlig text. Ladda inte upp binära filer, som Worddokument.
    <br/>',
'The following limits are set by your server: Maximum size of a total data sent to server: %s Maximum size of each individual file: %s' => 'Följande gränser har satts av din server:<br/>
Maximal total datastorlek sänd till server: <b>%s</b><br/>
Maximal storlek för varje individuell fil: <b>%s</b>',
'If you check "Test Output", you will get the list of parsed emails on screen, and the database will not be filled with the information. This is useful to find out whether the format of your file is correct. It will only show the first 50 records.' => 'Om du kryssar för "Testutmatning" kommer du få en lista över analyserade e-postadresser på skärmen och databasen kommer inte fyllas på med informationen. Detta är användbart för att se om din fil är korrekt formaterad. Endast de första 50 posterna kommer visas.',
'If you check "Show Warnings", you will get warnings for invalid records. Warnings will only be shown if you check "Test Output". They will be ignored when actually importing. ' => 'Om du kryssar för "Visa varningar" kommer du varnas för ogiltiga poster. Varningar kommer endast visas om du kryssar för "Testutmatning". De kommer ignoreras när den faktiska importen sker. ',
'If you check "Omit Invalid", invalid records will not be added. Invalid records are records without an email. Any other attributes will be added automatically, ie if the country of a record is not found, it will be added to the list of countries.' => 'Om du kryssar för "Försumma ogiltiga" kommer ogiltiga poster inte läggas till. Ogiltiga poster är poster utan e-postadress. Alla andra attribut kommer läggas till automatiskt, så om t. ex. en posts land inte kan hittas kommer den läggas til i listan över länder.',
'Assign Invalid will be used to create an email for subscribers with an invalid email address. You can use values between [ and ] to make up a value for the email. For example if your import file contains a column "First Name" and one called "Last Name", you can use "[first name] [last name]" to construct a new value for the email for this subscriber containing their first name and last name. The value [number] can be used to insert the sequence number for importing.' => 'Ogiltighetstilldelning kommer användas för att skapa en e-postadress för medlemmar med ogiltig e-postadress.
Du kan använda värden mellan [ och ] för att skapa ett värde för e-postadressen. Till exempel, om din importfil innehåller en kolumn kallad "Förnamn" och en kallad "Efternamn", så kan du använda
"[förnamn] [efternamn]" för att konstruera ett nytt värde för e-postadressen för denna medlem bestående av deras förnamn och efternamn.
Värdet [number] kan användas för att infoga sekvensnumret för importen.',
'If you check "Overwrite Existing", information about a subscriber in the database will be replaced by the imported information. Subscribers are matched by email or foreign key.' => 'Om du kryssar för "Skriv över befintliga" kommer information om en medlem i databasen ersättas med den importerade informationen. Medlemmar matchas genom e-postadress eller främmande nycklar.',
'If you check "Retain Old Email", a conflict of two emails being the same will keep the old one and add "duplicate" to the new one. If you don&quot;t check it, the old one will get "duplicate" and the new one will take precedence.' => 'Om du kryssar för "Behåll gammal medlemsepostadress" kommer den gamla adressen behållas vid en konflikt mellan två e-postadresser och "dubblett" läggas till den nya adressen. Om du inte kryssar för det kommer den gamla kallas "dubblett" och den nya kommer få företräde.',
'If you choose "send notification email" the subscribers you are adding will be sent the request for confirmation of subscription to which they will have to reply. This is recommended, because it will identify invalid emails.' => 'Om du väljer "sänd notifieringsmeddelande" kommer medlemmarna du lägger till få en bekräftelsebegäran för anmälan som de måste svara på. Detta rekommenderas då det kommer identifiera ogiltiga e-postadresser.',
'phplist Import  Results' => 'phplist-importresultat',
'File containing emails' => 'Fil med e-postadresser',
'Field Delimiter' => 'Fältavgränsare',
'(default is TAB)' => '(standard:  TAB)',
'Record Delimiter' => 'Postavgränsare',
'(default is line break)' => '(standard: radbrytning)',
'Test output' => 'Testutmatning',
'Show Warnings' => 'Visa varningar',
'Omit Invalid' => 'Försumma ogiltiga',
'Assign Invalid' => 'Ogiltighetstilldelning',
'Overwrite Existing' => 'Skriv över befintliga',
'Retain Old User Email' => 'Behåll gammal medlemsepostadress',
'Send&nbsp;Notification&nbsp;email' => 'Sänd&nbsp;notifierings-&nbsp;meddelande',
'Make confirmed immediately' => 'Bekräfta omedelbart',
'Import' => 'Importera',

## added 2008-05-12
'phpList will not process files larger than %dMB' => '<br/>PHPlist kommer inte bearbeta filer större än %dMB',
'Cannot find column with email, please make sure the column is called &quot;email&quot; and not eg e-mail, and that your column delimiter is correct' => 'Kan inte hitta e-postadresskolumn. Vänligen kolla så kolumnen heter &quot;email&quot; och inte t. ex. &quot;e-mail&quot; och att kolumnavgränsaren är korrekt inställd',

);
?>
