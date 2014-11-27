<?php

## notes to translators:
# do not translate anything in square brackets: eg [RSS]

$lan = array (
  'noaccess' => 'Ni takega sporočila ali pa nimate dostopa do njega',
  'htmlusedwarning' => 'Opozorilo: Označili ste, da vsebina ni HTML, ampak v vsebini so HTML tagi. To lahko povzroči napake.',
  'adding' => 'Dodajam',
  'longmimetype' => 'Mime Type je daljši od 255 karakterjev, to lahko povzroči težave',
  'addingattachment' => 'Dodane priponke ',
  'uploadfailed' => 'Prenešena datoteka ni pravilno sprejeta, prazna datoteka',
  'saved' => 'Sporočilo shranjeno',
  'added' => 'Sporočilo dodano',
  'queued' => 'Sporočilo je v vrsti za pošiljanje',
  'processqueue' => 'Začni pošiljati sporočila',
  'errorsubject' => 'Uporabili ste neveljavne znake v polju Zadeva.',
  'errorfrom' => 'Uporabili ste neveljavne znake v polju Od.',
  'enterfrom' => 'Vnesite polje Od.',
  'entermessage' => 'Vnesite sporočilo',
  'entersubject' => 'Vnesite Zadevo',
  'duplicateattribute' => 'Napaka: atribut lahko uporabite v samo enem pravilu',
  'selectlist' => 'Izberite kategorije, ki jim boste poslali sporočilo',
  'notargetemail' => 'Ni e-poštnih naslovov za testiranje.',
  'emailnotfound' => 'E-naslov za pošiljanje testnega sporočila ni bil najden.',
  'sentemailto' => 'Pošlji tesno sporočilo na ',
  'removedattachment' => 'Odstranjena priponka ',
  'existingcriteria' => 'Obstoječi kriterij ',
  'remove' => 'Odstrani',
  'calculating' => 'Izračunavam',
  'calculate' => 'Izračun',
  'content' => 'Vsebina',
  'format' => 'Format',
  'attach' => 'Pripni',
  'scheduling' => 'Urnik',
  'criteria' => 'Kriterij',
  'lists' => 'Kategorije',
  'unsavedchanges' => 'Opozorilo, imate neshranjene spremembe. \n Kliknite OK za nadaljevanje ali Cancel,da ostanete na tej strani,\n in lahko shranite spremembe.',
  'whatisprepare' => 'Kaj je priprava sporočila',
  'subject' => 'Zadeva',
  'fromline' => 'Od:',
  'embargoeduntil' => 'Zakasnjeno do',
  'repeatevery' => 'Ponovi sporočilo na ',
  'norepetition' => 'Ne ponovi',
  'hour' => 'Uro',
  'day' => 'Dan',
  'week' => 'Teden',
  'repeatuntil' => 'Ponavljaj do',
  'format' => 'Format',
  'autodetect' => 'Samodejno zaznaj',
  'sendas' => 'Pošlji kot',
  'html' => 'HTML',
  'text' => 'tekst',
  'pdf' => 'PDF',
//  'textandhtml' => 'Text and HTML', //obsolete by bug 0009687
  'textandpdf' => 'Tekst in PDF',
  'usetemplate' => 'Uporabi predlogo',
  'selectone' => 'Izberi eno',
  'rssintro' => 'If you want to use this message as the template for sending RSS feeds
    select the frequency it should be used for and use [RSS] in your message to indicate where the list of items needs to go.',
  'none' => 'nič',
  'message' => 'Sporočilo',
  'expand' => 'razširi',
  'plaintextversion' => 'Tekstovna verzija sporočila',
  'messagefooter' => 'Noga sporočila',
  'messagefooterexplanation' => 'Uporabi <b>[UNSUBSCRIBE]</b> za vstavitev osebne strani za odjavo vsakega uporabnika.
    <br/>Uporabi <b>[PREFERENCES]</b> za vstavitev povezave za urejanje podrobnosti vsakega uporabnika',
  'addattachments' => 'Dodaj priponke sporočilu',
  'uploadlimits' => 'Prenos ima naslednje omejitve strežnika',
  'maxtotaldata' => 'Največja skupna dovoljena količina podatkov poslanih na strežnik',
  'maxfileupload' => 'Največja dovoljena velikost posamezne datoteke',
  'currentattachments' => 'Trenutne priponke',
  'filename' => 'datoteka',
  'desc' => 'opis',# short for description
  'size' => 'velikost',
  'file' => 'datoteka',
  'del' => 'izbriši', # short for delete
  'newattachment' => 'Nova priponka',
  'addandsave' => 'Dodaj (in Shrani)',
  'pathtofile' => 'Pot do datoteke na strežniku',
  'attachmentdescription' => 'Opis datoteke',
  'delchecked' => 'Izbris potrjen',
  'sendtestmessage' => 'Pošlji testno sporočilo',
  'toemailaddresses' => ' na naslove',
  'sendtestexplain' => '(naslove loči z vejico - vsi morajo biti obstoječi uporabniki)',
  'criteriaexplanation' => '
        <p><b>Izberi kriterij za to sporočilo:</b>
        <ol>
        <li>za uporabo kriterija, vstavi kljukico ob njem
        <li>nato označi radio gumb ob atributu, ki ga želiš uporabiti
        <li>nato izberi vrednosti atributov, ki jim želiš poslati sporočilo
        <i>Pozor:</i> Sporočilo bo poslano uporabnikom, ki ustrezajo <i>Kriteriju 1</i> <b>IN</b> <i>Kriteriju 2</i> itd..
        </ol>
        ',
  'criterion' => 'Kriteriji',
  'usethisone' => 'Uporabi tega',
  'or' => 'ali', # "alternative" ie this or this
  'is' => 'je',
  'isnot' => 'ni',
  'isbefore' => 'je pred', # date and time wise
  'isafter' => 'je po', # date and time wise
  'nocriteria' => 'Na voljo ni atributov za uporabo pri pošiljanju sporočila. Sporočilo bo poslano vsem uporabnikom v izbrani kategoriji',
  'checked' => 'Označeno', # as for checkbox
  'unchecked' => 'Neoznačeno', # as for checkbox
  'buggywithie' => 'Opozorilo, ta funkiconalnost ne deluje ravno najbolje v IE.\n Bolje je če uporabite Firefox ali Chrome ali Opero\n Alternatively switch off STACKED_ATTRIBUTE_SELECTION in your config file', # Don't translate STACKED_ATTRIBUTE_SELECTION
  'matchallrules' => 'Ujemanje vseh teh pravil',
  'matchanyrules' => 'Ujemanje kateregakoli od teh pravil',
  'addcriterion' => 'Dodaj kriterij',
  'saveasdraft' => 'Shrani sporočilo kot Osnutek',
  'savechanges' => 'Shrani spremembe',
  'selectattribute' => 'Izberi atribut',
  'dd-mm-yyyy' => 'dd-mm-yyyy', # it's essential that the format is the same (ie dd-mm-yyyy)

  # above is all from send_core

  'selectlists' => 'Izberi kategorije za pošiljanje',
  'alllists' => 'Vse kategorije',
  'listactive' => 'Kategorija je aktivna',
  'listnotactive' => 'Kategorija ni aktivna',
  'selectexcludelist' => 'Izberi kategorije, ki jih želiš izključiti.',
  'excludelistexplain' => 'Sporočilo bo poslano uporabnikom zgornjih kategorij,
    razen, če so člani kategorij, ki ste jih izbrali tukaj.',
  'nolistsavailable' => 'Ni aktiviranih kategorij',
  'sendmessage' => 'Pošlji sporočilo izbranim kategorijam',
  'warnnopearhttprequest' => 'Poslati poskušaš oddaljen URL, ampak PEAR::HTTP/Request ni na voljo, tako, da to ne bo uspešno',
  #


  ### new in 2.9.5
  'Misc' => 'Razno',
  'email to alert when sending of this message starts' => 'E-pošta za obvestilo, ko se bo pošiljanje tega sporočila začelo',
  'email to alert when sending of this message has finished' => 'E-pošta za obvestilo, ko se bo pošiljanje tega sporočila končalo',
  'separate multiple with a comma' => 'Več vnosov ločite z vejico',
  'operator' => 'operater',
  'values' => 'vrednosti',
  '%d users apply' => '%d uporabnikov ustreza',

  # new in 2.10.1
  'reload' => 'Ponaloži',
  
   'use [FORWARD] to add a personalised URL to forward the message to someone else.' => 'Uporabi <b>[FORWARD]</b> za vstavitev povezave za pošiljanje sporočila naprej. ',

);

?>
